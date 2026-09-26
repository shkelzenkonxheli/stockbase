import assert from "node:assert/strict";
import test from "node:test";
import { canSkipPhotoVisualComparison, isPlausiblePhotoCandidate, isSingleStrongPhotoMatch, photoWarehouseProductFilter, summarizePhotoStock, type RankedPhotoCandidate } from "./photo-match-policy";
import { hasSupportedPhotoSignature } from "./product-photo-analysis";

const candidate: RankedPhotoCandidate = {
  id: 1, color: "Black / White", confidence: "VERY_HIGH", finalScore: 95, visualMatch: "STRONG",
  signals: { identifier: 0, brand: 1, model: 1, name: 1, category: 1, color: 1, attributes: 0 },
};

test("photo signatures reject a file with a false MIME type", () => {
  assert.equal(hasSupportedPhotoSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(hasSupportedPhotoSignature("image/jpeg", new TextEncoder().encode("not an image")), false);
  assert.equal(hasSupportedPhotoSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(hasSupportedPhotoSignature("image/webp", new TextEncoder().encode("RIFF0000WEBP")), true);
});

test("one strong match requires product identity evidence", () => {
  assert.equal(isSingleStrongPhotoMatch([candidate]), true);
  assert.equal(isSingleStrongPhotoMatch([{ ...candidate, signals: { ...candidate.signals, model: 0.4 } }]), false);
  assert.equal(isSingleStrongPhotoMatch([{ ...candidate, visualMatch: "UNLIKELY" }]), false);
  assert.equal(isSingleStrongPhotoMatch([candidate, { ...candidate, id: 2, finalScore: 91 }]), false);
  assert.equal(isSingleStrongPhotoMatch([candidate, { ...candidate, id: 2, finalScore: 70 }]), true);
  assert.equal(isSingleStrongPhotoMatch([{ ...candidate, confidence: "LOW" }]), false);
});

test("visual comparison is skipped only for one unambiguous full model match", () => {
  const analysis = { brand: "Nike", model: "Air Max 270", category: "Patika", color: "Black / White", material: null, attributes: [], confidence: 0.92 };
  const exact = { ...candidate, fuzzyScore: 96 };
  assert.equal(canSkipPhotoVisualComparison(analysis, [exact]), true);
  assert.equal(canSkipPhotoVisualComparison(analysis, [exact, { ...exact, id: 2 }]), false);
  assert.equal(canSkipPhotoVisualComparison({ ...analysis, model: "Fendi" }, [exact]), false);
  assert.equal(canSkipPhotoVisualComparison(analysis, [{ ...exact, signals: { ...exact.signals, color: 0.7 } }]), false);
  assert.equal(canSkipPhotoVisualComparison(analysis, [{ ...exact, signals: { ...exact.signals, brand: 0.7 } }]), false);
});

test("weak photo matches require identity evidence or brand, category and color together", () => {
  const weak = { ...candidate, confidence: "LOW" as const, finalScore: 38, visualMatch: "NOT_CHECKED" as const };
  assert.equal(isPlausiblePhotoCandidate({ ...weak, signals: { ...weak.signals, model: 0, color: 0 } }), false);
  assert.equal(isPlausiblePhotoCandidate({ ...weak, signals: { ...weak.signals, model: 0 } }), true);
  assert.equal(isPlausiblePhotoCandidate({ ...weak, imagePath: "/product.jpg", signals: { ...weak.signals, model: 0, color: 0 } }), true);
  assert.equal(isPlausiblePhotoCandidate({ ...weak, visualMatch: "STRONG", signals: { ...weak.signals, model: 0, color: 0 } }), true);
  assert.equal(isPlausiblePhotoCandidate({ ...weak, visualMatch: "UNLIKELY" }), false);
  assert.equal(isPlausiblePhotoCandidate({ ...weak, signals: { ...weak.signals, brand: 0, model: 0, color: 0 } }), false);
});

test("stock summary uses warehouse inventory, keeps sold-out sizes and real other colors", () => {
  const summary = summarizePhotoStock([
    { color: "Black / White", size: "41", stock: 9, imagePath: "/black.jpg", inventories: [{ stock: 0, warehouse: { name: "Store" } }] },
    { color: "black-white", size: "42", stock: 5, imagePath: null, inventories: [{ stock: 2, warehouse: { name: "Store" } }, { stock: 3, warehouse: { name: "Main" } }] },
    { color: "Blue", size: "43", stock: 4, imagePath: "/blue.jpg", inventories: [{ stock: 4, warehouse: { name: "Main" } }] },
  ], "Black / White");
  assert.equal(summary.matchedColor, "Black / White");
  assert.equal(summary.colors.length, 2);
  assert.deepEqual(summary.colors[0].sizes, [{ size: "41", stock: 0 }, { size: "42", stock: 5 }]);
  assert.deepEqual(summary.colors[0].warehouses, [{ name: "Main", stock: 3 }, { name: "Store", stock: 2 }]);
  assert.equal(summary.colors[1].totalStock, 4);
  assert.deepEqual(summary.warehouses, [{ name: "Main", stock: 7 }, { name: "Store", stock: 2 }]);
});

test("warehouse filter requires positive stock in the selected tenant warehouse", () => {
  assert.deepEqual(photoWarehouseProductFilter(3, null), {});
  assert.deepEqual(photoWarehouseProductFilter(3, 7), {
    variants: { some: { tenantId: 3, inventories: { some: { warehouseId: 7, stock: { gt: 0 }, warehouse: { tenantId: 3 } } } } },
  });
});

test("warehouse-scoped details exclude colors and sizes absent from the selected warehouse", () => {
  const summary = summarizePhotoStock([
    { color: "Black", size: "41", stock: 9, imagePath: "/black.jpg", inventories: [] },
    { color: "Black", size: "42", stock: 8, imagePath: "/black-42.jpg", inventories: [{ stock: 2, warehouse: { name: "Store" } }] },
    { color: "White", size: "43", stock: 4, imagePath: null, inventories: [] },
    { color: "Blue", size: "44", stock: 1, imagePath: null, inventories: [{ stock: 0, warehouse: { name: "Store" } }] },
  ], "Black", true);
  assert.deepEqual(summary.colors[0].sizes, [{ size: "42", stock: 2 }]);
  assert.equal(summary.colors.length, 1);
  assert.equal(summary.colors[0].totalStock, 2);
  assert.equal(summary.imagePath, "/black-42.jpg");
  assert.equal(summary.unassignedStock, 0);
  assert.deepEqual(summary.warehouses, [{ name: "Store", stock: 2 }]);
});
