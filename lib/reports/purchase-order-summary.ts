import { calculatePurchaseOrderMetrics } from "@/lib/purchase-order-metrics";

type ReportOrder = {
  status: string;
  items: Array<{
    orderedQuantity: number;
    receivedQuantity: number;
    returnedQuantity: number;
    unitCost: number;
  }>;
};

export function summarizePurchaseOrders(orders: ReportOrder[]) {
  const totals = orders.reduce((sum, order) => {
    const metrics = calculatePurchaseOrderMetrics(order.items);
    return {
      orderedValue: sum.orderedValue + metrics.totalOrderedValue,
      receivedValue: sum.receivedValue + metrics.totalReceivedValue,
      outstandingValue: sum.outstandingValue + metrics.totalOutstandingValue,
      returnedValue: sum.returnedValue + metrics.totalReturnedValue,
      openCount: sum.openCount + (order.status === "DRAFT" || order.status === "ORDERED" || order.status === "PARTIALLY_RECEIVED" || order.status === "PARTIALLY_RETURNED" ? 1 : 0),
    };
  }, { orderedValue: 0, receivedValue: 0, outstandingValue: 0, returnedValue: 0, openCount: 0 });

  return { count: orders.length, ...totals, averageValue: orders.length ? totals.orderedValue / orders.length : 0 };
}
