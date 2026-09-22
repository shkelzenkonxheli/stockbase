import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiProductAssistantConfig } from "@/lib/product-taxonomy";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const tenant = user?.tenant;
  if (!user || !tenant || !hasRole(user, ["SUPER_ADMIN"]) || !getAiProductAssistantConfig(tenant.catalogConfig).enabled) {
    return NextResponse.json({ error: "Nuk ke qasje." }, { status: 403 });
  }

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Produkti nuk eshte valid." }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id, tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      brand: true,
      category: { select: { name: true } },
      _count: { select: { variants: true } },
      variants: {
        orderBy: { id: "asc" },
        take: 100,
        select: { id: true, color: true, size: true, stock: true, price: true, imagePath: true },
      },
    },
  });

  if (!product) return NextResponse.json({ error: "Produkti nuk u gjet." }, { status: 404 });

  return NextResponse.json({ product: {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category.name,
    totalVariants: product._count.variants,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      color: variant.color,
      size: variant.size,
      stock: variant.stock,
      price: variant.price.toString(),
      imagePath: variant.imagePath,
    })),
  } });
}
