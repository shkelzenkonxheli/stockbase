import { NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PurchaseOrderPdfDocument } from "../../purchase-order-pdf-document";

type RouteProps = {
  params: Promise<{ id: string }>;
};

function formatMoney(value: number) {
  return `${value.toFixed(2)} EUR`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function statusLabel(status: string) {
  switch (status) {
    case "ORDERED":
      return "Ordered";
    case "PARTIALLY_RECEIVED":
      return "Partial";
    case "RECEIVED":
      return "Received";
    case "CANCELED":
      return "Canceled";
    default:
      return "Draft";
  }
}

export async function GET(_request: Request, { params }: RouteProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const { id } = await params;
  const purchaseOrderId = Number(id);

  if (!tenantId || Number.isNaN(purchaseOrderId)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const order = await prisma.purchaseOrder.findFirst({
    where: {
      id: purchaseOrderId,
      tenantId,
    },
    include: {
      supplier: { select: { name: true } },
      warehouse: { select: { name: true } },
      items: {
        orderBy: [
          { variant: { product: { name: "asc" } } },
          { variant: { color: "asc" } },
          { variant: { size: "asc" } },
        ],
        select: {
          orderedQuantity: true,
          receivedQuantity: true,
          unitCost: true,
          product: {
            select: {
              name: true,
            },
          },
          pendingProductName: true,
          pendingColor: true,
          pendingSize: true,
          variant: {
            select: {
              size: true,
              color: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    return new NextResponse("Not found", { status: 404 });
  }

  const totalValue = order.items.reduce(
    (sum, item) => sum + Number(item.unitCost) * item.orderedQuantity,
    0,
  );

  const document = createElement(PurchaseOrderPdfDocument, {
    order: {
      id: order.id,
      supplierName: order.supplier.name,
      warehouseName: order.warehouse.name,
      orderedAtLabel: formatDate(order.orderedAt),
      statusLabel: statusLabel(order.status),
      totalLabel: formatMoney(totalValue),
      totalQuantity: order.items.reduce((sum, item) => sum + item.orderedQuantity, 0),
      itemCount: order.items.length,
      note: order.note,
    },
    items: order.items.map((item) => ({
      productName:
        item.variant?.product.name ?? item.product?.name ?? item.pendingProductName ?? "Produkt",
      variantLabel: `${item.variant?.color ?? item.pendingColor ?? "Standard"} / ${item.variant?.size ?? item.pendingSize ?? "Standard"}`,
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      remainingQuantity: Math.max(0, item.orderedQuantity - item.receivedQuantity),
      unitCostLabel: formatMoney(Number(item.unitCost)),
      lineTotalLabel: formatMoney(Number(item.unitCost) * item.orderedQuantity),
    })),
  }) as ReactElement<DocumentProps>;

  const pdfBuffer = await renderToBuffer(document);
  const pdfBytes = new Uint8Array(pdfBuffer);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="purchase-order-${order.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
