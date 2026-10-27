import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { parseStockTransferAdjustments, type StockTransferAdjustment } from "@/lib/stock-transfer";

export type StockTransferFailure = "validation" | "same-warehouse" | "warehouse" | "variant" | "stock";

export async function createStockTransfer(input: {
  tenantId: number;
  userId: number;
  fromWarehouseId: number;
  toWarehouseId: number;
  adjustments: StockTransferAdjustment[];
}): Promise<{ ok: true; productIds: number[] } | { ok: false; reason: StockTransferFailure }> {
  const { tenantId, userId, fromWarehouseId, toWarehouseId } = input;
  const adjustments = parseStockTransferAdjustments(JSON.stringify(input.adjustments));
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0 ||
      !Number.isSafeInteger(fromWarehouseId) || fromWarehouseId <= 0 ||
      !Number.isSafeInteger(toWarehouseId) || toWarehouseId <= 0 || !adjustments) {
    return { ok: false, reason: "validation" };
  }
  if (fromWarehouseId === toWarehouseId) return { ok: false, reason: "same-warehouse" };

  try {
    return await prisma.$transaction(async (tx) => {
      const warehouses = await tx.warehouse.findMany({
        where: { id: { in: [fromWarehouseId, toWarehouseId] }, tenantId, isActive: true },
        select: { id: true, name: true },
      });
      if (warehouses.length !== 2) return { ok: false as const, reason: "warehouse" as const };

      const variants = await tx.variant.findMany({
        where: { tenantId, product: { tenantId }, id: { in: adjustments.map((item) => item.variantId) } },
        select: {
          id: true,
          productId: true,
          product: { select: { name: true } },
          size: true,
          color: true,
          inventories: {
            where: { warehouseId: fromWarehouseId },
            select: { id: true, warehouseId: true, stock: true },
          },
        },
      });
      if (variants.length !== adjustments.length) return { ok: false as const, reason: "variant" as const };

      const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
      for (const adjustment of adjustments) {
        const source = variantsById.get(adjustment.variantId)?.inventories[0];
        if (!source || source.stock < adjustment.quantity) return { ok: false as const, reason: "stock" as const };
      }

      for (const adjustment of adjustments) {
        const source = variantsById.get(adjustment.variantId)!.inventories[0];
        const removed = await tx.variantInventory.updateMany({
          where: { id: source.id, stock: { gte: adjustment.quantity } },
          data: { stock: { decrement: adjustment.quantity } },
        });
        if (removed.count !== 1) throw new Error("INSUFFICIENT_TRANSFER_STOCK");

        await tx.variantInventory.upsert({
          where: { variantId_warehouseId: { variantId: adjustment.variantId, warehouseId: toWarehouseId } },
          create: { variantId: adjustment.variantId, warehouseId: toWarehouseId, stock: adjustment.quantity },
          update: { stock: { increment: adjustment.quantity } },
        });
        await tx.stockMovement.createMany({
          data: [
            { tenantId, variantId: adjustment.variantId, warehouseId: fromWarehouseId, quantity: -adjustment.quantity, reason: "TRANSFER" },
            { tenantId, variantId: adjustment.variantId, warehouseId: toWarehouseId, quantity: adjustment.quantity, reason: "TRANSFER" },
          ],
        });
      }

      await writeAuditLog(tx, {
        tenantId,
        userId,
        action: "STOCK_TRANSFER_CREATED",
        entityType: "TRANSFER",
        entityLabel: `${warehouses.find((item) => item.id === fromWarehouseId)?.name} -> ${warehouses.find((item) => item.id === toWarehouseId)?.name}`,
        warehouseId: toWarehouseId,
        metadata: {
          fromWarehouseId,
          toWarehouseId,
          adjustments: adjustments.map((adjustment) => {
            const variant = variantsById.get(adjustment.variantId);
            return {
              variantId: adjustment.variantId,
              productId: variant?.productId ?? null,
              productName: variant?.product.name ?? null,
              quantity: adjustment.quantity,
              size: variant?.size ?? null,
              color: variant?.color ?? null,
            };
          }),
        },
      });

      return { ok: true as const, productIds: [...new Set(variants.map((variant) => variant.productId))] };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_TRANSFER_STOCK") return { ok: false, reason: "stock" };
    throw error;
  }
}

export function revalidateStockTransferPaths(productIds: number[]) {
  revalidatePath("/");
  revalidatePath("/products");
  for (const productId of productIds) revalidatePath(`/products/${productId}`);
  revalidatePath("/stock/incoming");
  revalidatePath("/stock/transfer");
  revalidatePath("/orders/new");
  revalidatePath("/orders/quick");
}
