import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { activeTenantWarehouseWhere } from "@/lib/warehouse-scope";
import { setWarehouseInventoryStock } from "@/lib/warehouse-stock-write";

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

  const warehouse = await prisma.warehouse.findFirst({
    where: activeTenantWarehouseWhere(tenantId, warehouseId),
    select: { id: true },
  });
  if (!warehouse) {
    return NextResponse.json({ error: "Depoja nuk u gjet." }, { status: 404 });
  }

  const variant = await prisma.variant.findFirst({
    where: {
      id: variantId,
      productId,
      tenantId,
    },
    select: {
      id: true,
      size: true,
      color: true,
    },
  });

  if (!variant) {
    return NextResponse.json({ error: "Varianti nuk u gjet." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const previous = await setWarehouseInventoryStock(tx, variantId, warehouseId, stock, locationCode);

    await tx.variant.update({
      where: { id: variantId },
      data: {
        stock: {
          increment: stock - previous.previousStock,
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
          stock: previous.previousStock,
          locationCode: previous.previousLocationCode,
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
