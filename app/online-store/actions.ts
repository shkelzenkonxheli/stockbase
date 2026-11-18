"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SaveState = { message: string; error: boolean };

function value(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function selection(data: FormData, key: string): number[] | null {
  try {
    const ids: unknown = JSON.parse(value(data, key));
    if (Array.isArray(ids) && ids.every((id) => Number.isSafeInteger(id) && id > 0)) {
      return [...new Set<number>(ids)];
    }
  } catch {
    return null;
  }
  return null;
}

function isLogoUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function saveOnlineStore(_previous: SaveState, form: FormData): Promise<SaveState> {
  const { tenant } = await requireRole(["SUPER_ADMIN"]);
  const tenantId = tenant!.id;
  const name = value(form, "name");
  const logoUrl = value(form, "logoUrl");
  const whatsappNumber = value(form, "whatsappNumber").replace(/[\s()+-]/g, "");
  const warehouseValue = value(form, "warehouseId");
  const warehouseId = warehouseValue ? Number(warehouseValue) : null;
  const categoryIds = selection(form, "categoryIds");
  const productIds = selection(form, "productIds");

  if (!name || name.length > 100 || (logoUrl && (logoUrl.length > 512 || !isLogoUrl(logoUrl)))) {
    return { message: "Shkruaj emrin e dyqanit dhe përdor një URL HTTPS për logon.", error: true };
  }
  if (whatsappNumber && !/^[1-9]\d{6,14}$/.test(whatsappNumber)) {
    return { message: "Shkruaj numrin e WhatsApp-it me prefiksin ndërkombëtar.", error: true };
  }
  if (!categoryIds || !productIds || (warehouseId !== null && (!Number.isSafeInteger(warehouseId) || warehouseId <= 0))) {
    return { message: "Përzgjedhja nuk është e vlefshme.", error: true };
  }

  try {
    const [categories, products, warehouse] = await Promise.all([
      prisma.category.count({ where: { tenantId, isActive: true, id: { in: categoryIds } } }),
      prisma.product.count({ where: { tenantId, id: { in: productIds } } }),
      warehouseId === null ? null : prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId, isActive: true }, select: { id: true } }),
    ]);
    if (categories !== categoryIds.length || products !== productIds.length || (warehouseId !== null && !warehouse)) {
      return { message: "Disa zgjedhje nuk janë më të vlefshme. Rifresko faqen dhe provo përsëri.", error: true };
    }

    const data = { name, logoUrl: logoUrl || null, whatsappNumber: whatsappNumber || null, warehouseId, categoryIds, productIds };
    await prisma.onlineStore.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  } catch (error) {
    console.error("Unable to save online store configuration", error);
    return { message: "Cilësimet nuk u ruajtën. Provo përsëri.", error: true };
  }

  revalidatePath("/online-store");
  return { message: "Ndryshimet u ruajtën.", error: false };
}

