import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StockUpdatePayload = {
  productId?: number;
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

  if (!Number.isInteger(productId) || productId <= 0 || updates.length === 0) {
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
    },
  });

  if (variants.length !== updates.length) {
    return NextResponse.json({ error: "Some variants were not found" }, { status: 404 });
  }

  const variantMap = new Map(variants.map((variant) => [variant.id, variant.stock]));

  await prisma.$transaction(
    updates.flatMap((update) => {
      const currentStock = variantMap.get(update.variantId);

      if (currentStock === undefined) {
        return [];
      }

      return [
        prisma.variant.update({
          where: {
            id: update.variantId,
          },
          data: {
            stock: currentStock + update.quantity,
          },
        }),
        prisma.stockMovement.create({
          data: {
            tenantId,
            variantId: update.variantId,
            quantity: update.quantity,
            reason,
          },
        }),
      ];
    }),
  );

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);

  return NextResponse.json({ ok: true });
}
