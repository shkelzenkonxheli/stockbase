"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createProductRecord(formData: FormData) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) return { error: "Nuk je i lidhur me nje biznes." };

  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim() || null;
  const warehouseName = String(formData.get("warehouseName") ?? "").trim();
  const categoryId = Number(formData.get("categoryId"));
  if (!name || name.length > 200 || (brand && brand.length > 100) || !Number.isSafeInteger(categoryId) || categoryId <= 0) {
    return { error: "Ploteso emrin dhe kategorine e produktit." };
  }

  const [category, warehouse] = await Promise.all([
    prisma.category.findFirst({ where: { id: categoryId, tenantId, isActive: true }, select: { id: true } }),
    warehouseName
      ? prisma.warehouse.findFirst({ where: { tenantId, name: warehouseName, isActive: true }, select: { name: true } })
      : Promise.resolve(null),
  ]);
  if (!category) return { error: "Kategoria nuk eshte valide per kete biznes." };
  if (warehouseName && !warehouse) return { error: "Depoja nuk eshte valide per kete biznes." };

  const existing = await prisma.product.findFirst({
    where: {
      tenantId,
      categoryId,
      name: { equals: name, mode: "insensitive" },
      brand: brand ? { equals: brand, mode: "insensitive" } : null,
    },
    select: { id: true },
  });
  if (existing) {
    return { error: "Ky produkt ekziston tashme. Shto nje variant te produkti ekzistues.", existingProductId: existing.id };
  }

  const product = await prisma.product.create({
    data: { tenantId, name, brand, warehouseName: warehouse?.name ?? null, categoryId },
    select: { id: true },
  });
  revalidatePath("/");
  revalidatePath("/products");
  return { productId: product.id };
}
