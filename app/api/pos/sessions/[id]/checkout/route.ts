import { Prisma } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getPosApiContext } from "@/lib/pos";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string }>;
};

type CheckoutItem = {
  variantId: number;
  quantity: number;
  unitPrice: number | null;
};

type DiscountType = "PERCENT" | "FIXED";

function parseItems(value: unknown): CheckoutItem[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const quantities = new Map<number, { quantity: number; unitPrice: number | null }>();
  for (const row of value) {
    if (!row || typeof row !== "object") {
      return null;
    }

    const candidate = row as { variantId?: unknown; quantity?: unknown; unitPrice?: unknown };
    const variantId = Number(candidate.variantId);
    const quantity = Number(candidate.quantity);
    const unitPrice =
      candidate.unitPrice === undefined || candidate.unitPrice === null || candidate.unitPrice === ""
        ? null
        : Number(candidate.unitPrice);
    if (
      !Number.isInteger(variantId) ||
      variantId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0))
    ) {
      return null;
    }

    const current = quantities.get(variantId);
    if (current) {
      current.quantity += quantity;
      if (unitPrice !== null) current.unitPrice = unitPrice;
    } else {
      quantities.set(variantId, { quantity, unitPrice });
    }
  }

  return [...quantities.entries()].map(([variantId, item]) => ({ variantId, ...item }));
}

