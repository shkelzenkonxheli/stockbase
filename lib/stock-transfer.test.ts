import assert from "node:assert/strict";
import test from "node:test";
import { parseStockTransferAdjustments } from "./stock-transfer";

test("accepts several variants from different products", () => {
  assert.deepEqual(parseStockTransferAdjustments('[{"variantId":11,"quantity":2},{"variantId":27,"quantity":5}]'), [
    { variantId: 11, quantity: 2 },
    { variantId: 27, quantity: 5 },
  ]);
});

test("rejects duplicate variants and invalid quantities", () => {
  assert.equal(parseStockTransferAdjustments('[{"variantId":11,"quantity":2},{"variantId":11,"quantity":3}]'), null);
  assert.equal(parseStockTransferAdjustments('[{"variantId":11,"quantity":1.5}]'), null);
  assert.equal(parseStockTransferAdjustments('[{"variantId":11,"quantity":-1}]'), null);
  assert.equal(parseStockTransferAdjustments('[{"variantId":11,"quantity":"2"}]'), null);
});

test("rejects malformed, empty and oversized transfers", () => {
  assert.equal(parseStockTransferAdjustments(null), null);
  assert.equal(parseStockTransferAdjustments("{"), null);
  assert.equal(parseStockTransferAdjustments("[]"), null);
  assert.equal(parseStockTransferAdjustments(JSON.stringify(Array.from({ length: 101 }, (_, index) => ({ variantId: index + 1, quantity: 1 })))), null);
});
