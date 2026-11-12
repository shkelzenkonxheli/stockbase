"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { InsufficientStockError, removeWarehouseStock } from "@/lib/warehouse-stock-write";

export async function createQuickOrders(formData: FormData) {
  const currentUser = await requireRole(["SUPER_ADMIN", "SELLER"]);
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) {
    redirect("/login");
  }

  const source = formData.get("source")?.toString() as
    | "INSTAGRAM"
    | "STORE"
    | "WHOLESALE"
    | undefined;
  const warehouseId = Number(formData.get("warehouseId"));
  const rowsRaw = formData.get("rows")?.toString();
  const quickModal = formData.get("quickModal") === "1";
  const errorHref = (reason: string) => quickModal ? `/orders?quickOrderError=${reason}` : `/orders/quick?error=${reason}`;
  const customerName = String(formData.get("customerName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const instagram = String(formData.get("instagram") ?? "").trim();
  const posSessionIdValue = Number(formData.get("posSessionId"));
  const posSessionId = Number.isInteger(posSessionIdValue) && posSessionIdValue > 0 ? posSessionIdValue : null;

  if (!["INSTAGRAM", "STORE", "WHOLESALE"].includes(source ?? "") || !Number.isSafeInteger(warehouseId) || warehouseId <= 0 || !rowsRaw || customerName.length > 200 || phone.length > 60 || instagram.length > 100) {
    redirect(errorHref("validation"));
  }

  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId, isActive: true }, select: { id: true } });
  if (!warehouse) redirect(errorHref("warehouse"));

  let parsedRows: unknown;

  try {
    parsedRows = JSON.parse(rowsRaw);
  } catch {
    redirect(errorHref("validation"));
  }

  if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
    redirect(errorHref("validation"));
  }

  const rows = parsedRows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const candidate = row as {
        variantId?: unknown;
        quantity?: unknown;
        unitPrice?: unknown;
      };

      const variantId = Number(candidate.variantId);
      const quantity = Number(candidate.quantity);
      const unitPrice = Number(candidate.unitPrice);

      if (
        !Number.isSafeInteger(variantId) || variantId <= 0 ||
        !Number.isSafeInteger(quantity) || quantity <= 0 ||
        !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 99999999.99
      ) {
        return null;
      }

      return {
        variantId,
        quantity,
        unitPrice,
      };
    })
    .filter(
      (
        row,
      ): row is {
        variantId: number;
        quantity: number;
        unitPrice: number;
      } => row !== null,
    );

  if (rows.length === 0 || rows.length !== parsedRows.length) {
    redirect(errorHref("validation"));
  }

  const requestedByVariant = new Map<number, number>();

  for (const row of rows) {
    requestedByVariant.set(
      row.variantId,
      (requestedByVariant.get(row.variantId) ?? 0) + row.quantity,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    let posSession:
      | {
          id: number;
          warehouseId: number;
        }
      | null = null;

    if (posSessionId) {
      posSession = await tx.posSession.findFirst({
        where: {
          id: posSessionId,
          tenantId,
          status: "OPEN",
          warehouseId,
          ...(currentUser.role === "SUPER_ADMIN" ? {} : { openedById: currentUser.id }),
        },
        select: {
          id: true,
          warehouseId: true,
        },
      });

      if (!posSession) {
        return { ok: false as const, reason: "session" };
      }
    }

    const variants = await tx.variant.findMany({
      where: {
        tenantId,
        id: {
          in: [...requestedByVariant.keys()],
        },
      },
      select: {
        id: true,
        stock: true,
        productId: true,
        size: true,
        color: true,
        costPrice: true,
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

    if (variants.length !== requestedByVariant.size) {
      return { ok: false as const, reason: "variant" };
    }

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

    for (const [variantId, quantity] of requestedByVariant.entries()) {
      const variant = variantsById.get(variantId);

      const inventory = variant?.inventories[0];
      if (!variant || !inventory || inventory.stock < quantity) {
        return { ok: false as const, reason: "stock" };
      }
    }

    const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
    const primaryVariantId = rows[0]?.variantId;

    const order = await tx.order.create({
      data: {
        tenantId,
        customerName: customerName || "Quick Order",
        phone: phone || "-",
        instagram: instagram || null,
        source,
        status: "DONE",
        quantity: totalQuantity,
        variantId: primaryVariantId,
        warehouseId,
        posSessionId: posSession?.id ?? null,
      },
    });

    await tx.orderItem.createMany({
      data: rows.map((row) => ({
        orderId: order.id,
        variantId: row.variantId,
        warehouseId,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        unitCost: variantsById.get(row.variantId)?.costPrice ?? 0,
      })),
    });

    for (const [variantId, quantity] of requestedByVariant.entries()) {
      const variant = variantsById.get(variantId);
      const inventory = variant?.inventories[0];
      if (!variant || !inventory) {
        throw new InsufficientStockError();
      }

      await removeWarehouseStock(tx, inventory.id, variantId, quantity);
    }

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "ORDER_CREATED",
      entityType: "ORDER",
      entityId: order.id,
      entityLabel: customerName || "Quick Order",
      warehouseId,
      metadata: {
        source,
        orderId: order.id,
        posSessionId: posSession?.id ?? null,
        totalQuantity,
        rows: rows.map((row) => {
          const variant = variantsById.get(row.variantId);
          return {
            variantId: row.variantId,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            size: variant?.size ?? null,
            color: variant?.color ?? null,
          };
        }),
      },
    });

    return {
      ok: true as const,
      orderId: order.id,
      posSessionId: posSession?.id ?? null,
      productIds: [...new Set(variants.map((variant) => variant.productId))],
    };
  }).catch((error: unknown) => {
    if (error instanceof InsufficientStockError) redirect(errorHref("stock"));
    throw error;
  });

  if (!result.ok) {
    redirect(errorHref(result.reason));
  }

  revalidatePath("/");
  revalidatePath("/products");
  for (const productId of result.productIds) {
    revalidatePath(`/products/${productId}`);
  }
  revalidatePath("/orders");
  revalidatePath("/orders/new");
  revalidatePath("/orders/quick");
  if (result.posSessionId) {
    revalidatePath(`/pos/session/${result.posSessionId}`);
    redirect(`/pos/session/${result.posSessionId}?sale=1`);
  }

  redirect("/orders");
}

