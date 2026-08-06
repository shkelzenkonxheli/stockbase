import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

type SetStockPayload = {
  productId?: number;
  variantId?: number;
  warehouseId?: number;
  stock?: number;
  locationCode?: string | null;
};

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id;

  if (!currentUser || !tenantId || !hasRole(currentUser, ["SUPER_ADMIN", "WAREHOUSE"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SetStockPayload;

  try {
    payload = (await request.json()) as SetStockPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const productId = Number(payload.productId);
  const variantId = Number(payload.variantId);
  const warehouseId = Number(payload.warehouseId);
  const stock = Number(payload.stock);
  const locationCode =
    typeof payload.locationCode === "string"
      ? payload.locationCode.trim() || null
      : null;

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !Number.isInteger(variantId) ||
    variantId <= 0 ||
    !Number.isInteger(warehouseId) ||
    warehouseId <= 0 ||
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    return NextResponse.json({ error: "Te dhenat nuk jane valide." }, { status: 400 });
  }

  const variant = await prisma.variant.findFirst({
    where: {
      id: variantId,
      productId,
      tenantId,
    },
    select: {
      id: true,
      stock: true,
      size: true,
      color: true,
      locationCode: true,
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

  if (!variant) {
    return NextResponse.json({ error: "Varianti nuk u gjet." }, { status: 404 });
  }

  const inventory = variant.inventories[0];
  const previousWarehouseStock = inventory?.stock ?? 0;

  await prisma.$transaction(async (tx) => {
    if (inventory) {
      await tx.variantInventory.update({
        where: { id: inventory.id },
        data: { stock, locationCode },
      });
    } else {
      await tx.variantInventory.create({
        data: {
          variantId,
          warehouseId,
          stock,
          locationCode,
        },
      });
    }

    await tx.variant.update({
      where: { id: variantId },
      data: {
        stock: {
          increment: stock - previousWarehouseStock,
        },
      },
    });

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "QUICK_STOCK_SET",
      entityType: "VARIANT",
      entityId: variantId,
      entityLabel: `${variant.color} / ${variant.size}`,
      warehouseId,
      metadata: {
        before: {
          stock: previousWarehouseStock,
          locationCode: variant.locationCode ?? null,
        },
        after: {
          stock,
          locationCode,
        },
      },
    });
  });

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);

  return NextResponse.json({ ok: true, stock, locationCode });
}
