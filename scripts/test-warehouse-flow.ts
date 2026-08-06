import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { Pool } from "pg";

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function slugifyWarehouse(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  assertCondition(connectionString, "DIRECT_URL or DATABASE_URL is required.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString })),
  });

  const testName = `warehouse-flow-${Date.now()}`;
  let createdProductId: number | null = null;
  const createdWarehouseIds: number[] = [];

  try {
    const tenant = await prisma.tenant.findFirst({
      select: {
        id: true,
        warehouses: {
          where: { isActive: true },
          orderBy: { id: "asc" },
          select: { id: true, name: true },
        },
        categories: {
          where: { isActive: true },
          orderBy: { id: "asc" },
          select: { id: true, name: true },
          take: 1,
        },
        settings: {
          select: {
            catalogConfig: true,
          },
        },
      },
    });

    assertCondition(tenant?.id, "No tenant found in test database.");
    assertCondition(tenant.categories.length > 0, "At least 1 active category is required.");

    const configWarehouseNames = Array.isArray(
      (tenant.settings?.catalogConfig as { warehouse?: { options?: unknown } } | null)?.warehouse?.options,
    )
      ? (
          (tenant.settings?.catalogConfig as { warehouse?: { options?: string[] } } | null)?.warehouse?.options ??
          []
        )
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    const productWarehouseNames = await prisma.product.findMany({
      where: {
        tenantId: tenant.id,
        warehouseName: {
          not: null,
        },
      },
      distinct: ["warehouseName"],
      select: {
        warehouseName: true,
      },
      take: 10,
    });

    const wantedWarehouseNames = [...new Set([...configWarehouseNames, ...productWarehouseNames
      .map((item) => item.warehouseName?.trim())
      .filter((value): value is string => Boolean(value))])];

    for (const warehouseName of wantedWarehouseNames) {
      await prisma.warehouse.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name: warehouseName,
          },
        },
        update: {
          isActive: true,
        },
        create: {
          tenantId: tenant.id,
          name: warehouseName,
          slug: slugifyWarehouse(warehouseName) || `warehouse-${Date.now()}`,
          isActive: true,
        },
      });
    }

    let warehouses = await prisma.warehouse.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
      take: 2,
    });

    if (warehouses.length < 2) {
      const fallbackNames = [`${testName}-depo-1`, `${testName}-depo-2`];

      for (const warehouseName of fallbackNames) {
        const createdWarehouse = await prisma.warehouse.create({
          data: {
            tenantId: tenant.id,
            name: warehouseName,
            slug: slugifyWarehouse(warehouseName),
            isActive: true,
          },
          select: { id: true },
        });
        createdWarehouseIds.push(createdWarehouse.id);
      }

      warehouses = await prisma.warehouse.findMany({
        where: {
          tenantId: tenant.id,
          id: {
            in: createdWarehouseIds,
          },
        },
        orderBy: { id: "asc" },
        select: { id: true, name: true },
      });
    }

    assertCondition(warehouses.length >= 2, "At least 2 warehouses are required.");

    const [fromWarehouse, toWarehouse] = warehouses;
    const category = tenant.categories[0];

    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: category.id,
        name: testName,
        brand: "TEST",
        warehouseName: fromWarehouse.name,
      },
      select: { id: true },
    });
    createdProductId = product.id;

    const variant = await prisma.variant.create({
      data: {
        tenantId: tenant.id,
        productId: product.id,
        size: "standard",
        color: "black",
        variantIdentityKey: "black::standard",
        stock: 0,
        price: "10.00",
      },
      select: { id: true },
    });

    console.log(`Created test product ${product.id} and variant ${variant.id}.`);

    await prisma.$transaction(async (tx) => {
      await tx.variantInventory.create({
        data: {
          variantId: variant.id,
          warehouseId: fromWarehouse.id,
          stock: 20,
          locationCode: "T-01",
        },
      });

      await tx.variant.update({
        where: { id: variant.id },
        data: {
          stock: {
            increment: 20,
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          tenantId: tenant.id,
          variantId: variant.id,
          warehouseId: fromWarehouse.id,
          quantity: 20,
          reason: "INCOMING_STOCK",
        },
      });
    });

    let currentVariant = await prisma.variant.findUniqueOrThrow({
      where: { id: variant.id },
      select: {
        stock: true,
        inventories: {
          orderBy: { warehouseId: "asc" },
          select: { warehouseId: true, stock: true },
        },
      },
    });

    assertCondition(currentVariant.stock === 20, "Incoming stock failed: variant.stock should be 20.");
    assertCondition(
      currentVariant.inventories.length === 1 &&
        currentVariant.inventories[0].warehouseId === fromWarehouse.id &&
        currentVariant.inventories[0].stock === 20,
      "Incoming stock failed: source warehouse inventory should be 20.",
    );
    console.log("Incoming stock test passed.");

    await prisma.$transaction(async (tx) => {
      const sourceInventory = await tx.variantInventory.findUniqueOrThrow({
        where: {
          variantId_warehouseId: {
            variantId: variant.id,
            warehouseId: fromWarehouse.id,
          },
        },
        select: { id: true, stock: true },
      });

      assertCondition(sourceInventory.stock >= 7, "Transfer precondition failed: source stock below 7.");

      await tx.variantInventory.update({
        where: { id: sourceInventory.id },
        data: {
          stock: {
            decrement: 7,
          },
        },
      });

      await tx.variantInventory.upsert({
        where: {
          variantId_warehouseId: {
            variantId: variant.id,
            warehouseId: toWarehouse.id,
          },
        },
        update: {
          stock: {
            increment: 7,
          },
        },
        create: {
          variantId: variant.id,
          warehouseId: toWarehouse.id,
          stock: 7,
        },
      });

      await tx.stockMovement.createMany({
        data: [
          {
            tenantId: tenant.id,
            variantId: variant.id,
            warehouseId: fromWarehouse.id,
            quantity: -7,
            reason: "TRANSFER",
          },
          {
            tenantId: tenant.id,
            variantId: variant.id,
            warehouseId: toWarehouse.id,
            quantity: 7,
            reason: "TRANSFER",
          },
        ],
      });
    });

    currentVariant = await prisma.variant.findUniqueOrThrow({
      where: { id: variant.id },
      select: {
        stock: true,
        inventories: {
          orderBy: { warehouseId: "asc" },
          select: { warehouseId: true, stock: true },
        },
      },
    });

    const sourceAfterTransfer =
      currentVariant.inventories.find((inventory) => inventory.warehouseId === fromWarehouse.id)?.stock ?? -1;
    const targetAfterTransfer =
      currentVariant.inventories.find((inventory) => inventory.warehouseId === toWarehouse.id)?.stock ?? -1;

    assertCondition(currentVariant.stock === 20, "Transfer failed: variant.stock should remain 20.");
    assertCondition(sourceAfterTransfer === 13, "Transfer failed: source warehouse should be 13.");
    assertCondition(targetAfterTransfer === 7, "Transfer failed: target warehouse should be 7.");
    console.log("Transfer stock test passed.");

    const order = await prisma.$transaction(async (tx) => {
      const targetInventory = await tx.variantInventory.findUniqueOrThrow({
        where: {
          variantId_warehouseId: {
            variantId: variant.id,
            warehouseId: toWarehouse.id,
          },
        },
        select: { id: true, stock: true },
      });

      assertCondition(targetInventory.stock >= 3, "Order precondition failed: target stock below 3.");

      const createdOrder = await tx.order.create({
        data: {
          tenantId: tenant.id,
          customerName: "Warehouse Flow Test",
          phone: "000",
          source: "STORE",
          status: "DONE",
          quantity: 3,
          variantId: variant.id,
          warehouseId: toWarehouse.id,
          items: {
            create: {
              variantId: variant.id,
              warehouseId: toWarehouse.id,
              quantity: 3,
              unitPrice: "10.00",
            },
          },
        },
        select: { id: true },
      });

      await tx.variantInventory.update({
        where: { id: targetInventory.id },
        data: {
          stock: {
            decrement: 3,
          },
        },
      });

      await tx.variant.update({
        where: { id: variant.id },
        data: {
          stock: {
            decrement: 3,
          },
        },
      });

      return createdOrder;
    });

    currentVariant = await prisma.variant.findUniqueOrThrow({
      where: { id: variant.id },
      select: {
        stock: true,
        inventories: {
          orderBy: { warehouseId: "asc" },
          select: { warehouseId: true, stock: true },
        },
      },
    });

    const targetAfterOrder =
      currentVariant.inventories.find((inventory) => inventory.warehouseId === toWarehouse.id)?.stock ?? -1;

    assertCondition(currentVariant.stock === 17, "Order failed: variant.stock should be 17.");
    assertCondition(targetAfterOrder === 4, "Order failed: target warehouse should be 4.");
    console.log("Order creation test passed.");

    await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        select: {
          id: true,
          status: true,
          quantity: true,
          variantId: true,
          warehouseId: true,
          items: {
            select: {
              variantId: true,
              quantity: true,
              warehouseId: true,
            },
          },
        },
      });

      assertCondition(existingOrder.status !== "CANCELED", "Delete-order precondition failed.");

      for (const item of existingOrder.items) {
        assertCondition(item.warehouseId, "Delete-order failed: missing warehouseId on order item.");

        await tx.variantInventory.upsert({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: item.warehouseId,
            },
          },
          update: {
            stock: {
              increment: item.quantity,
            },
          },
          create: {
            variantId: item.variantId,
            warehouseId: item.warehouseId,
            stock: item.quantity,
          },
        });

        await tx.variant.update({
          where: { id: item.variantId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      await tx.order.delete({
        where: { id: existingOrder.id },
      });
    });

    currentVariant = await prisma.variant.findUniqueOrThrow({
      where: { id: variant.id },
      select: {
        stock: true,
        inventories: {
          orderBy: { warehouseId: "asc" },
          select: { warehouseId: true, stock: true },
        },
      },
    });

    const targetAfterDelete =
      currentVariant.inventories.find((inventory) => inventory.warehouseId === toWarehouse.id)?.stock ?? -1;
    const totalInventory = currentVariant.inventories.reduce((sum, inventory) => sum + inventory.stock, 0);

    assertCondition(currentVariant.stock === 20, "Delete order failed: variant.stock should be back to 20.");
    assertCondition(targetAfterDelete === 7, "Delete order failed: target warehouse should be back to 7.");
    assertCondition(totalInventory === currentVariant.stock, "Delete order failed: inventory sum must equal variant.stock.");
    console.log("Order delete test passed.");

    console.log("Warehouse flow test completed successfully.");
  } finally {
    if (createdProductId) {
      await prisma.product.delete({
        where: { id: createdProductId },
      }).catch(() => undefined);
    }
    if (createdWarehouseIds.length > 0) {
      await prisma.warehouse.deleteMany({
        where: {
          id: {
            in: createdWarehouseIds,
          },
        },
      }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
