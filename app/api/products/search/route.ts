import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id;

  if (!currentUser || !tenantId || !hasRole(currentUser, ["SUPER_ADMIN", "SELLER", "WAREHOUSE"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  const tokens = query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const results = await prisma.product.findMany({
    where: {
      tenantId,
      AND: tokens.map((token) => ({
        OR: [
          {
            name: {
              contains: token,
              mode: "insensitive",
            },
          },
          {
            brand: {
              contains: token,
              mode: "insensitive",
            },
          },
          {
            category: {
              name: {
                contains: token,
                mode: "insensitive",
              },
            },
          },
          {
            variants: {
              some: {
                color: {
                  contains: token,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            variants: {
              some: {
                size: {
                  contains: token,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            variants: {
              some: {
                sku: {
                  contains: token,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      })),
    },
    take: 8,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      brand: true,
      category: {
        select: {
          name: true,
        },
      },
      variants: {
        select: {
          imagePath: true,
          stock: true,
        },
      },
    },
  });

  return NextResponse.json(
    results.map((product) => ({
      id: product.id,
      name: product.brand ? `${product.brand} ${product.name}` : product.name,
      brand: product.category.name,
      imagePath: product.variants.find((variant) => variant.imagePath)?.imagePath ?? null,
      totalStock: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
      variantCount: product.variants.length,
    })),
  );
}
