import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SetStockPayload = {
  productId?: number;
  variantId?: number;
  stock?: number;
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
  const stock = Number(payload.stock);

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !Number.isInteger(variantId) ||
    variantId <= 0 ||
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
    },
  });

  if (!variant) {
    return NextResponse.json({ error: "Varianti nuk u gjet." }, { status: 404 });
  }

  await prisma.variant.update({
    where: { id: variantId },
    data: { stock },
  });

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);

  return NextResponse.json({ ok: true, stock });
}
