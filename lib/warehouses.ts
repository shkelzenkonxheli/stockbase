import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import type { TenantCatalogConfig } from "@/lib/product-taxonomy";
import { getWarehouseConfig } from "@/lib/product-taxonomy";
import { writeAuditLog } from "@/lib/audit-log";

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

function dedupeWarehouseNames(values: string[]) {
  return values
    .map(normalizeWarehouseName)
    .filter(Boolean)
    .filter(
      (value, index, array) =>
        array.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index,
    );
}

export function getWarehouseNamesFromConfig(tenantConfig?: TenantCatalogConfig | null) {
  const config = getWarehouseConfig(tenantConfig);
  return dedupeWarehouseNames(config.options);
}

function hasWarehouseDelegate(value: unknown): value is {
  warehouse: {
    findMany: Function;
    findFirst: Function;
    create: Function;
    update: Function;
    updateMany: Function;
    count: Function;
    delete: Function;
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
    aggregate: Function;
    count: Function;
    findMany: Function;
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

  const names = dedupeWarehouseNames([
    ...configNames,
    ...productWarehouseNames
      .map((item) => item.warehouseName?.trim())
      .filter((value): value is string => Boolean(value)),
  ]);

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

async function getBootstrapWarehouseNames(tenantId: number, tenantConfig?: TenantCatalogConfig | null) {
  const configNames = getWarehouseNamesFromConfig(tenantConfig);
  const productWarehouseNames = await prisma.product.findMany({
    where: { tenantId, warehouseName: { not: null } },
    select: { warehouseName: true },
    distinct: ["warehouseName"],
  });

  return dedupeWarehouseNames([
    ...configNames,
    ...productWarehouseNames
      .map((item) => item.warehouseName ?? "")
      .filter(Boolean),
  ]);
}

async function buildUniqueWarehouseSlug(
  tenantId: number,
  name: string,
  excludedWarehouseId?: number,
) {
  const baseSlug = slugifyWarehouse(name) || "warehouse";
  let slug = baseSlug;
  let suffix = 2;

  while (
    await prisma.warehouse.findFirst({
      where: {
        tenantId,
        slug,
        ...(excludedWarehouseId ? { id: { not: excludedWarehouseId } } : {}),
      },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function syncTenantWarehouses(tenantId: number, tenantConfig?: TenantCatalogConfig | null) {
  if (!hasWarehouseDelegate(prisma)) {
    return getFallbackWarehouses(tenantId, tenantConfig);
  }

  const existingCount = await prisma.warehouse.count({ where: { tenantId } });
  if (existingCount > 0) {
    return prisma.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  const names = await getBootstrapWarehouseNames(tenantId, tenantConfig);
  if (names.length === 0) {
    return [];
  }

  await prisma.$transaction(
    names.map((name) =>
      prisma.warehouse.create({
        data: {
          tenantId,
          name,
          slug: slugifyWarehouse(name) || "warehouse",
          isActive: true,
        },
      }),
    ),
  );

  return prisma.warehouse.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
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

export async function getTenantWarehouseSummaries(
  tenantId: number,
  tenantConfig?: TenantCatalogConfig | null,
) {
  await syncTenantWarehouses(tenantId, tenantConfig);
  await ensureWarehouseInventoryRows(tenantId);

  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      tenantId: true,
      name: true,
      slug: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          inventories: true,
          orders: true,
          orderItems: true,
          stockMovements: true,
          inventoryCounts: true,
          auditLogs: true,
        },
      },
    },
  });

  const inventories = await prisma.variantInventory.groupBy({
    by: ["warehouseId"],
    where: {
      warehouse: {
        tenantId,
      },
    },
    _sum: { stock: true },
    _count: { variantId: true },
  });

  const assignedProducts = await prisma.product.groupBy({
    by: ["warehouseName"],
    where: {
      tenantId,
      warehouseName: { not: null },
    },
    _count: { warehouseName: true },
  });

  const inventoryMap = new Map(
    inventories.map((item) => [item.warehouseId, { totalStock: item._sum.stock ?? 0, variantCount: item._count.variantId }]),
  );
  const productMap = new Map(
    assignedProducts
      .filter((item) => item.warehouseName)
      .map((item) => [item.warehouseName!.toLowerCase(), item._count.warehouseName]),
  );

  return warehouses.map((warehouse) => ({
    ...warehouse,
    totalStock: inventoryMap.get(warehouse.id)?.totalStock ?? 0,
    variantCount: inventoryMap.get(warehouse.id)?.variantCount ?? 0,
    assignedProductCount: productMap.get(warehouse.name.toLowerCase()) ?? 0,
  }));
}

export async function createTenantWarehouse(input: {
  tenantId: number;
  userId?: number | null;
  name: string;
}) {
  const name = normalizeWarehouseName(input.name);
  if (!name) {
    throw new Error("Emri i depos eshte i detyrueshem.");
  }

  const existing = await prisma.warehouse.findFirst({
    where: {
      tenantId: input.tenantId,
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Kjo depo ekziston tashme.");
  }

  const slug = await buildUniqueWarehouseSlug(input.tenantId, name);

  return prisma.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.create({
      data: {
        tenantId: input.tenantId,
        name,
        slug,
        isActive: true,
      },
    });

    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: "WAREHOUSE_CREATED",
      entityType: "WAREHOUSE",
      entityId: warehouse.id,
      entityLabel: warehouse.name,
      warehouseId: warehouse.id,
    });

    return warehouse;
  });
}

export async function updateTenantWarehouse(input: {
  tenantId: number;
  warehouseId: number;
  userId?: number | null;
  name: string;
  isActive: boolean;
}) {
  const name = normalizeWarehouseName(input.name);
  if (!name) {
    throw new Error("Emri i depos eshte i detyrueshem.");
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, tenantId: input.tenantId },
    select: { id: true, name: true, isActive: true },
  });

  if (!warehouse) {
    throw new Error("Depoja nuk u gjet.");
  }

  const duplicate = await prisma.warehouse.findFirst({
    where: {
      tenantId: input.tenantId,
      id: { not: input.warehouseId },
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error("Ekziston nje depo tjeter me kete emer.");
  }

  if (!input.isActive && warehouse.isActive) {
    const [activeCount, stockSummary] = await Promise.all([
      prisma.warehouse.count({ where: { tenantId: input.tenantId, isActive: true } }),
      prisma.variantInventory.aggregate({
        where: { warehouseId: input.warehouseId },
        _sum: { stock: true },
      }),
    ]);

    if (activeCount <= 1) {
      throw new Error("Duhet te mbetet te pakten nje depo aktive.");
    }

    if ((stockSummary._sum.stock ?? 0) > 0) {
      throw new Error("Nuk mund ta caktivizosh depon derisa ka stok.");
    }
  }

  const slug = await buildUniqueWarehouseSlug(input.tenantId, name, input.warehouseId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.warehouse.update({
      where: { id: input.warehouseId },
      data: {
        name,
        slug,
        isActive: input.isActive,
      },
    });

    if (warehouse.name.toLowerCase() !== name.toLowerCase()) {
      await tx.product.updateMany({
        where: {
          tenantId: input.tenantId,
          warehouseName: { equals: warehouse.name, mode: "insensitive" },
        },
        data: {
          warehouseName: name,
        },
      });
    }

    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: "WAREHOUSE_UPDATED",
      entityType: "WAREHOUSE",
      entityId: updated.id,
      entityLabel: updated.name,
      warehouseId: updated.id,
      metadata: {
        before: { name: warehouse.name, isActive: warehouse.isActive },
        after: { name: updated.name, isActive: updated.isActive },
      } satisfies Prisma.InputJsonValue,
    });

    return updated;
  });
}

