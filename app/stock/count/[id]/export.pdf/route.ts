import { NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth";
import { filterInventoryCountLines, normalizeInventoryCountFilter } from "@/lib/inventory-counts";
import { prisma } from "@/lib/prisma";
import { InventoryCountPdfDocument } from "../../inventory-count-pdf-document";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const { id } = await params;
  const sessionId = Number(id);

  if (!tenantId || Number.isNaN(sessionId)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const filter = normalizeInventoryCountFilter(searchParams.get("filter"));

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId },
    include: {
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      lines: {
        include: {
          variant: {
            select: {
              id: true,
              size: true,
              color: true,
              sku: true,
              imagePath: true,
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
        orderBy: [
          { variant: { product: { name: "asc" } } },
          { variant: { color: "asc" } },
          { variant: { size: "asc" } },
        ],
      },
    },
  });

  if (!session) {
    return new NextResponse("Not found", { status: 404 });
  }

  const lines = filterInventoryCountLines(session.lines, query, filter).map((line) => ({
    productName: line.variant.product.brand
      ? `${line.variant.product.brand} ${line.variant.product.name}`
      : line.variant.product.name,
    categoryName: line.variant.product.category.name,
    variantLabel: `${line.variant.color} / ${line.variant.size}`,
    sku: line.variant.sku,
    locationCode: line.locationCode,
    expectedStock: line.expectedStock,
    countedStock: line.countedStock,
    difference: line.difference,
    note: line.note,
  }));

  const document = createElement(InventoryCountPdfDocument, {
    session: {
      id: session.id,
      warehouseName: session.warehouse.name,
      createdAt: session.createdAt,
      createdByName: session.createdBy?.name ?? "Sistem",
      totalLines: session.lines.length,
    },
    filters: { query, filter },
    lines,
  }) as ReactElement<DocumentProps>;

  const pdfBuffer = await renderToBuffer(document);
  const pdfBytes = new Uint8Array(pdfBuffer);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=\"inventory-count-${session.id}.pdf\"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request, context: RouteProps) {
  return GET(request, context);
}
