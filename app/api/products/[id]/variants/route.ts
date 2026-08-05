import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const url = new URL(_request.url);
  const warehouseId = Number(url.searchParams.get("warehouseId"));
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
      ...(warehouseId > 0
        ? {
            inventories: {
              some: {
                warehouseId,
                stock: {
                  gt: 0,
                },
              },
            },
          }
        : {
            stock: {
              gt: 0,
            },
          }),
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
      inventories: {
        where: warehouseId > 0 ? { warehouseId } : undefined,
        select: {
          stock: true,
          locationCode: true,
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: warehouseId > 0 ? 1 : undefined,
      },
      product: {
        select: {
          name: true,
          warehouseName: true,
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
      inventory: variant.inventories[0] ?? null,
      id: variant.id,
      productId: variant.productId,
      productLabel: `${variant.product.name} | ${variant.product.category.name}`,
      warehouseName:
        variant.inventories[0]?.warehouse?.name
          ? variant.inventories[0].warehouse.name
          : variant.product.warehouseName,
      category: variant.product.category.name,
      size: variant.size,
      color: variant.color,
      imagePath: variant.imagePath,
      stock:
        typeof variant.inventories[0]?.stock === "number"
          ? variant.inventories[0].stock
          : variant.stock,
      locationCode:
        variant.inventories[0]?.locationCode ?? null,
      price: Number(variant.price),
      material: variant.material,
      powerWatts: variant.powerWatts,
    })),
  );
}
