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

  const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (!code) {
    return NextResponse.json({ error: "Kodi mungon." }, { status: 400 });
  }

  const variant = await prisma.variant.findFirst({
    where: {
      // Product ownership is authoritative for legacy variants without Variant.tenantId.
      product: { tenantId: apiContext.tenantId },
      OR: [{ barcode: code }, { sku: code }],
      // A scanned barcode cannot add a sold-out variant to the POS cart.
      inventories: { some: { warehouseId: session.warehouseId, stock: { gt: 0 } } },
    },
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
      product: {
        select: {
          name: true,
          brand: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  if (!variant) {
    return NextResponse.json({ error: "Produkti nuk u gjet ne kete lokacion." }, { status: 404 });
  }

  return NextResponse.json({
    variant: {
      id: variant.id,
      name: variant.product.name,
      brand: variant.product.brand ?? "",
      category: variant.product.category.name,
      size: variant.size,
      color: variant.color,
      barcode: variant.barcode,
      sku: variant.sku,
      imagePath: variant.imagePath,
      price: Number(variant.price),
      stock: variant.inventories[0]?.stock ?? 0,
    },
  });
}
