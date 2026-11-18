import { prisma } from "@/lib/prisma";
import { summarizePurchaseOrders } from "@/lib/reports/purchase-order-summary";
import { BUSINESS_TIME_ZONE, getTimeZoneMonthBounds } from "@/lib/reports/monthly-sales-report";

export async function getMonthlyPurchaseOrderReport(selectedMonth: string, tenantId: number) {
  const { start, end } = getTimeZoneMonthBounds(selectedMonth, BUSINESS_TIME_ZONE);
  const orders = await prisma.purchaseOrder.findMany({
    where: { tenantId, orderedAt: { gte: start, lt: end } },
    select: {
      status: true,
      items: { select: { orderedQuantity: true, receivedQuantity: true, returnedQuantity: true, unitCost: true } },
    },
  });

  return summarizePurchaseOrders(orders.map((order) => ({
    status: order.status,
    items: order.items.map((item) => ({ ...item, unitCost: Number(item.unitCost) })),
  })));
}
