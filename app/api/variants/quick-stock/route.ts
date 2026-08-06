import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

type StockUpdatePayload = {
  productId?: number;
  warehouseId?: number;
  reason?: string;
  updates?: Array<{
    variantId?: number;
    quantity?: number;
  }>;
};

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id;

  if (!currentUser || !tenantId || !hasRole(currentUser, ["SUPER_ADMIN", "WAREHOUSE"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: StockUpdatePayload;

  try {
    payload = (await request.json()) as StockUpdatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const productId = Number(payload.productId);
  const warehouseId = Number(payload.warehouseId);
  const reason =
    payload.reason === "CUSTOMER_RETURN" ? "CUSTOMER_RETURN" : "INCOMING_STOCK";
  const updates = (payload.updates ?? [])
    .map((item) => ({
      variantId: Number(item.variantId),
      quantity: Number(item.quantity),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.variantId) &&
        item.variantId > 0 &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0,
    );

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !Number.isInteger(warehouseId) ||
    warehouseId <= 0 ||
    updates.length === 0
  ) {
    return NextResponse.json({ error: "Missing stock updates" }, { status: 400 });
  }

  const variants = await prisma.variant.findMany({
    where: {
      tenantId,
      id: {
        in: updates.map((item) => item.variantId),
      },
      productId,
    },
    select: {
      id: true,
      stock: true,
      size: true,
      color: true,
      inventories: {
        where: { warehouseId },
        select: {
          id: true,
          stock: true,
        },
        take: 1,
      },
    },
  });

  if (variants.length !== updates.length) {
    return NextResponse.json({ error: "Some variants were not found" }, { status: 404 });
  }

  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      const variant = variantMap.get(update.variantId);

      if (!variant) {
        continue;
      }

      const inventory = variant.inventories[0];

      if (inventory) {
        await tx.variantInventory.update({
          where: { id: inventory.id },
          data: {
            stock: inventory.stock + update.quantity,
          },
        });
      } else {
        await tx.variantInventory.create({
          data: {
            variantId: update.variantId,
            warehouseId,
            stock: update.quantity,
          },
        });
      }

      await tx.variant.update({
        where: {
          id: update.variantId,
        },
        data: {
          stock: variant.stock + update.quantity,
        },
      });

      await tx.stockMovement.create({
        data: {
          tenantId,
          variantId: update.variantId,
          warehouseId,
          quantity: update.quantity,
          reason,
        },
      });
    }

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "QUICK_STOCK_ADDED",
      entityType: "STOCK",
      entityId: productId,
      entityLabel: `Produkti #${productId}`,
      warehouseId,
      metadata: {
        reason,
        updates: updates.map((update) => {
          const variant = variantMap.get(update.variantId);
          return {
            variantId: update.variantId,
            quantity: update.quantity,
            size: variant?.size ?? null,
            color: variant?.color ?? null,
          };
        }),
      },
    });
  });

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);

  return NextResponse.json({ ok: true });
}
