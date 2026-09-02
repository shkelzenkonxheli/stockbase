import { NextResponse } from "next/server";
import { requirePurchasesAccess } from "@/lib/purchases-access";
import { calculatePurchaseOrderMetrics } from "@/lib/purchase-order-metrics";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string }>;
};

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export async function GET(_request: Request, { params }: RouteProps) {
  const currentUser = await requirePurchasesAccess();
  const tenantId = currentUser.tenant?.id;
  const { id } = await params;
  const purchaseOrderId = Number(id);

  if (!tenantId || Number.isNaN(purchaseOrderId)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, tenantId },
    include: {
      supplier: { select: { name: true, phone: true, email: true } },
      warehouse: { select: { name: true } },
      items: {
        orderBy: [
          { variant: { product: { name: "asc" } } },
          { variant: { color: "asc" } },
          { variant: { size: "asc" } },
        ],
        select: {
          id: true,
          orderedQuantity: true,
          receivedQuantity: true,
          returnedQuantity: true,
          unitCost: true,
          note: true,
          product: { select: { name: true } },
          pendingProductName: true,
          pendingColor: true,
          pendingSize: true,
          variant: {
            select: {
              size: true,
              color: true,
              product: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!order) {
    return new NextResponse("Not found", { status: 404 });
  }

  const metrics = calculatePurchaseOrderMetrics(
    order.items.map((item) => ({
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      returnedQuantity: item.returnedQuantity,
      unitCost: Number(item.unitCost),
    })),
  );

  const headerLines = [
    ["PO", order.id],
    ["Supplier", order.supplier.name],
    ["Phone", order.supplier.phone ?? ""],
    ["Email", order.supplier.email ?? ""],
    ["Warehouse", order.warehouse.name],
    ["Ordered At", formatDate(order.orderedAt)],
    ["Status", order.status],
    ["Total Ordered Value", metrics.totalOrderedValue.toFixed(2)],
    ["Total Received Value", metrics.totalReceivedValue.toFixed(2)],
    ["Total Returned Value", metrics.totalReturnedValue.toFixed(2)],
    ["Outstanding Value", metrics.totalOutstandingValue.toFixed(2)],
    ["Note", order.note ?? ""],
  ];

  const rows = [
    [
      "Line ID",
      "Product",
      "Variant",
      "Ordered Qty",
      "Received Qty",
      "Returned Qty",
      "Remaining Qty",
      "Unit Cost",
      "Line Total",
      "Line Note",
    ],
    ...order.items.map((item) => {
      const productName =
        item.variant?.product.name ?? item.product?.name ?? item.pendingProductName ?? "Produkt";
      const variantLabel = `${item.variant?.color ?? item.pendingColor ?? "Standard"} / ${item.variant?.size ?? item.pendingSize ?? "Standard"}`;
      return [
        item.id,
        productName,
        variantLabel,
        item.orderedQuantity,
        item.receivedQuantity,
        item.returnedQuantity,
        Math.max(0, item.orderedQuantity - item.receivedQuantity),
        Number(item.unitCost).toFixed(2),
        (Number(item.unitCost) * item.orderedQuantity).toFixed(2),
        item.note ?? "",
      ];
    }),
  ];

  const csv = [
    ...headerLines.map((row) => row.map((cell) => csvEscape(cell)).join(",")),
    "",
    ...rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="purchase-order-${order.id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
