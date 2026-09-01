import { NextResponse } from "next/server";
import { canAccessPosSession, getPosApiContext } from "@/lib/pos";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteProps) {
  const apiContext = await getPosApiContext(["SUPER_ADMIN", "SELLER"]);
  if (!apiContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const session = await canAccessPosSession(apiContext.currentUser, Number(id));
  if (!session || session.status !== "OPEN") {
    return NextResponse.json({ error: "POS session nuk eshte aktiv." }, { status: 404 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const categoryId = Number(url.searchParams.get("categoryId") ?? "");
  const brand = url.searchParams.get("brand")?.trim() ?? "";

  const products = await prisma.product.findMany({
    where: {
      tenantId: apiContext.tenantId,
      ...(Number.isInteger(categoryId) && categoryId > 0 ? { categoryId } : {}),
      ...(brand ? { brand: { equals: brand, mode: "insensitive" } } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { brand: { contains: query, mode: "insensitive" } },
              {
                variants: {
                  some: {
                    OR: [
                      { barcode: { contains: query, mode: "insensitive" } },
                      { sku: { contains: query, mode: "insensitive" } },
                      { color: { contains: query, mode: "insensitive" } },
                      { size: { contains: query, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      variants: {
        some: {
          inventories: {
            some: {
              warehouseId: session.warehouseId,
              stock: { gt: 0 },
            },
          },
        },
      },
    },
    orderBy: [{ name: "asc" }],
    take: 30,
    select: {
      id: true,
      name: true,
      brand: true,
      category: { select: { name: true } },
      variants: {
        where: {
          inventories: {
            some: {
              warehouseId: session.warehouseId,
              stock: { gt: 0 },
            },
          },
        },
        orderBy: [{ size: "asc" }, { color: "asc" }],
        select: {
          id: true,
          size: true,
          color: true,
          barcode: true,
          sku: true,
          imagePath: true,
          price: true,
          inventories: {
            where: { warehouseId: session.warehouseId },
            select: { stock: true },
            take: 1,
          },
        },
      },
    },
  });

  return NextResponse.json({
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand ?? "",
      category: product.category.name,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        size: variant.size,
        color: variant.color,
        barcode: variant.barcode,
        sku: variant.sku,
        imagePath: variant.imagePath,
        price: Number(variant.price),
        stock: variant.inventories[0]?.stock ?? 0,
      })),
    })),
  });
}
