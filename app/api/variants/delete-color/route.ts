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

  let payload: { productId?: number; color?: string };

  try {
    payload = (await request.json()) as { productId?: number; color?: string };
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const productId = Number(payload.productId);
  const color = String(payload.color ?? "").trim();

  if (!Number.isInteger(productId) || productId <= 0 || !color) {
    return NextResponse.json({ error: "Te dhenat nuk jane valide." }, { status: 400 });
  }

  const variants = await prisma.variant.findMany({
    where: {
      tenantId,
      productId,
      color: {
        equals: color,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      productId: true,
    },
  });

  if (variants.length === 0) {
    return NextResponse.json({ error: "Ngjyra nuk u gjet." }, { status: 404 });
  }

  const variantIds = variants.map((variant) => variant.id);

  const [linkedOrdersCount, linkedOrderItemsCount] = await Promise.all([
    prisma.order.count({
      where: {
        variantId: {
          in: variantIds,
        },
      },
    }),
    prisma.orderItem.count({
      where: {
        variantId: {
          in: variantIds,
        },
      },
    }),
  ]);

  if (linkedOrdersCount > 0 || linkedOrderItemsCount > 0) {
    return NextResponse.json(
      {
        error:
          "Kjo ngjyre nuk mund te fshihet sepse ka porosi ose histori te lidhur.",
      },
      { status: 409 },
    );
  }

  await prisma.variant.deleteMany({
    where: {
      id: {
        in: variantIds,
      },
    },
  });

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);

  return NextResponse.json({
    ok: true,
    deletedVariantIds: variantIds,
  });
}
