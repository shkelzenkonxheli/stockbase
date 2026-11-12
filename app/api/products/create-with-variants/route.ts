import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { inspectUploadImage, MAX_PRODUCT_PHOTO_BYTES } from "@/lib/image-upload-validation";
import { deleteProductImageUpload, ProductImageUploadError, saveProductImage } from "@/lib/product-images";
import { prisma } from "@/lib/prisma";
import { buildVariantIdentityKey, getCatalogAwareCategoryConfig, parseCategoryFieldConfig } from "@/lib/product-taxonomy";
import { buildBarcodeFromVariantId, buildVariantSku, ensureUniqueSku } from "@/lib/variant-codes";
import { activeTenantWarehouseWhere } from "@/lib/warehouse-scope";

type SizeRow = { size: string; stock: number };

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const tenantId = user?.tenant?.id;
  if (!user || !tenantId || !hasRole(user, ["SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (contentLength > MAX_PRODUCT_PHOTO_BYTES + 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Fotoja duhet te jete deri ne 8 MB." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Te dhenat nuk u lexuan." }, { status: 400 });
  }

  const name = String(form.get("name") ?? "").trim();
  const brand = String(form.get("brand") ?? "").trim() || null;
  const categoryId = Number(form.get("categoryId"));
  const warehouseId = Number(form.get("warehouseId"));
  const productOnly = form.get("productOnly") === "true";
  const color = String(form.get("color") ?? "").trim();
  const priceText = String(form.get("price") ?? "").trim();
  const costText = String(form.get("costPrice") ?? "").trim();
  const price = Number(priceText);
  const costPrice = costText ? Number(costText) : 0;
  const locationCode = String(form.get("locationCode") ?? "").trim() || null;
  const materialInput = String(form.get("material") ?? "").trim() || null;
  const powerInput = String(form.get("powerWatts") ?? "").trim() || null;
  const imageValue = form.get("image");
  const image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;

  if (!name || name.length > 200 || (brand && brand.length > 100) || !Number.isSafeInteger(categoryId) || categoryId <= 0 || !Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
    return NextResponse.json({ error: "Ploteso emrin, kategorine dhe depon." }, { status: 400 });
  }

  const [category, warehouse] = await Promise.all([
    prisma.category.findFirst({ where: { id: categoryId, tenantId, isActive: true }, select: { id: true, name: true, config: true } }),
    prisma.warehouse.findFirst({ where: activeTenantWarehouseWhere(tenantId, warehouseId), select: { id: true, name: true } }),
  ]);
  if (!category || !warehouse) return NextResponse.json({ error: "Kategoria ose depoja nuk eshte aktive per kete biznes." }, { status: 400 });

  let rows: SizeRow[] = [];
  let material: string | null = null;
  let powerWatts: string | null = null;
  let identityKeys: string[] = [];
  if (!productOnly) {
    try {
      rows = JSON.parse(String(form.get("rows") ?? "")) as SizeRow[];
    } catch {
      return NextResponse.json({ error: "Lista e numrave nuk eshte valide." }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 30 || !color || color.length > 100 || !priceText || !Number.isFinite(price) || price < 0 || price > 99999999.99 || !Number.isFinite(costPrice) || costPrice < 0 || costPrice > 99999999.99 || (locationCode && locationCode.length > 100) || (materialInput && materialInput.length > 200) || (powerInput && powerInput.length > 100) || rows.some((row) => typeof row?.size !== "string" || !row.size.trim() || row.size.trim().length > 100 || !Number.isSafeInteger(row.stock) || row.stock < 0)) {
      return NextResponse.json({ error: "Ploteso ngjyren, cmimin, numrat dhe stokun me vlera valide." }, { status: 400 });
    }
    const config = getCatalogAwareCategoryConfig(user.tenant?.catalogType, category.name, user.tenant?.catalogConfig, parseCategoryFieldConfig(category.config));
    material = config.showMaterialField ? materialInput : null;
    powerWatts = config.showPowerField ? powerInput : null;
    identityKeys = rows.map((row) => buildVariantIdentityKey(config, { color, size: row.size.trim(), material, powerWatts }));
    if (new Set(identityKeys).size !== identityKeys.length) {
      return NextResponse.json({ error: "I njejti numer eshte shtuar dy here." }, { status: 400 });
    }
    if (image && !(await inspectUploadImage(image, MAX_PRODUCT_PHOTO_BYTES))) {
      return NextResponse.json({ error: "Ngarko nje foto JPG, PNG ose WebP deri ne 8 MB." }, { status: 400 });
    }
  }

  const duplicateWhere = { tenantId, categoryId, name: { equals: name, mode: "insensitive" as const }, brand: brand ? { equals: brand, mode: "insensitive" as const } : null };
  const existing = await prisma.product.findFirst({ where: duplicateWhere, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Ky produkt ekziston tashme. Shto nje variant te produkti ekzistues.", existingProductId: existing.id }, { status: 409 });

  let uploadedImagePath: string | null = null;
  let committed = false;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.product.findFirst({ where: duplicateWhere, select: { id: true } });
      if (duplicate) throw new ExistingProductError(duplicate.id);

      const product = await tx.product.create({ data: { tenantId, name, brand, categoryId, warehouseName: warehouse.name }, select: { id: true } });
      let imagePath: string | null = null;
      if (!productOnly && image) {
        imagePath = await saveProductImage(product.id, image);
        uploadedImagePath = imagePath;
      }

      const usedSkus = new Set<string>();
      let totalStock = 0;
      for (const [index, row] of rows.entries()) {
        const stock = row.stock;
        const size = row.size.trim();
        const baseSku = buildVariantSku({ productName: name, size, color });
        const occupiedSkus = await tx.variant.findMany({ where: { sku: { startsWith: baseSku } }, select: { sku: true } });
        for (const occupied of occupiedSkus) if (occupied.sku) usedSkus.add(occupied.sku);
        const variant = await tx.variant.create({
          data: {
            tenantId, productId: product.id, size, color, variantIdentityKey: identityKeys[index], stock, price,
            costPrice, material, powerWatts, locationCode, imagePath,
            sku: ensureUniqueSku(baseSku, usedSkus),
            inventories: { create: { warehouseId, stock, locationCode } },
          },
          select: { id: true },
        });
        await tx.variant.update({ where: { id: variant.id }, data: { barcode: buildBarcodeFromVariantId(variant.id) } });
        if (stock > 0) await tx.stockMovement.create({ data: { tenantId, variantId: variant.id, warehouseId, quantity: stock, reason: "INCOMING_STOCK" } });
        await writeAuditLog(tx, { tenantId, userId: user.id, action: "VARIANT_CREATED", entityType: "VARIANT", entityId: variant.id, entityLabel: `${color} / ${size}`, warehouseId, metadata: { productId: product.id, stock, price, costPrice, locationCode } });
        totalStock += stock;
      }
      await writeAuditLog(tx, { tenantId, userId: user.id, action: "PRODUCT_CREATED", entityType: "PRODUCT", entityId: product.id, entityLabel: name, warehouseId, metadata: { variantCount: rows.length, productOnly } });
      return { productId: product.id, variantCount: rows.length, totalStock };
    }, { timeout: 60000 });

    committed = true;
    revalidatePath("/");
    revalidatePath("/products");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (!committed && uploadedImagePath) {
      try {
        await deleteProductImageUpload(uploadedImagePath);
      } catch (cleanupError) {
        console.error("Failed to remove uncommitted product image", { tenantId, cleanupError });
      }
    }
    if (error instanceof ExistingProductError) return NextResponse.json({ error: "Ky produkt ekziston tashme. Shto variant te produkti ekzistues.", existingProductId: error.productId }, { status: 409 });
    if (error instanceof ProductImageUploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Produkti ose varianti ekziston tashme. Kontrollo te dhenat dhe provo perseri." }, { status: 409 });
    console.error("Atomic product creation failed", { tenantId, error });
    return NextResponse.json({ error: "Produkti nuk u ruajt. Asnje ndryshim nuk u be ne stok." }, { status: 500 });
  }
}

class ExistingProductError extends Error {
  constructor(readonly productId: number) { super("Product already exists"); }
}
