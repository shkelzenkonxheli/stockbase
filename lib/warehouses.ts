import { prisma } from "@/lib/prisma";
import type { TenantCatalogConfig } from "@/lib/product-taxonomy";
import { getWarehouseConfig } from "@/lib/product-taxonomy";

function slugifyWarehouse(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeWarehouseName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function getWarehouseNamesFromConfig(tenantConfig?: TenantCatalogConfig | null) {
  const config = getWarehouseConfig(tenantConfig);
  return config.options
    .map(normalizeWarehouseName)
    .filter(Boolean)
    .filter((value, index, array) => array.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
}

function hasWarehouseDelegate(value: unknown): value is {
  warehouse: {
    findMany: Function;
    findFirst: Function;
    create: Function;
    update: Function;
    updateMany: Function;
  };
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "warehouse" in value &&
      (value as { warehouse?: unknown }).warehouse &&
      typeof (value as { warehouse: { findMany?: unknown } }).warehouse.findMany === "function",
  );
}

function hasVariantInventoryDelegate(value: unknown): value is {
  variantInventory: {
    create: Function;
  };
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "variantInventory" in value &&
      (value as { variantInventory?: unknown }).variantInventory &&
      typeof (value as { variantInventory: { create?: unknown } }).variantInventory.create === "function",
  );
}

async function getFallbackWarehouses(tenantId: number, tenantConfig?: TenantCatalogConfig | null) {
  const configNames = getWarehouseNamesFromConfig(tenantConfig);
  const productWarehouseNames = await prisma.product.findMany({
    where: { tenantId },
    select: { warehouseName: true },
    distinct: ["warehouseName"],
  });

  const names = [
    ...configNames,
    ...productWarehouseNames
      .map((item) => item.warehouseName?.trim())
      .filter((value): value is string => Boolean(value)),
  ].filter((value, index, array) => array.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);

  return names.map((name, index) => ({
    id: -(index + 1),
    tenantId,
    name,
    slug: slugifyWarehouse(name) || `warehouse-${index + 1}`,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
}

export async function syncTenantWarehouses(tenantId: number, tenantConfig?: TenantCatalogConfig | null) {
  const names = getWarehouseNamesFromConfig(tenantConfig);
  if (names.length === 0) {
    return [];
  }

  if (!hasWarehouseDelegate(prisma)) {
    return getFallbackWarehouses(tenantId, tenantConfig);
  }

  return prisma.$transaction(async (tx) => {
    if (!hasWarehouseDelegate(tx)) {
      return getFallbackWarehouses(tenantId, tenantConfig);
    }

    const existing = await tx.warehouse.findMany({
      where: { tenantId },
      select: { id: true, name: true, slug: true },
    });

    const byLowerName = new Map(existing.map((item) => [item.name.toLowerCase(), item]));
    const keepIds = new Set<number>();

    for (const name of names) {
      const existingWarehouse = byLowerName.get(name.toLowerCase());
      if (existingWarehouse) {
        keepIds.add(existingWarehouse.id);
        if (existingWarehouse.name !== name) {
          await tx.warehouse.update({
            where: { id: existingWarehouse.id },
            data: {
              name,
              slug: slugifyWarehouse(name) || `warehouse-${existingWarehouse.id}`,
              isActive: true,
            },
          });
        } else {
          await tx.warehouse.update({
            where: { id: existingWarehouse.id },
            data: { isActive: true },
          });
        }
        continue;
      }

      let baseSlug = slugifyWarehouse(name) || "warehouse";
      let slug = baseSlug;
      let suffix = 2;

      while (
        await tx.warehouse.findFirst({
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

      const created = await tx.warehouse.create({
        data: {
          tenantId,
          name,
          slug,
          isActive: true,
        },
        select: { id: true },
      });
      keepIds.add(created.id);
    }

    if (existing.length > 0) {
      await tx.warehouse.updateMany({
        where: {
          tenantId,
          id: {
            notIn: [...keepIds],
          },
        },
        data: {
          isActive: false,
        },
      });
    }

    return tx.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
  });
}

export async function ensureWarehouseInventoryRows(tenantId: number) {
  if (!hasWarehouseDelegate(prisma) || !hasVariantInventoryDelegate(prisma)) {
    return getFallbackWarehouses(tenantId);
  }

  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });

  if (warehouses.length === 0) {
    return [];
  }

  const variants = await prisma.variant.findMany({
    where: { tenantId },
    select: {
      id: true,
      stock: true,
      locationCode: true,
      product: {
        select: {
          warehouseName: true,
        },
      },
      inventories: {
        select: {
          warehouseId: true,
        },
      },
    },
  });

  const byName = new Map(warehouses.map((warehouse) => [warehouse.name.toLowerCase(), warehouse]));
  const fallbackWarehouse = warehouses[0];

  await prisma.$transaction(async (tx) => {
    if (!hasVariantInventoryDelegate(tx)) {
      return;
    }

    for (const variant of variants) {
      if (variant.inventories.length > 0) {
        continue;
      }

      const preferredName = variant.product.warehouseName?.trim().toLowerCase();
      const preferredWarehouse =
        (preferredName ? byName.get(preferredName) : null) ?? fallbackWarehouse;

      if (!preferredWarehouse) {
        continue;
      }

      await tx.variantInventory.create({
        data: {
          variantId: variant.id,
          warehouseId: preferredWarehouse.id,
          stock: variant.stock,
          locationCode: variant.locationCode,
        },
      });
    }
  });

  return warehouses;
}

export async function getTenantWarehouses(tenantId: number, tenantConfig?: TenantCatalogConfig | null) {
  await syncTenantWarehouses(tenantId, tenantConfig);
  await ensureWarehouseInventoryRows(tenantId);

  if (!hasWarehouseDelegate(prisma)) {
    return getFallbackWarehouses(tenantId, tenantConfig);
  }

  return prisma.warehouse.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
  });
}
