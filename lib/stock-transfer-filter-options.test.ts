import assert from "node:assert/strict";
import test from "node:test";
import { groupTransferModels } from "./stock-transfer-filter-options";

test("groups only each model's colors and removes repeated size colors", () => {
  assert.deepEqual(groupTransferModels([
    { product: { name: "Air Max 270" }, color: "Black" },
    { product: { name: "Air Max 270" }, color: "Black" },
    { product: { name: "Air Max 270" }, color: "White" },
    { product: { name: "Air Force 1" }, color: "Blue" },
  ]), [
    { name: "Air Force 1", colors: ["Blue"] },
    { name: "Air Max 270", colors: ["Black", "White"] },
  ]);
});
