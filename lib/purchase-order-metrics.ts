type PurchaseOrderMetricItem = {
  orderedQuantity: number;
  receivedQuantity: number;
  returnedQuantity?: number | null;
  unitCost: number;
};

export function getPurchaseOrderItemReturnedQuantity(
  item: Pick<PurchaseOrderMetricItem, "returnedQuantity">,
) {
  return Math.max(0, Number(item.returnedQuantity ?? 0));
}

export function getPurchaseOrderItemRemainingQuantity(item: PurchaseOrderMetricItem) {
  return Math.max(0, item.orderedQuantity - item.receivedQuantity);
}

export function getPurchaseOrderItemReturnableQuantity(item: PurchaseOrderMetricItem) {
  return Math.max(0, item.receivedQuantity - getPurchaseOrderItemReturnedQuantity(item));
}

export function calculatePurchaseOrderMetrics(items: PurchaseOrderMetricItem[]) {
  const itemCount = items.length;
  const totalOrderedQuantity = items.reduce((sum, item) => sum + item.orderedQuantity, 0);
  const totalReceivedQuantity = items.reduce((sum, item) => sum + item.receivedQuantity, 0);
  const totalReturnedQuantity = items.reduce(
    (sum, item) => sum + getPurchaseOrderItemReturnedQuantity(item),
    0,
  );
  const totalRemainingQuantity = items.reduce(
    (sum, item) => sum + getPurchaseOrderItemRemainingQuantity(item),
    0,
  );
  const totalReturnableQuantity = items.reduce(
    (sum, item) => sum + getPurchaseOrderItemReturnableQuantity(item),
    0,
  );
  const totalOrderedValue = items.reduce(
    (sum, item) => sum + item.orderedQuantity * item.unitCost,
    0,
  );
  const totalReceivedValue = items.reduce(
    (sum, item) => sum + item.receivedQuantity * item.unitCost,
    0,
  );
  const totalReturnedValue = items.reduce(
    (sum, item) => sum + getPurchaseOrderItemReturnedQuantity(item) * item.unitCost,
    0,
  );
  const totalOutstandingValue = items.reduce(
    (sum, item) => sum + getPurchaseOrderItemRemainingQuantity(item) * item.unitCost,
    0,
  );

  return {
    itemCount,
    totalOrderedQuantity,
    totalReceivedQuantity,
    totalReturnedQuantity,
    totalRemainingQuantity,
    totalReturnableQuantity,
    totalOrderedValue,
    totalReceivedValue,
    totalReturnedValue,
    totalOutstandingValue,
  };
}
