import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  const tenantId = user?.tenant?.id;
  if (!user || !tenantId || !hasRole(user, ["SUPER_ADMIN", "SELLER"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [warehouses, products] = await Promise.all([
    prisma.warehouse.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { tenantId, variants: { some: { inventories: { some: { stock: { gt: 0 }, warehouse: { tenantId, isActive: true } } } } } },
      select: {
        id: true, name: true, brand: true,
        category: { select: { name: true } },
        variants: {
          where: { inventories: { some: { stock: { gt: 0 }, warehouse: { tenantId, isActive: true } } } },
          select: { imagePath: true, inventories: { where: { stock: { gt: 0 }, warehouse: { tenantId, isActive: true } }, select: { warehouseId: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    warehouses,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand ?? "",
      category: product.category.name,
      imagePath: product.variants.find((variant) => variant.imagePath)?.imagePath ?? null,
      warehouseIds: [...new Set(product.variants.flatMap((variant) => variant.inventories.map((inventory) => inventory.warehouseId)))],
    })),
  });
}
