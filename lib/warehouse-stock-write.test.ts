import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@/app/generated/prisma/client";
import { addWarehouseStock, InsufficientStockError, removeWarehouseStock, setWarehouseInventoryStock } from "./warehouse-stock-write";

test("a concurrent sale cannot decrement an inventory that no longer has enough stock", async () => {
  const calls: unknown[] = [];
  const tx = {
    variantInventory: { updateMany: async (args: unknown) => { calls.push(["inventory", args]); return { count: 0 }; } },
    variant: { update: async (args: unknown) => { calls.push(["variant", args]); } },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(removeWarehouseStock(tx, 8, 12, 5), InsufficientStockError);
  assert.deepEqual(calls, [["inventory", { where: { id: 8, stock: { gte: 5 } }, data: { stock: { decrement: 5 } } }]]);
});

test("a sale checks aggregate stock after claiming warehouse stock", async () => {
  const calls: unknown[] = [];
  const tx = {
    variantInventory: { updateMany: async (args: unknown) => { calls.push(["inventory", args]); return { count: 1 }; } },
    variant: { updateMany: async (args: unknown) => { calls.push(["variant", args]); return { count: 0 }; } },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(removeWarehouseStock(tx, 8, 12, 5), InsufficientStockError);
  assert.deepEqual(calls[1], ["variant", { where: { id: 12, stock: { gte: 5 } }, data: { stock: { decrement: 5 } } }]);
});

test("incoming stock increments inventory and variant inside one transaction", async () => {
  const calls: unknown[] = [];
  const tx = {
    variantInventory: { upsert: async (args: unknown) => { calls.push(["inventory", args]); } },
    variant: { update: async (args: unknown) => { calls.push(["variant", args]); } },
  } as unknown as Prisma.TransactionClient;
  await addWarehouseStock(tx, 12, 3, 5);
  assert.deepEqual(calls, [
    ["inventory", { where: { variantId_warehouseId: { variantId: 12, warehouseId: 3 } }, create: { variantId: 12, warehouseId: 3, stock: 5 }, update: { stock: { increment: 5 } } }],
    ["variant", { where: { id: 12 }, data: { stock: { increment: 5 } } }],
  ]);
});

test("absolute stock reads the locked current inventory before setting it", async () => {
  const calls: unknown[] = [];
  const tx = {
    variantInventory: {
      upsert: async (args: unknown) => { calls.push(["lock", args]); return { id: 8, stock: 7, locationCode: "A1" }; },
      update: async (args: unknown) => { calls.push(["set", args]); },
    },
  } as unknown as Prisma.TransactionClient;
  const previous = await setWarehouseInventoryStock(tx, 12, 3, 9, "B2");
  assert.deepEqual(previous, { previousStock: 7, previousLocationCode: "A1" });
  assert.deepEqual(calls, [
    ["lock", { where: { variantId_warehouseId: { variantId: 12, warehouseId: 3 } }, create: { variantId: 12, warehouseId: 3, stock: 0 }, update: { stock: { increment: 0 } }, select: { id: true, stock: true, locationCode: true } }],
    ["set", { where: { id: 8 }, data: { stock: 9, locationCode: "B2" } }],
  ]);
});
