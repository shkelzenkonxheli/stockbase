import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { isMultiWarehouseEnabled } from "@/lib/inventory-module-access";
import { prisma } from "@/lib/prisma";
import { groupTransferModels } from "@/lib/stock-transfer-filter-options";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const tenantId = user?.tenant?.id;
  if (!user || !tenantId || !hasRole(user, ["SUPER_ADMIN"]) || !isMultiWarehouseEnabled(user.tenant?.catalogConfig)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const warehouseId = Number(url.searchParams.get("warehouseId"));
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
    return NextResponse.json({ error: "Invalid warehouse" }, { status: 400 });
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

  const category = (url.searchParams.get("category") ?? "").trim().slice(0, 80);
  const brand = (url.searchParams.get("brand") ?? "").trim().slice(0, 80);
  const model = (url.searchParams.get("model") ?? "").trim().slice(0, 80);
  const color = (url.searchParams.get("color") ?? "").trim().slice(0, 80);
  const stockHere = { inventories: { some: { warehouseId, stock: { gt: 0 } } } };
  if (url.searchParams.get("options") === "1") {
    const [categories, brands, modelVariants] = await Promise.all([
      !category && !brand ? prisma.category.findMany({
        where: { products: { some: { tenantId, variants: { some: { tenantId, ...stockHere } } } } },
        select: { name: true },
        orderBy: { name: "asc" },
      }) : Promise.resolve([]),
      !brand ? prisma.product.findMany({
        where: {
          tenantId,
          ...(category ? { category: { name: { equals: category, mode: "insensitive" } } } : {}),
          variants: { some: { tenantId, ...stockHere } },
        },
        distinct: ["brand"],
        select: { brand: true },
        orderBy: { brand: "asc" },
      }) : Promise.resolve([]),
      brand ? prisma.variant.findMany({
        where: {
          tenantId,
          ...stockHere,
          product: {
            tenantId,
            brand: { equals: brand, mode: "insensitive" },
            ...(category ? { category: { name: { equals: category, mode: "insensitive" } } } : {}),
          },
        },
        distinct: ["productId", "color"],
        select: { color: true, product: { select: { name: true } } },
      }) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      categories: [...new Set(categories.map((item) => item.name))],
      brands: brands.map((item) => item.brand).filter((value): value is string => Boolean(value)),
      models: groupTransferModels(modelVariants),
    });
  }

  if (!query && !category && !brand && !model && !color) {
    return NextResponse.json({ variants: [], hasMore: false });
  }

  const inventories = await prisma.variantInventory.findMany({
    where: {
      warehouseId,
      stock: { gt: 0 },
      variant: {
        tenantId,
        product: {
          tenantId,
          ...(category ? { category: { name: { equals: category, mode: "insensitive" } } } : {}),
          ...(brand ? { brand: { equals: brand, mode: "insensitive" } } : {}),
          ...(model ? { name: { equals: model, mode: "insensitive" } } : {}),
        },
        ...(color ? { color: { equals: color, mode: "insensitive" } } : {}),
        ...(query ? {
          OR: [
            { product: { name: { contains: query, mode: "insensitive" } } },
            { product: { brand: { contains: query, mode: "insensitive" } } },
            { product: { category: { name: { contains: query, mode: "insensitive" } } } },
            { size: { contains: query, mode: "insensitive" } },
            { color: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
            { barcode: { contains: query, mode: "insensitive" } },
          ],
        } : {}),
      },
    },
    select: {
      stock: true,
      variant: {
        select: {
          id: true,
          productId: true,
          size: true,
          color: true,
          imagePath: true,
          sku: true,
          product: {
            select: {
              name: true,
              brand: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { variantId: "asc" },
    take: 41,
  });

  return NextResponse.json({
    variants: inventories.slice(0, 40).map(({ stock, variant }) => ({
      id: variant.id,
      productId: variant.productId,
      productName: variant.product.name,
      brand: variant.product.brand,
      category: variant.product.category.name,
      size: variant.size,
      color: variant.color,
      imagePath: variant.imagePath,
      sku: variant.sku,
      stock,
    })),
    hasMore: inventories.length > 40,
  });
}
