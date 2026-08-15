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

type GlobalSelectionsPayload = {
  categoryName?: string;
  warehouseName?: string;
  brandName?: string;
};

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

type PendingBarcodeUpdate = {
  variantId: number;
  barcode: string;
};

type PendingStockMovement = {
  tenantId: number;
  variantId: number;
  warehouseId: number;
  quantity: number;
  reason: "INCOMING_STOCK" | "INVENTORY_COUNT";
};

type DuplicateStrategy = "skip" | "add_stock" | "replace";

function slugifyWarehouse(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

  for (const field of REQUIRED_IMPORT_FIELDS.filter((field) => field !== "category")) {
    if (!mapping[field]) {
      throw new Error(`Fusha ${field} duhet te mapohet para importit.`);
    }
  }

  return mapping;
}

function parseGlobalSelections(rawSelections: string | null) {
  if (!rawSelections) {
    return {
      categoryName: "",
      warehouseName: "",
      brandName: "",
    };
  }

  const parsed = JSON.parse(rawSelections) as GlobalSelectionsPayload;
  return {
    categoryName: normalizeImportText(parsed.categoryName),
    warehouseName: normalizeImportText(parsed.warehouseName),
    brandName: normalizeImportText(parsed.brandName),
  };
}

function readMappedValue(row: RawImportRow, mapping: MappingPayload, field: ImportFieldKey) {
  const header = mapping[field];
  if (!header) {
    return "";
  }

  return normalizeImportText(row.values[header]);
}

