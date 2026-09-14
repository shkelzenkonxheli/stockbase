"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FIELD_KEYS = new Set(["image", "name", "brand", "category", "retailPrice", "wholesalePrice", "color", "size", "material", "sku", "barcode", "stock", "description"]);
const STATUSES = new Set(["DRAFT", "ACTIVE"]);
const LAYOUTS = new Set(["TWO_COLUMNS", "THREE_COLUMNS", "FOUR_COLUMNS"]);
const STYLES = new Set(["MINIMAL", "PREMIUM", "WHOLESALE"]);
const PRICE_MODES = new Set(["RETAIL", "WHOLESALE", "HIDE"]);
const STOCK_MODES = new Set(["HIDE", "EXACT", "AVAILABILITY"]);

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function saveCatalog(formData: FormData) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant!.id;
  const id = Number(asString(formData.get("id"))) || null;
  const name = asString(formData.get("name"));
  const description = asString(formData.get("description")) || null;
  const status = asString(formData.get("status"));
  const layout = asString(formData.get("layout"));
  const style = asString(formData.get("style"));
  const priceMode = asString(formData.get("priceMode"));
  const stockMode = asString(formData.get("stockMode"));
  const isPublic = formData.get("isPublic") === "on";
  const requestedSlug = normalizeSlug(asString(formData.get("publicSlug")) || name);

  if (!name || !STATUSES.has(status) || !LAYOUTS.has(layout) || !STYLES.has(style) || !PRICE_MODES.has(priceMode) || !STOCK_MODES.has(stockMode)) {
    throw new Error("Te dhenat e katalogut nuk jane valide.");
  }

  let productIds: number[] = [];
  let fields: { key: string; enabled: boolean; sortOrder: number }[] = [];
  try {
    const parsedProducts = JSON.parse(asString(formData.get("productIds")));
    const parsedFields = JSON.parse(asString(formData.get("fields")));
    if (!Array.isArray(parsedProducts) || !Array.isArray(parsedFields)) throw new Error("Formati nuk eshte valid.");
    productIds = [...new Set(parsedProducts)].filter(Number.isInteger);
    fields = parsedFields.filter((field: { key?: string }) => FIELD_KEYS.has(field.key ?? ""));
  } catch {
    throw new Error("Produktet ose fushat nuk jane valide.");
  }

  const products = await prisma.product.findMany({ where: { tenantId, id: { in: productIds } }, select: { id: true } });
  if (products.length !== productIds.length) throw new Error("Nje produkt nuk i perket tenant-it aktiv.");

  if (id) {
    const existing = await prisma.catalog.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) throw new Error("Katalogu nuk u gjet.");
  }

  if (isPublic) {
    const slugOwner = await prisma.catalog.findFirst({
      where: { publicSlug: requestedSlug, ...(id ? { id: { not: id } } : {}) },
      select: { id: true },
    });
    if (slugOwner) throw new Error("Ky public slug eshte ne perdorim.");
  }

  const data = {
    name,
    description,
    status: status as "DRAFT" | "ACTIVE",
    layout: layout as "TWO_COLUMNS" | "THREE_COLUMNS" | "FOUR_COLUMNS",
    style: style as "MINIMAL" | "PREMIUM" | "WHOLESALE",
    priceMode: priceMode as "RETAIL" | "WHOLESALE" | "HIDE",
    stockMode: stockMode as "HIDE" | "EXACT" | "AVAILABILITY",
    isPublic,
    publicSlug: isPublic ? requestedSlug || null : null,
  };

  const catalog = await prisma.$transaction(async (tx) => {
    const result = id
      ? await tx.catalog.update({ where: { id }, data })
      : await tx.catalog.create({ data: { tenantId, ...data } });
    await tx.catalogProduct.deleteMany({ where: { catalogId: result.id } });
    await tx.catalogField.deleteMany({ where: { catalogId: result.id } });
    if (products.length) await tx.catalogProduct.createMany({ data: products.map((product, index) => ({ catalogId: result.id, productId: product.id, sortOrder: index })) });
    if (fields.length) await tx.catalogField.createMany({ data: fields.map((field, index) => ({ catalogId: result.id, fieldKey: field.key, enabled: Boolean(field.enabled), sortOrder: Number.isInteger(field.sortOrder) ? field.sortOrder : index })) });
    return result;
  });

  revalidatePath("/catalogs");
  revalidatePath(`/catalogs/${catalog.id}/edit`);
  if (catalog.publicSlug) revalidatePath(`/catalog/${catalog.publicSlug}`);
  redirect("/catalogs");
}

export async function deleteCatalog(formData: FormData) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const id = Number(asString(formData.get("catalogId")));
  if (!Number.isInteger(id)) return;
  await prisma.catalog.deleteMany({ where: { id, tenantId: currentUser.tenant!.id } });
  revalidatePath("/catalogs");
}

export async function duplicateCatalog(formData: FormData) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant!.id;
  const id = Number(asString(formData.get("catalogId")));
  const source = await prisma.catalog.findFirst({ where: { id, tenantId }, include: { products: true, fields: true } });
  if (!source) return;
  await prisma.catalog.create({ data: { tenantId, name: `${source.name} copy`, description: source.description, status: "DRAFT", layout: source.layout, style: source.style, priceMode: source.priceMode, stockMode: source.stockMode, products: { create: source.products.map((item) => ({ productId: item.productId, sortOrder: item.sortOrder })) }, fields: { create: source.fields.map((field) => ({ fieldKey: field.fieldKey, enabled: field.enabled, sortOrder: field.sortOrder })) } } });
  revalidatePath("/catalogs");
}
