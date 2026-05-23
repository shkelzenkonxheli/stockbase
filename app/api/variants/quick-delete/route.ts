import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id;

  if (!currentUser || !tenantId || !hasRole(currentUser, ["SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { productId?: number; variantId?: number };

  try {
    payload = (await request.json()) as { productId?: number; variantId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const productId = Number(payload.productId);
  const variantId = Number(payload.variantId);

  if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(variantId) || variantId <= 0) {
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
      orders: { select: { id: true }, take: 1 },
      items: { select: { id: true }, take: 1 },
    },
  });

  if (!variant) {
    return NextResponse.json({ error: "Varianti nuk u gjet." }, { status: 404 });
  }

  if (variant.orders.length > 0 || variant.items.length > 0) {
    return NextResponse.json(
      { error: "Ky variant nuk mund te fshihet sepse ka histori porosish." },
      { status: 409 },
    );
  }

  await prisma.variant.delete({
    where: { id: variantId },
  });

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);

  return NextResponse.json({
    ok: true,
    deletedVariantId: variantId,
  });
}
