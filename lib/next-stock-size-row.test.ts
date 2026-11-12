import assert from "node:assert/strict";
import test from "node:test";
import { nextStockSizeRow } from "./next-stock-size-row";

test("increments numeric size and copies the previous stock", () => {
  assert.deepEqual(nextStockSizeRow({ size: "41", stock: "10" }), { size: "42", stock: "10" });
  assert.deepEqual(nextStockSizeRow({ size: "41.5", stock: "0" }), { size: "42.5", stock: "0" });
});

test("leaves a nonnumeric size editable while copying stock", () => {
  assert.deepEqual(nextStockSizeRow({ size: "M", stock: "7" }), { size: "", stock: "7" });
  assert.deepEqual(nextStockSizeRow({ size: "", stock: "" }), { size: "", stock: "" });
});
