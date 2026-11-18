import assert from "node:assert/strict";
import test from "node:test";
import { summarizePurchaseOrders } from "./purchase-order-summary";

test("summarizes ordered, received, returned and outstanding PO values", () => {
  const report = summarizePurchaseOrders([
    { status: "PARTIALLY_RECEIVED", items: [{ orderedQuantity: 10, receivedQuantity: 6, returnedQuantity: 2, unitCost: 20 }] },
    { status: "RECEIVED", items: [{ orderedQuantity: 4, receivedQuantity: 4, returnedQuantity: 0, unitCost: 15 }] },
  ]);

  assert.deepEqual(report, {
    count: 2,
    orderedValue: 260,
    receivedValue: 180,
    outstandingValue: 80,
    returnedValue: 40,
    openCount: 1,
    averageValue: 130,
  });
});

test("returns zero metrics when the selected month has no PO", () => {
  assert.deepEqual(summarizePurchaseOrders([]), {
    count: 0,
    orderedValue: 0,
    receivedValue: 0,
    outstandingValue: 0,
    returnedValue: 0,
    openCount: 0,
    averageValue: 0,
  });
});