export async function POST(request: Request, context: RouteProps) {
  const apiContext = await getPosApiContext(["SUPER_ADMIN", "SELLER"]);
  if (!apiContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ error: "POS session invalid." }, { status: 400 });
  }

  let payload: { items?: unknown; paymentMethod?: unknown; receivedCash?: unknown; discountType?: unknown; discountValue?: unknown };
  try {
    payload = (await request.json()) as { items?: unknown; paymentMethod?: unknown; receivedCash?: unknown; discountType?: unknown; discountValue?: unknown };
  } catch {
    return NextResponse.json({ error: "Payload nuk eshte valid." }, { status: 400 });
  }

  const items = parseItems(payload.items);
  const paymentMethod = payload.paymentMethod === "CASH" || payload.paymentMethod === "CARD"
    ? payload.paymentMethod
    : null;
  const receivedCash = Number(payload.receivedCash ?? 0);
  const discountType: DiscountType | null = payload.discountType === "PERCENT" || payload.discountType === "FIXED"
    ? payload.discountType
    : null;
  const discountValue = Number(payload.discountValue ?? 0);

  if (!items || !paymentMethod || !Number.isFinite(discountValue) || discountValue < 0 || (discountValue > 0 && !discountType) || (discountType === "PERCENT" && discountValue > 100)) {
    return NextResponse.json({ error: "Cart-i dhe menyra e pageses jane te detyrueshme." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.posSession.findFirst({
        where: {
          id: sessionId,
          tenantId: apiContext.tenantId,
          status: "OPEN",
          ...(apiContext.currentUser.role === "SUPER_ADMIN" ? {} : { openedById: apiContext.currentUser.id }),
        },
        select: {
          id: true,
          warehouseId: true,
          register: { select: { name: true } },
        },
      });

      if (!session) {
        throw new Error("SESSION_NOT_AVAILABLE");
      }

      const variants = await tx.variant.findMany({
        where: {
          id: { in: items.map((item) => item.variantId) },
          // Some legacy variants predate Variant.tenantId. Product ownership is the authoritative tenant scope.
          product: { tenantId: apiContext.tenantId },
        },
        select: {
          id: true,
          productId: true,
          price: true,
          costPrice: true,
          size: true,
          color: true,
          inventories: {
            where: { warehouseId: session.warehouseId },
            select: { id: true, stock: true },
            take: 1,
          },
        },
      });

      if (variants.length !== items.length) {
        throw new Error("VARIANT_NOT_FOUND");
      }

      const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
      const subtotal = items.reduce((sum, item) => {
        const variant = variantsById.get(item.variantId);
        return sum + (item.unitPrice ?? Number(variant?.price ?? 0)) * item.quantity;
      }, 0);
      const subtotalRounded = Number(subtotal.toFixed(2));
      const discountAmount = discountType === "PERCENT"
        ? Number((subtotalRounded * (discountValue / 100)).toFixed(2))
        : Number(discountValue.toFixed(2));
      if (discountAmount > subtotalRounded) throw new Error("DISCOUNT_INVALID");
      const totalRounded = Number((subtotalRounded - discountAmount).toFixed(2));

      if (paymentMethod === "CASH" && (!Number.isFinite(receivedCash) || receivedCash < totalRounded)) {
        throw new Error("CASH_NOT_ENOUGH");
      }

      for (const item of items) {
        const inventory = variantsById.get(item.variantId)?.inventories[0];
        if (!inventory) {
          throw new Error("STOCK_NOT_AVAILABLE");
        }

        const updated = await tx.variantInventory.updateMany({
          where: { id: inventory.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          throw new Error("STOCK_NOT_AVAILABLE");
        }

        await tx.variant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const order = await tx.order.create({
        data: {
          tenantId: apiContext.tenantId,
          customerName: "POS sale",
          phone: "-",
          source: "STORE",
          status: "DONE",
          quantity: totalQuantity,
          variantId: items[0]?.variantId ?? null,
          warehouseId: session.warehouseId,
          posSessionId: session.id,
          subtotal: new Prisma.Decimal(subtotalRounded.toFixed(2)),
          discountType,
          discountValue: new Prisma.Decimal(discountValue.toFixed(2)),
          discountAmount: new Prisma.Decimal(discountAmount.toFixed(2)),
          items: {
            create: items.map((item) => {
              const variant = variantsById.get(item.variantId)!;
              return {
                variantId: item.variantId,
                warehouseId: session.warehouseId,
                quantity: item.quantity,
                unitPrice: new Prisma.Decimal((item.unitPrice ?? Number(variant.price)).toFixed(2)),
                unitCost: new Prisma.Decimal(Number(variant.costPrice).toFixed(2)),
              };
            }),
          },
        },
      });

      await tx.posPayment.create({
        data: {
          tenantId: apiContext.tenantId,
          posSessionId: session.id,
          orderId: order.id,
          method: paymentMethod,
          amount: new Prisma.Decimal(totalRounded.toFixed(2)),
        },
      });

      await tx.stockMovement.createMany({
        data: items.map((item) => ({
          tenantId: apiContext.tenantId,
          variantId: item.variantId,
          warehouseId: session.warehouseId,
          quantity: -item.quantity,
          reason: "POS_SALE",
        })),
      });

      await writeAuditLog(tx, {
        tenantId: apiContext.tenantId,
        userId: apiContext.currentUser.id,
        action: "POS_SALE_CREATED",
        entityType: "ORDER",
        entityId: order.id,
        entityLabel: `POS sale #${order.id}`,
        warehouseId: session.warehouseId,
        metadata: {
          posSessionId: session.id,
          registerName: session.register.name,
          paymentMethod,
          total: totalRounded,
          subtotal: subtotalRounded,
          discountType,
          discountValue,
          discountAmount,
          totalQuantity,
          items,
        },
      });

      return { orderId: order.id, subtotal: subtotalRounded, discountAmount, total: totalRounded };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout deshtoi.";
    console.error("POS checkout failed", {
      tenantId: apiContext.tenantId,
      sessionId,
      message,
    });
    const errors: Record<string, string> = {
      SESSION_NOT_AVAILABLE: "POS session nuk eshte aktiv ose nuk ke akses.",
      VARIANT_NOT_FOUND: "Nje produkt ne cart nuk ekziston me.",
      STOCK_NOT_AVAILABLE: "Stoku nuk mjafton per nje nga produktet.",
      CASH_NOT_ENOUGH: "Shuma cash e pranuar nuk mjafton.",
      DISCOUNT_INVALID: "Zbritja nuk mund te jete me e madhe se nentotali.",
    };
    return NextResponse.json({ error: errors[message] ?? "Checkout deshtoi." }, { status: 400 });
  }
}
