import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { Prisma } from "@/app/generated/prisma/client";
import { requireRole } from "@/lib/auth";
import { ensureTenantCategories } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import {
  IMPORT_FIELD_KEYS,
  REQUIRED_IMPORT_FIELDS,
  normalizeImportText,
  parseLocalizedNumber,
  type ImportFieldKey,
} from "@/lib/product-import";
import {
  buildVariantIdentityKey,
  getCatalogAwareCategoryConfig,
  getCategoryConfig,
  parseCategoryFieldConfig,
  type CategoryConfig,
} from "@/lib/product-taxonomy";
import { ensureUniqueSku, buildBarcodeFromVariantId, normalizeVariantCode } from "@/lib/variant-codes";
import { getTenantWarehouses } from "@/lib/warehouses";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

type MappingPayload = Partial<Record<ImportFieldKey, string>>;

type RawImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type PreparedImportRow = {
  rowNumber: number;
  productName: string;
  brand: string | null;
  categoryName: string;
  warehouseName: string | null;
  size: string;
  color: string;
  stock: number;
  price: number;
  sku: string | null;
  barcode: string | null;
  material: string | null;
  powerWatts: string | null;
  locationCode: string | null;
};

function isImportFieldKey(value: string): value is ImportFieldKey {
  return (IMPORT_FIELD_KEYS as readonly string[]).includes(value);
}

function extractRowsFromWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("File nuk permban sheet.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });

  if (rows.length < 2) {
    throw new Error("File duhet te kete te pakten header dhe nje rresht me te dhena.");
  }

  const headers = (rows[0] ?? []).map((cell, index) => {
    const value = String(cell ?? "").trim();
    return value || `Kolona ${index + 1}`;
  });

  const dataRows = rows
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      values: headers.reduce<Record<string, string>>((accumulator, header, headerIndex) => {
        accumulator[header] = String(row[headerIndex] ?? "").trim();
        return accumulator;
      }, {}),
    }))
    .filter((row) => Object.values(row.values).some((value) => value !== ""));

  if (dataRows.length === 0) {
    throw new Error("Nuk u gjeten rreshta me te dhena.");
  }

  return { headers, dataRows };
}

function parseMapping(rawMapping: string | null) {
  if (!rawMapping) {
    throw new Error("Mapimi i kolonave mungon.");
  }

  const parsed = JSON.parse(rawMapping) as Record<string, string>;
  const mapping: MappingPayload = {};

  for (const [field, header] of Object.entries(parsed)) {
    if (isImportFieldKey(field) && typeof header === "string") {
      mapping[field] = header.trim();
    }
  }

  for (const field of REQUIRED_IMPORT_FIELDS) {
    if (!mapping[field]) {
      throw new Error(`Fusha ${field} duhet te mapohet para importit.`);
    }
  }

  return mapping;
}

function readMappedValue(row: RawImportRow, mapping: MappingPayload, field: ImportFieldKey) {
  const header = mapping[field];
  if (!header) {
    return "";
  }

  return normalizeImportText(row.values[header]);
}

function prepareRows(rows: RawImportRow[], mapping: MappingPayload) {
  const prepared: PreparedImportRow[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const productName = readMappedValue(row, mapping, "productName");
    const categoryName = readMappedValue(row, mapping, "category");
    const stockRaw = readMappedValue(row, mapping, "stock");
    const priceRaw = readMappedValue(row, mapping, "price");
    const size = readMappedValue(row, mapping, "size") || "standard";
    const color = readMappedValue(row, mapping, "color") || "standard";
    const stock = parseLocalizedNumber(stockRaw);
    const price = parseLocalizedNumber(priceRaw);

    if (!productName) {
      errors.push(`Rreshti ${row.rowNumber}: mungon emri i produktit.`);
      continue;
    }

    if (!categoryName) {
      errors.push(`Rreshti ${row.rowNumber}: mungon kategoria.`);
      continue;
    }

    if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < 0) {
      errors.push(`Rreshti ${row.rowNumber}: stoku duhet te jete numer i plote >= 0.`);
      continue;
    }

    if (!Number.isFinite(price) || price < 0) {
      errors.push(`Rreshti ${row.rowNumber}: cmimi duhet te jete numer >= 0.`);
      continue;
    }

    prepared.push({
      rowNumber: row.rowNumber,
      productName,
      brand: readMappedValue(row, mapping, "brand") || null,
      categoryName,
      warehouseName: readMappedValue(row, mapping, "warehouse") || null,
      size,
      color,
      stock,
      price,
      sku: normalizeVariantCode(readMappedValue(row, mapping, "sku")) ?? null,
      barcode: normalizeVariantCode(readMappedValue(row, mapping, "barcode")) ?? null,
      material: readMappedValue(row, mapping, "material") || null,
      powerWatts: readMappedValue(row, mapping, "powerWatts") || null,
      locationCode: readMappedValue(row, mapping, "locationCode") || null,
    });
  }

  return { prepared, errors };
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
}

