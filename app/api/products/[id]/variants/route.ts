import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id;

  if (!currentUser || !tenantId || !hasRole(currentUser, ["SUPER_ADMIN", "SELLER"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const productId = Number(id);

  if (Number.isNaN(productId) || productId <= 0) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const variants = await prisma.variant.findMany({
    where: {
      tenantId,
      productId,
      stock: {
        gt: 0,
      },
    },
    select: {
      id: true,
      productId: true,
      size: true,
      color: true,
      imagePath: true,
      stock: true,
      price: true,
      material: true,
      powerWatts: true,
      product: {
        select: {
          name: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ size: "asc" }, { color: "asc" }],
  });

  return NextResponse.json(
    variants.map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      productLabel: `${variant.product.name} | ${variant.product.category.name}`,
      category: variant.product.category.name,
      size: variant.size,
      color: variant.color,
      imagePath: variant.imagePath,
      stock: variant.stock,
      price: Number(variant.price),
      material: variant.material,
      powerWatts: variant.powerWatts,
    })),
  );
}
