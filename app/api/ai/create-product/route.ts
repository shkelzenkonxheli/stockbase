import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { ProductImageUploadError, saveProductImage } from "@/lib/product-images";
import { findDuplicateCandidates } from "@/lib/product-duplicate-matching";
import { normalizeProductText } from "@/lib/product-match-core";
import {
  buildVariantIdentityKey,
  getAiProductAssistantConfig,
  getCatalogAwareCategoryConfig,
  parseCategoryFieldConfig,
} from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import { buildBarcodeFromVariantId, buildVariantSku, ensureUniqueSku } from "@/lib/variant-codes";

export const runtime = "nodejs";

type SizeInput = { size: string; stock: number };

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const tenant = user?.tenant;
  if (!user || !tenant || !hasRole(user, ["SUPER_ADMIN"]) || !getAiProductAssistantConfig(tenant.catalogConfig).enabled) {
    return NextResponse.json({ error: "Nuk ke qasje ne AI Product Assistant." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Kerkesa nuk eshte valide." }, { status: 400 });
  }

  const name = text(form, "name");
  const brand = text(form, "brand") || null;
  const color = text(form, "color");
  const material = text(form, "material") || null;
  const attributes = text(form, "attributes");
  const overrideDuplicate = text(form, "overrideDuplicate") === "true";
  const confirmedDuplicateId = Number(form.get("confirmedDuplicateId"));
  const categoryId = Number(form.get("categoryId"));
  const warehouseId = Number(form.get("warehouseId"));
  const costValue = text(form, "costPrice");
  const priceValue = text(form, "price");
  const costPrice = Number(costValue);
  const price = Number(priceValue);
  const image = form.get("image");
  let sizes: SizeInput[];
  try {
    const parsed: unknown = JSON.parse(text(form, "variants"));
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 30) throw new Error("Invalid variants");
    sizes = parsed.map((candidate: unknown) => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Invalid variant");
      const row = candidate as Record<string, unknown>;
      const size = typeof row.size === "string" ? row.size.trim() : "";
      const stockValue = typeof row.stock === "string" ? row.stock.trim() : "";
      const stock = Number(stockValue);
      if (!size || size.length > 100 || !stockValue || !Number.isSafeInteger(stock) || stock < 0) throw new Error("Invalid size or stock");
      return { size, stock };
    });
  } catch {
    return NextResponse.json({ error: "Ploteso numrin dhe stokun per secilin variant (deri ne 30 numra)." }, { status: 400 });
  }

  if (!name || name.length > 200 || (brand && brand.length > 100) || !color || color.length > 100 ||
      (material && material.length > 100) || attributes.length > 1000 ||
      !Number.isInteger(categoryId) || categoryId <= 0 || !Number.isInteger(warehouseId) || warehouseId <= 0 ||
      !costValue || !priceValue ||
      !Number.isFinite(costPrice) || costPrice < 0 || costPrice > 99999999.99 ||
      !Number.isFinite(price) || price < 0 || price > 99999999.99 ||
      !(image instanceof File) || image.size === 0 || image.size > 8 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
    return NextResponse.json({ error: "Kontrollo fushat dhe foton (JPG, PNG ose WebP, maksimumi 8 MB)." }, { status: 400 });
  }

  const [category, warehouse, existingProduct] = await Promise.all([
    prisma.category.findFirst({ where: { id: categoryId, tenantId: tenant.id, isActive: true }, select: { name: true, config: true } }),
    prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId: tenant.id, isActive: true }, select: { name: true } }),
    prisma.product.findFirst({ where: { tenantId: tenant.id, categoryId, name: { equals: name, mode: "insensitive" }, brand: brand ? { equals: brand, mode: "insensitive" } : null }, select: { id: true } }),
  ]);
  if (!category || !warehouse) return NextResponse.json({ error: "Kategoria ose depoja nuk eshte valide." }, { status: 400 });
  if (existingProduct && (!overrideDuplicate || confirmedDuplicateId !== existingProduct.id)) {
    return NextResponse.json({ error: "Ky produkt ekziston tashme. Shto ngjyren ose numrin te produkti ekzistues.", existingProductId: existingProduct.id }, { status: 409 });
  }
  const normalizedMatches = await findDuplicateCandidates(tenant.id, {
    brand, model: name, category: category.name, color, material, attributes: attributes ? attributes.split(",").map((value) => value.trim()) : [], confidence: 1,
  });
  const normalizedDuplicate = normalizedMatches.find((candidate) =>
    candidate.signals.model === 1 && candidate.signals.category === 1 && normalizeProductText(candidate.brand) === normalizeProductText(brand));
  if (normalizedDuplicate && (!overrideDuplicate || confirmedDuplicateId !== normalizedDuplicate.id)) {
    return NextResponse.json({ error: "Ky model ekziston tashme. Kontrollo produktin ekzistues para se te shtosh variant.", existingProductId: normalizedDuplicate.id }, { status: 409 });
  }

  const categoryConfig = getCatalogAwareCategoryConfig(tenant.catalogType, category.name, tenant.catalogConfig, parseCategoryFieldConfig(category.config));
  const isFootwear = ["patika", "kepuce", "sandale"].includes(category.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  const variantMaterial = isFootwear ? null : material;
  const variantAttributes = isFootwear ? "" : attributes;
  const identities = new Set<string>();
  for (const row of sizes) {
    const key = buildVariantIdentityKey(categoryConfig, { color, size: row.size, material: variantMaterial });
    if (identities.has(key)) return NextResponse.json({ error: `Numri ${row.size} eshte shtuar dy here.` }, { status: 400 });
    identities.add(key);
  }
  const skuBases = sizes.map((row) => buildVariantSku({ productName: name, color, size: row.size }));
  const existingSkus = await prisma.variant.findMany({ where: { OR: skuBases.map((base) => ({ sku: { startsWith: base } })) }, select: { sku: true } });
  const usedSkus = new Set(existingSkus.map((item) => item.sku).filter((sku): sku is string => Boolean(sku)));

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: { tenantId: tenant.id, name, brand, categoryId, warehouseName: warehouse.name } });
      const imagePath = await saveProductImage(product.id, image);
      if (!imagePath) throw new ProductImageUploadError("Fotoja nuk u ruajt.");
      const variantIds: number[] = [];
      for (const row of sizes) {
        const variant = await tx.variant.create({ data: {
          tenantId: tenant.id,
          productId: product.id,
          color, size: row.size, material: variantMaterial,
          stock: row.stock, costPrice, price,
          sku: ensureUniqueSku(buildVariantSku({ productName: name, color, size: row.size }), usedSkus),
          imagePath,
          variantIdentityKey: buildVariantIdentityKey(categoryConfig, { color, size: row.size, material: variantMaterial }),
          customAttributes: variantAttributes ? { aiAttributes: variantAttributes } : undefined,
          inventories: { create: { warehouseId, stock: row.stock } },
        } });
        await tx.variant.update({ where: { id: variant.id }, data: { barcode: buildBarcodeFromVariantId(variant.id) } });
        variantIds.push(variant.id);
      }
      await tx.auditLog.create({ data: {
        tenantId: tenant.id, userId: user.id, action: "AI_PRODUCT_CREATED", entityType: "Product", entityId: product.id,
        entityLabel: `${brand ? `${brand} ` : ""}${name}`, warehouseId,
        metadata: { variantIds, color, sizes, duplicateOverrideProductId: overrideDuplicate ? existingProduct?.id ?? normalizedDuplicate?.id ?? null : null },
      } });
      return { productId: product.id, variantIds };
    }, { timeout: 60000 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("AI product creation failed", { tenantId: tenant.id, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: error instanceof ProductImageUploadError ? error.message : "Produkti nuk u ruajt. Kontrollo te dhenat dhe provo perseri." }, { status: 500 });
  }
}