function findDuplicateVariantInRows(row: PreparedImportRow, rows: PreparedImportRow[], config: CategoryConfig) {
  const key = buildVariantIdentityKey(config, row);

  return rows.find(
    (candidate) =>
      candidate.rowNumber !== row.rowNumber &&
      sameText(candidate.productName, row.productName) &&
      sameText(candidate.brand, row.brand) &&
      sameText(candidate.categoryName, row.categoryName) &&
      buildVariantIdentityKey(config, candidate) === key,
  );
}

export async function POST(request: Request) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenant = currentUser.tenant;
  const tenantId = tenant?.id;
  if (!tenantId || !tenant) {
    return NextResponse.json({ error: "Tenant mungon." }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Zgjidh nje file per import." }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File nuk eshte valid." }, { status: 400 });
  }

  let mapping: MappingPayload;
  try {
    mapping = parseMapping(formData.get("mapping")?.toString() ?? null);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mapimi nuk eshte valid." },
      { status: 400 },
    );
  }

  try {
    await ensureTenantCategories(tenantId, tenant.catalogType);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { dataRows } = extractRowsFromWorkbook(buffer);
    const { prepared, errors } = prepareRows(dataRows, mapping);

    if (errors.length > 0) {
      return NextResponse.json({ error: "File ka gabime.", validationErrors: errors }, { status: 400 });
    }

    const missingCategoryNames = [
      ...new Set(prepared.map((row) => row.categoryName.trim()).filter(Boolean)),
    ];

    await prisma.$transaction(
      missingCategoryNames.map((categoryName) =>
        prisma.category.upsert({
          where: {
            tenantId_name: {
              tenantId,
              name: categoryName,
            },
          },
          update: {
            isActive: true,
          },
          create: {
            tenantId,
            name: categoryName,
            catalogType: tenant.catalogType,
            isActive: true,
            config: getCategoryConfig(categoryName),
          },
        }),
      ),
    );

    const [categories, warehouses, existingProducts, existingVariants] = await Promise.all([
      prisma.category.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, config: true },
      }),
      getTenantWarehouses(tenantId, tenant.catalogConfig),
      prisma.product.findMany({
        where: { tenantId },
        select: { id: true, name: true, brand: true, categoryId: true },
      }),
      prisma.variant.findMany({
        where: { tenantId },
        select: {
          id: true,
          productId: true,
          size: true,
          color: true,
          material: true,
          powerWatts: true,
          sku: true,
          barcode: true,
        },
      }),
    ]);

    const categoryMap = new Map(categories.map((category) => [category.name.toLowerCase(), category]));
    const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.name.toLowerCase(), warehouse]));
    const usedSkus = new Set(
      existingVariants.map((variant) => variant.sku).filter((sku): sku is string => Boolean(sku)),
    );
    const usedBarcodes = new Set(
      existingVariants.map((variant) => variant.barcode).filter((barcode): barcode is string => Boolean(barcode)),
    );

    const rowErrors: string[] = [];

    for (const row of prepared) {
      const category = categoryMap.get(row.categoryName.toLowerCase());
      if (!category) {
        rowErrors.push(`Rreshti ${row.rowNumber}: kategoria "${row.categoryName}" nuk ekziston.`);
        continue;
      }

      if (row.warehouseName && !warehouseMap.has(row.warehouseName.toLowerCase())) {
        rowErrors.push(`Rreshti ${row.rowNumber}: depoja "${row.warehouseName}" nuk ekziston.`);
      }

      const categoryConfig = getCatalogAwareCategoryConfig(
        tenant.catalogType,
        category.name,
        tenant.catalogConfig,
        parseCategoryFieldConfig(category.config),
      );

      const duplicateInFile = findDuplicateVariantInRows(row, prepared, categoryConfig);
      if (duplicateInFile) {
        rowErrors.push(
          `Rreshti ${row.rowNumber}: varianti eshte duplikat me rreshtin ${duplicateInFile.rowNumber}.`,
        );
      }

      if (!categoryConfig.showMaterialField) {
        row.material = null;
      }

      if (!categoryConfig.showPowerField) {
        row.powerWatts = null;
      }
    }

    if (rowErrors.length > 0) {
      return NextResponse.json({ error: "File ka gabime.", validationErrors: rowErrors }, { status: 400 });
    }

    const imported = await prisma.$transaction(async (tx) => {
      let createdProducts = 0;
      let createdVariants = 0;
      let updatedInventories = 0;

      const productCache = new Map<string, { id: number; categoryId: number }>();
      for (const product of existingProducts) {
        productCache.set(
          `${product.name.toLowerCase()}::${String(product.brand ?? "").toLowerCase()}::${product.categoryId}`,
          { id: product.id, categoryId: product.categoryId },
        );
      }

      const variantKeyByProduct = new Map<string, number>();
      for (const variant of existingVariants) {
        const key = `${variant.productId}::${buildVariantIdentityKey(
          { showMaterialField: true, showPowerField: true } as CategoryConfig,
          variant,
        )}`;
        variantKeyByProduct.set(key, variant.id);
      }

      const existingInventories = await tx.variantInventory.findMany({
        where: {
          warehouse: {
            tenantId,
          },
        },
        select: {
          id: true,
          variantId: true,
          warehouseId: true,
          stock: true,
        },
      });

      const inventoryKeyMap = new Map(
        existingInventories.map((inventory) => [
          `${inventory.variantId}::${inventory.warehouseId}`,
          { id: inventory.id, stock: inventory.stock },
        ]),
      );

      for (const row of prepared) {
        const category = categoryMap.get(row.categoryName.toLowerCase());
        if (!category) {
          continue;
        }

        const categoryConfig = getCatalogAwareCategoryConfig(
          tenant.catalogType,
          category.name,
          tenant.catalogConfig,
          parseCategoryFieldConfig(category.config),
        );

        const productKey = `${row.productName.toLowerCase()}::${String(row.brand ?? "").toLowerCase()}::${category.id}`;
        let productRecord = productCache.get(productKey);

        if (!productRecord) {
          const createdProduct = await tx.product.create({
            data: {
              tenantId,
              name: row.productName,
              brand: row.brand,
              categoryId: category.id,
              warehouseName: row.warehouseName,
            },
            select: { id: true, categoryId: true },
          });
          productCache.set(productKey, createdProduct);
          productRecord = createdProduct;
          createdProducts += 1;
        }

        const variantIdentityKey = buildVariantIdentityKey(categoryConfig, row);
        const variantLookupKey = `${productRecord.id}::${variantIdentityKey}`;
        const warehouse = row.warehouseName ? warehouseMap.get(row.warehouseName.toLowerCase()) ?? null : null;

        let variantId = variantKeyByProduct.get(variantLookupKey);

        if (!variantId) {
          const createdVariant = await tx.variant.create({
            data: {
              tenantId,
              productId: productRecord.id,
              size: row.size,
              color: row.color,
              variantIdentityKey,
              stock: row.stock,
              reorderLevel: null,
              price: new Prisma.Decimal(row.price),
              sku: row.sku ? ensureUniqueSku(row.sku, usedSkus) : null,
              barcode: row.barcode && !usedBarcodes.has(row.barcode) ? row.barcode : null,
              material: categoryConfig.showMaterialField ? row.material : null,
              powerWatts: categoryConfig.showPowerField ? row.powerWatts : null,
              locationCode: row.locationCode,
            },
            select: { id: true, barcode: true },
          });

          variantId = createdVariant.id;
          variantKeyByProduct.set(variantLookupKey, variantId);
          createdVariants += 1;

          let nextBarcode = createdVariant.barcode;
          if (!nextBarcode) {
            nextBarcode = buildBarcodeFromVariantId(createdVariant.id);
            while (usedBarcodes.has(nextBarcode)) {
              nextBarcode = `${nextBarcode}${createdVariant.id}`;
            }
            await tx.variant.update({
              where: { id: createdVariant.id },
              data: { barcode: nextBarcode },
            });
          }

          usedBarcodes.add(nextBarcode);
        }

        if (warehouse) {
          const inventoryKey = `${variantId}::${warehouse.id}`;
          const existingInventory = inventoryKeyMap.get(inventoryKey);

          if (existingInventory) {
            const nextStock = existingInventory.stock + row.stock;
            await tx.variantInventory.update({
              where: { id: existingInventory.id },
              data: {
                stock: nextStock,
                locationCode: row.locationCode,
              },
            });
            inventoryKeyMap.set(inventoryKey, {
              id: existingInventory.id,
              stock: nextStock,
            });
            updatedInventories += 1;
          } else {
            const createdInventory = await tx.variantInventory.create({
              data: {
                variantId,
                warehouseId: warehouse.id,
                stock: row.stock,
                locationCode: row.locationCode,
              },
            });
            inventoryKeyMap.set(inventoryKey, {
              id: createdInventory.id,
              stock: createdInventory.stock,
            });
            updatedInventories += 1;
          }

          if (row.stock > 0) {
            await tx.stockMovement.create({
              data: {
                tenantId,
                variantId,
                warehouseId: warehouse.id,
                quantity: row.stock,
                reason: "INCOMING_STOCK",
              },
            });
          }
        }
      }

      return { createdProducts, createdVariants, updatedInventories };
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    revalidatePath("/");
    revalidatePath("/products");
    return NextResponse.json({ ok: true, imported });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Importi deshtoi.",
      },
      { status: 400 },
    );
  }
}
