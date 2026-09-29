import type { Prisma } from "@/app/generated/prisma/client";

export class InsufficientStockError extends Error {
  constructor() {
    super("INSUFFICIENT_STOCK");
  }
}

export async function removeWarehouseStock(tx: Prisma.TransactionClient, inventoryId: number, variantId: number, quantity: number) {
  const removed = await tx.variantInventory.updateMany({
    where: { id: inventoryId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  if (removed.count !== 1) throw new InsufficientStockError();
  const updated = await tx.variant.updateMany({
    where: { id: variantId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
  if (updated.count !== 1) throw new InsufficientStockError();
}

export async function addWarehouseStock(tx: Prisma.TransactionClient, variantId: number, warehouseId: number, quantity: number) {
  await tx.variantInventory.upsert({
    where: { variantId_warehouseId: { variantId, warehouseId } },
    create: { variantId, warehouseId, stock: quantity },
    update: { stock: { increment: quantity } },
  });
  await tx.variant.update({ where: { id: variantId }, data: { stock: { increment: quantity } } });
}

export async function setWarehouseInventoryStock(
  tx: Prisma.TransactionClient,
  variantId: number,
  warehouseId: number,
  stock: number,
  locationCode: string | null,
) {
  // A no-op increment takes the inventory row lock before reading its current stock.
  const inventory = await tx.variantInventory.upsert({
    where: { variantId_warehouseId: { variantId, warehouseId } },
    create: { variantId, warehouseId, stock: 0 },
    update: { stock: { increment: 0 } },
    select: { id: true, stock: true, locationCode: true },
  });
  await tx.variantInventory.update({ where: { id: inventory.id }, data: { stock, locationCode } });
  return { previousStock: inventory.stock, previousLocationCode: inventory.locationCode };
}
