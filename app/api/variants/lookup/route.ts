import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id;

  if (!currentUser || !tenantId || !hasRole(currentUser, ["SUPER_ADMIN", "SELLER", "WAREHOUSE"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim().toUpperCase() ?? "";
  const warehouseId = Number(url.searchParams.get("warehouseId") ?? "");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const variant = await prisma.variant.findFirst({
    where: {
      tenantId,
      OR: [{ barcode: code }, { sku: code }],
      ...(warehouseId > 0
        ? {
            inventories: {
              some: {
                warehouseId,
              },
            },
          }
        : {}),
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
      barcode: true,
      sku: true,
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
        take: warehouseId > 0 ? 1 : 10,
      },
      product: {
        select: {
          id: true,
          name: true,
          brand: true,
          warehouseName: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!variant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inventory = warehouseId > 0 ? (variant.inventories[0] ?? null) : null;
  const stock =
    inventory && typeof inventory.stock === "number"
      ? inventory.stock
      : warehouseId > 0
        ? 0
        : variant.stock;

  return NextResponse.json({
    variant: {
      id: variant.id,
      productId: variant.productId,
      productLabel: `${variant.product.name} | ${variant.product.category.name}`,
      warehouseName:
        inventory?.warehouse?.name
          ? inventory.warehouse.name
          : [
              ...new Set(
                variant.inventories
                  .map((item) => item.warehouse?.name)
                  .filter((value): value is string => Boolean(value)),
              ),
            ].join(", ") || variant.product.warehouseName,
      category: variant.product.category.name,
      size: variant.size,
      color: variant.color,
      imagePath: variant.imagePath,
      stock,
      price: Number(variant.price),
      material: variant.material,
      powerWatts: variant.powerWatts,
      locationCode: inventory?.locationCode ?? null,
      barcode: variant.barcode,
      sku: variant.sku,
    },
    product: {
      id: variant.product.id,
      name: variant.product.name,
      brand: variant.product.brand ?? "",
      warehouseName: variant.product.warehouseName ?? "",
      category: variant.product.category.name,
      imagePath: variant.imagePath,
    },
  });
}