function prepareRows(
  rows: RawImportRow[],
  mapping: MappingPayload,
  globalSelections: ReturnType<typeof parseGlobalSelections>,
) {
  const prepared: PreparedImportRow[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const productName = readMappedValue(row, mapping, "productName");
    const categoryName = readMappedValue(row, mapping, "category") || globalSelections.categoryName;
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
      brand: readMappedValue(row, mapping, "brand") || globalSelections.brandName || null,
      categoryName,
      warehouseName: readMappedValue(row, mapping, "warehouse") || globalSelections.warehouseName || null,
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
  const duplicateStrategy = (formData.get("duplicateStrategy")?.toString() ?? "add_stock") as DuplicateStrategy;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Zgjidh nje file per import." }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File nuk eshte valid." }, { status: 400 });
  }

  let mapping: MappingPayload;
  let globalSelections: ReturnType<typeof parseGlobalSelections>;
  try {
    mapping = parseMapping(formData.get("mapping")?.toString() ?? null);
    globalSelections = parseGlobalSelections(formData.get("globalSelections")?.toString() ?? null);
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
    const { prepared, errors } = prepareRows(dataRows, mapping, globalSelections);
    const hasMappedSku = Boolean(mapping.sku);
    const hasMappedBarcode = Boolean(mapping.barcode);
    const hasMappedMaterial = Boolean(mapping.material);
    const hasMappedPowerWatts = Boolean(mapping.powerWatts);
    const hasMappedLocationCode = Boolean(mapping.locationCode);

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

    const missingWarehouseNames = [
      ...new Set(prepared.map((row) => row.warehouseName?.trim() ?? "").filter(Boolean)),
    ];

    await Promise.all(
      missingWarehouseNames.map(async (warehouseName) => {
        const existingWarehouse = await prisma.warehouse.findFirst({
          where: {
            tenantId,
            name: warehouseName,
          },
          select: { id: true },
        });

        if (existingWarehouse) {
          await prisma.warehouse.update({
            where: { id: existingWarehouse.id },
            data: { isActive: true },
          });
          return;
        }

        const baseSlug = slugifyWarehouse(warehouseName) || "warehouse";
        let slug = baseSlug;
        let suffix = 2;

        while (
          await prisma.warehouse.findFirst({
            where: {
              tenantId,
              slug,
            },
            select: { id: true },
          })
        ) {
          slug = `${baseSlug}-${suffix}`;
          suffix += 1;
        }

        await prisma.warehouse.create({
          data: {
            tenantId,
            name: warehouseName,
            slug,
            isActive: true,
          },
        });
      }),
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
          variantIdentityKey: true,
          size: true,
          color: true,
          material: true,
          powerWatts: true,
          locationCode: true,
          price: true,
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
    const categoryConfigById = new Map(
      categories.map((category) => [
        category.id,
        getCatalogAwareCategoryConfig(
          tenant.catalogType,
          category.name,
          tenant.catalogConfig,
          parseCategoryFieldConfig(category.config),
        ),
      ]),
    );

    for (const row of prepared) {
      const category = categoryMap.get(row.categoryName.toLowerCase());
      if (!category) {
        rowErrors.push(`Rreshti ${row.rowNumber}: kategoria "${row.categoryName}" nuk ekziston.`);
        continue;
      }

      const categoryConfig = categoryConfigById.get(category.id);
      if (!categoryConfig) {
        rowErrors.push(`Rreshti ${row.rowNumber}: konfigurimi i kategorise "${row.categoryName}" mungon.`);
        continue;
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
      let skippedRows = 0;
      let updatedVariants = 0;
      const pendingBarcodeUpdates: PendingBarcodeUpdate[] = [];
      const pendingStockMovements: PendingStockMovement[] = [];

      const productCache = new Map<string, { id: number; categoryId: number }>();
      for (const product of existingProducts) {
        productCache.set(
          `${product.name.toLowerCase()}::${String(product.brand ?? "").toLowerCase()}::${product.categoryId}`,
          { id: product.id, categoryId: product.categoryId },
        );
      }

      const variantKeyByProduct = new Map<string, number>();
      const existingVariantById = new Map(existingVariants.map((variant) => [variant.id, variant]));
      for (const variant of existingVariants) {
        const key = `${variant.productId}::${
          variant.variantIdentityKey ??
          buildVariantIdentityKey({ showMaterialField: true, showPowerField: true } as CategoryConfig, variant)
        }`;
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
          locationCode: true,
        },
      });

      const inventoryKeyMap = new Map(
        existingInventories.map((inventory) => [
          `${inventory.variantId}::${inventory.warehouseId}`,
          { id: inventory.id, stock: inventory.stock, locationCode: inventory.locationCode },
        ]),
      );

      for (const row of prepared) {
        const category = categoryMap.get(row.categoryName.toLowerCase());
        if (!category) {
          continue;
        }

        const categoryConfig = categoryConfigById.get(category.id);
        if (!categoryConfig) {
          continue;
        }

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
          existingVariantById.set(variantId, {
            id: createdVariant.id,
            productId: productRecord.id,
            variantIdentityKey,
            size: row.size,
            color: row.color,
            material: categoryConfig.showMaterialField ? row.material : null,
            powerWatts: categoryConfig.showPowerField ? row.powerWatts : null,
            locationCode: row.locationCode,
            price: new Prisma.Decimal(row.price),
            sku: row.sku,
            barcode: createdVariant.barcode,
          });
          createdVariants += 1;

          let nextBarcode = createdVariant.barcode;
          if (!nextBarcode) {
            nextBarcode = buildBarcodeFromVariantId(createdVariant.id);
            while (usedBarcodes.has(nextBarcode)) {
              nextBarcode = `${nextBarcode}${createdVariant.id}`;
            }
            pendingBarcodeUpdates.push({
              variantId: createdVariant.id,
              barcode: nextBarcode,
            });
          }

          usedBarcodes.add(nextBarcode);
          const createdVariantRecord = existingVariantById.get(variantId);
          if (createdVariantRecord) {
            createdVariantRecord.barcode = nextBarcode;
          }
        } else if (duplicateStrategy === "skip") {
          skippedRows += 1;
          continue;
        } else if (duplicateStrategy === "replace") {
          const currentVariant = existingVariantById.get(variantId);
          const nextSku =
            hasMappedSku
              ? row.sku && currentVariant?.sku !== row.sku && !usedSkus.has(row.sku)
                ? ensureUniqueSku(row.sku, usedSkus)
                : row.sku ?? null
              : (currentVariant?.sku ?? null);
          const nextBarcode =
            hasMappedBarcode
              ? row.barcode && currentVariant?.barcode !== row.barcode && !usedBarcodes.has(row.barcode)
                ? row.barcode
                : row.barcode ?? null
              : (currentVariant?.barcode ?? null);

          const nextPrice = new Prisma.Decimal(row.price);
          const nextMaterial =
            categoryConfig.showMaterialField && hasMappedMaterial
              ? row.material
              : (currentVariant?.material ?? null);
          const nextPowerWatts =
            categoryConfig.showPowerField && hasMappedPowerWatts
              ? row.powerWatts
              : (currentVariant?.powerWatts ?? null);
          const nextLocationCode = hasMappedLocationCode ? row.locationCode : (currentVariant?.locationCode ?? null);
          const variantChanged =
            currentVariant?.price.toString() !== nextPrice.toString() ||
            (currentVariant?.sku ?? null) !== nextSku ||
            (currentVariant?.barcode ?? null) !== nextBarcode ||
            (currentVariant?.material ?? null) !== nextMaterial ||
            (currentVariant?.powerWatts ?? null) !== nextPowerWatts ||
            (currentVariant?.locationCode ?? null) !== nextLocationCode;

          if (variantChanged) {
            await tx.variant.update({
              where: { id: variantId },
              data: {
                price: nextPrice,
                sku: nextSku,
                barcode: nextBarcode,
                material: nextMaterial,
                powerWatts: nextPowerWatts,
                locationCode: nextLocationCode,
              },
            });

            if (nextBarcode) {
              usedBarcodes.add(nextBarcode);
            }
            existingVariantById.set(variantId, {
              ...(currentVariant ?? {
                id: variantId,
                productId: productRecord.id,
                variantIdentityKey,
                size: row.size,
                color: row.color,
              }),
              material: nextMaterial,
              powerWatts: nextPowerWatts,
              locationCode: nextLocationCode,
              price: nextPrice,
              sku: nextSku,
              barcode: nextBarcode,
            });
            updatedVariants += 1;
          }
        }

        const variantAfterUpsert = existingVariantById.get(variantId);
        if (variantAfterUpsert && !variantAfterUpsert.barcode) {
          let generatedBarcode = buildBarcodeFromVariantId(variantId);
          while (usedBarcodes.has(generatedBarcode)) {
            generatedBarcode = `${generatedBarcode}${variantId}`;
          }

          pendingBarcodeUpdates.push({
            variantId,
            barcode: generatedBarcode,
          });

          usedBarcodes.add(generatedBarcode);
          existingVariantById.set(variantId, {
            ...variantAfterUpsert,
            barcode: generatedBarcode,
          });
        }

        if (warehouse) {
          const inventoryKey = `${variantId}::${warehouse.id}`;
          const existingInventory = inventoryKeyMap.get(inventoryKey);

          if (existingInventory) {
            const nextStock =
              duplicateStrategy === "replace" && variantKeyByProduct.get(variantLookupKey)
                ? row.stock
                : existingInventory.stock + row.stock;
            const nextInventoryLocationCode = hasMappedLocationCode ? row.locationCode : (existingInventory.locationCode ?? null);
            const inventoryChanged =
              existingInventory.stock !== nextStock ||
              (existingInventory.locationCode ?? null) !== nextInventoryLocationCode;

            if (inventoryChanged) {
              await tx.variantInventory.update({
                where: { id: existingInventory.id },
                data: {
                  stock: nextStock,
                  locationCode: nextInventoryLocationCode,
                },
              });
              inventoryKeyMap.set(inventoryKey, {
                id: existingInventory.id,
                stock: nextStock,
                locationCode: nextInventoryLocationCode,
              });
              updatedInventories += 1;
            }

            const stockDelta =
              duplicateStrategy === "replace" ? nextStock - existingInventory.stock : row.stock;
            if (stockDelta !== 0) {
              pendingStockMovements.push({
                tenantId,
                variantId,
                warehouseId: warehouse.id,
                quantity: stockDelta,
                reason: duplicateStrategy === "replace" ? "INVENTORY_COUNT" : "INCOMING_STOCK",
              });
            }
          } else {
            const createdInventory = await tx.variantInventory.create({
              data: {
                variantId,
                warehouseId: warehouse.id,
                stock: row.stock,
                locationCode: hasMappedLocationCode ? row.locationCode : null,
              },
            });
            inventoryKeyMap.set(inventoryKey, {
              id: createdInventory.id,
              stock: createdInventory.stock,
              locationCode: createdInventory.locationCode,
            });
            updatedInventories += 1;

            if (row.stock > 0) {
              pendingStockMovements.push({
                tenantId,
                variantId,
                warehouseId: warehouse.id,
                quantity: row.stock,
                reason: duplicateStrategy === "replace" ? "INVENTORY_COUNT" : "INCOMING_STOCK",
              });
            }
          }
        }
      }

      if (pendingBarcodeUpdates.length > 0) {
        await Promise.all(
          pendingBarcodeUpdates.map((item) =>
            tx.variant.update({
              where: { id: item.variantId },
              data: { barcode: item.barcode },
            }),
          ),
        );
      }

      if (pendingStockMovements.length > 0) {
        await tx.stockMovement.createMany({
          data: pendingStockMovements,
        });
      }

      return { createdProducts, createdVariants, updatedVariants, updatedInventories, skippedRows };
    }, {
      maxWait: 20000,
      timeout: 120000,
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