export async function deleteTenantWarehouse(input: {
  tenantId: number;
  warehouseId: number;
  userId?: number | null;
}) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, tenantId: input.tenantId },
    select: { id: true, name: true, isActive: true },
  });

  if (!warehouse) {
    throw new Error("Depoja nuk u gjet.");
  }

  const [inventoryStock, assignedProducts, ordersCount, orderItemsCount, stockMovementsCount, inventoryCountsCount, auditLogsCount] = await Promise.all([
    prisma.variantInventory.aggregate({
      where: { warehouseId: input.warehouseId },
      _sum: { stock: true },
    }),
    prisma.product.count({
      where: {
        tenantId: input.tenantId,
        warehouseName: { equals: warehouse.name, mode: "insensitive" },
      },
    }),
    prisma.order.count({ where: { tenantId: input.tenantId, warehouseId: input.warehouseId } }),
    prisma.orderItem.count({ where: { warehouse: { tenantId: input.tenantId }, warehouseId: input.warehouseId } }),
    prisma.stockMovement.count({ where: { tenantId: input.tenantId, warehouseId: input.warehouseId } }),
    prisma.inventoryCountSession.count({ where: { tenantId: input.tenantId, warehouseId: input.warehouseId } }),
    prisma.auditLog.count({ where: { tenantId: input.tenantId, warehouseId: input.warehouseId } }),
  ]);

  if ((inventoryStock._sum.stock ?? 0) > 0) {
    throw new Error("Nuk mund ta fshish depon derisa ka stok.");
  }

  if (assignedProducts > 0) {
    throw new Error("Nuk mund ta fshish depon derisa ka produkte te lidhura me te.");
  }

  if (ordersCount > 0 || orderItemsCount > 0 || stockMovementsCount > 0 || inventoryCountsCount > 0 || auditLogsCount > 0) {
    throw new Error("Depoja eshte perdorur ne histori dhe mund vetem te caktivizohet.");
  }

  await prisma.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: "WAREHOUSE_DELETED",
      entityType: "WAREHOUSE",
      entityId: warehouse.id,
      entityLabel: warehouse.name,
      warehouseId: warehouse.id,
    });

    await tx.product.updateMany({
      where: {
        tenantId: input.tenantId,
        warehouseName: { equals: warehouse.name, mode: "insensitive" },
      },
      data: { warehouseName: null },
    });

    await tx.warehouse.delete({ where: { id: input.warehouseId } });
  });
}
