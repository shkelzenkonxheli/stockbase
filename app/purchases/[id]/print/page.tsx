import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePurchasesAccess } from "@/lib/purchases-access";
import { calculatePurchaseOrderMetrics } from "@/lib/purchase-order-metrics";
import { prisma } from "@/lib/prisma";
import { PurchaseOrderPrintSheet } from "../../purchase-order-print-sheet";

type PurchaseOrderPrintPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Printo purchase order",
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
    case "PARTIALLY_RETURNED":
      return "Supplier return";
    case "RETURNED":
      return "Returned";
    case "CANCELED":
      return "Canceled";
    default:
      return "Draft";
  }
}

export default async function PurchaseOrderPrintPage({ params }: PurchaseOrderPrintPageProps) {
  const currentUser = await requirePurchasesAccess();
  const tenantId = currentUser.tenant?.id;
  const { id } = await params;
  const purchaseOrderId = Number(id);

  if (!tenantId || Number.isNaN(purchaseOrderId)) {
    notFound();
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
    notFound();
  }

  const metrics = calculatePurchaseOrderMetrics(
    order.items.map((item) => ({
      orderedQuantity: item.orderedQuantity,
      receivedQuantity: item.receivedQuantity,
      returnedQuantity: item.returnedQuantity,
      unitCost: Number(item.unitCost),
    })),
  );

  return (
    <PurchaseOrderPrintSheet
      order={{
        id: order.id,
        supplierName: order.supplier.name,
        supplierPhone: order.supplier.phone,
        supplierEmail: order.supplier.email,
        warehouseName: order.warehouse.name,
        orderedAtLabel: formatDate(order.orderedAt),
        statusLabel: statusLabel(order.status),
        totalLabel: formatMoney(metrics.totalOrderedValue),
        receivedLabel: formatMoney(metrics.totalReceivedValue),
        returnedLabel: formatMoney(metrics.totalReturnedValue),
        outstandingLabel: formatMoney(metrics.totalOutstandingValue),
        itemCount: metrics.itemCount,
        totalQuantity: metrics.totalOrderedQuantity,
        note: order.note,
      }}
      items={order.items.map((item) => ({
        id: item.id,
        productName:
          item.variant?.product.name ?? item.product?.name ?? item.pendingProductName ?? "Produkt",
        variantLabel: `${item.variant?.color ?? item.pendingColor ?? "Standard"} / ${item.variant?.size ?? item.pendingSize ?? "Standard"}`,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        returnedQuantity: item.returnedQuantity,
        remainingQuantity: Math.max(0, item.orderedQuantity - item.receivedQuantity),
        unitCostLabel: formatMoney(Number(item.unitCost)),
        lineTotalLabel: formatMoney(Number(item.unitCost) * item.orderedQuantity),
        note: item.note,
      }))}
    />
  );
}
