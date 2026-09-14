import { NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CatalogPdfDocument } from "../../catalog-pdf-document";

async function toPdfImageData(imagePath: string | null | undefined) {
  if (!imagePath) return null;
  try {
    const response = await fetch(imagePath);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!response.ok || !contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireRole(["SUPER_ADMIN"]); const { id } = await params;
  const catalog = await prisma.catalog.findFirst({
    where: { id: Number(id), tenantId: currentUser.tenant!.id },
    include: { products: { orderBy: { sortOrder: "asc" }, include: { product: { include: { category: true, variants: { orderBy: { price: "asc" }, take: 1 } } } } } },
  });
  if (!catalog) return new NextResponse("Not found", { status: 404 });
  const products = await Promise.all(catalog.products.map(async (item) => ({
    name: item.product.name,
    brand: item.product.brand,
    category: item.product.category.name,
    price: catalog.priceMode === "RETAIL" ? `EUR ${Number(item.product.variants[0]?.price ?? 0).toFixed(2)}` : null,
    imagePath: await toPdfImageData(item.product.variants[0]?.imagePath),
  })));
  const documentData = {
    businessName: currentUser.tenant?.businessName ?? currentUser.tenant!.name,
    catalogName: catalog.name,
    description: catalog.description,
    products,
  };
  const document = createElement(CatalogPdfDocument, documentData);
  const buffer = await renderToBuffer(document as ReactElement<DocumentProps>);
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="catalog-${catalog.id}.pdf"` } });
}
