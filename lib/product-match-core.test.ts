import assert from "node:assert/strict";
import test from "node:test";
import { buildCandidateSearch, combineVisualMatch, normalizeModel, normalizeProductText, scoreProductMatch, shortlistPhotoMetadata, textSimilarity, type MatchProduct, type ProductAnalysis } from "./product-match-core";
import { trustedProductImageKey } from "./product-image-key";

const analysis: ProductAnalysis = { brand: "Nike", model: "Air Max 270", category: "Sneakers", color: "Black / White", material: null, attributes: [], confidence: 0.9 };
const product: MatchProduct = {
  id: 1, name: "AirMax 270", brand: "NIKE", category: "Patika",
  variants: [{ id: 10, color: "Black-White", size: "41", stock: 2, imagePath: "/shoe.jpg", sku: "SKU-10", barcode: "290000000010", customAttributes: null }],
};

test("normalizes case, punctuation, brand prefix and joined model words", () => {
  assert.equal(normalizeProductText("Air-Max-270"), "air max 270");
  assert.equal(normalizeModel("Nike AirMax 270", "Nike"), "air max 270");
  assert.equal(normalizeModel("AIR MAX 270", "Nike"), "air max 270");
  assert.equal(normalizeProductText("  Black /   White  "), "black white");
  assert.equal(textSimilarity("AirMax 270", "Air Max 270"), 1);
});

test("matches same model and color across formatting differences", () => {
  const result = scoreProductMatch(analysis, product);
  assert.equal(result.signals.model, 1);
  assert.equal(result.signals.color, 1);
  assert.equal(result.signals.category, 1);
  assert.equal(result.confidence, "VERY_HIGH");
  assert.equal(result.matchedVariants[0].id, 10);
});

test("different model and brand do not become a high-confidence match", () => {
  const result = scoreProductMatch(analysis, { ...product, name: "Court Vision", brand: "Adidas" });
  assert.notEqual(result.confidence, "HIGH");
  assert.notEqual(result.confidence, "VERY_HIGH");
});

test("different color remains the same possible product with a lower color signal", () => {
  const result = scoreProductMatch(analysis, { ...product, variants: [{ ...product.variants[0], color: "Grey" }] });
  assert.equal(result.signals.model, 1);
  assert.equal(result.signals.color, 0);
});

test("matching keeps a product photo when the closest color has none", () => {
  const result = scoreProductMatch({ ...analysis, color: "Brown" }, {
    ...product,
    variants: [
      { ...product.variants[0], color: "Brown", imagePath: null },
      { ...product.variants[0], id: 11, color: "Cream", imagePath: "/cream.jpg" },
    ],
  });
  assert.equal(result.color, "Brown");
  assert.equal(result.imagePath, "/cream.jpg");
});

test("exact SKU or barcode is the strongest identifier when provided", () => {
  const result = scoreProductMatch({ ...analysis, model: null, brand: null }, product, "SKU-10");
  assert.equal(result.confidence, "VERY_HIGH");
  assert.equal(result.signals.identifier, 1);
});

test("visual evidence cannot make a different brand and model a high-confidence match", () => {
  const metadata = scoreProductMatch(analysis, { ...product, name: "Court Vision", brand: "Adidas" });
  const combined = combineVisualMatch(metadata, "STRONG");
  assert.notEqual(combined.confidence, "HIGH");
  assert.notEqual(combined.confidence, "VERY_HIGH");
});

test("metadata remains primary for the same model photographed at another angle or background", () => {
  const metadata = scoreProductMatch(analysis, product);
  const visual = combineVisualMatch(metadata, "STRONG");
  assert.equal(visual.confidence, "VERY_HIGH");
  assert.ok(visual.reasons.includes("visual"));
  assert.ok(visual.finalScore >= metadata.fuzzyScore);
});

test("a completely different product is not rated as a strong duplicate", () => {
  const result = scoreProductMatch(analysis, { ...product, name: "Boston Sandal", brand: "Birkenstock", category: "Sandale", variants: [{ ...product.variants[0], color: "Tan" }] });
  assert.equal(result.confidence, "LOW");
});

test("matching model with a new size still identifies the existing product", () => {
  const result = scoreProductMatch(analysis, product);
  assert.equal(result.productId, product.id);
  assert.ok(result.matchedVariants.every((variant) => variant.size !== "42"));
});

test("candidate retrieval always includes tenantId and fragments joined model names", () => {
  const search = buildCandidateSearch(9, { ...analysis, brand: null, model: "AirMax270" });
  assert.equal(search.where.tenantId, 9);
  assert.ok(search.needles.includes("air"));
  assert.ok(search.needles.includes("max"));
  assert.ok(search.needles.includes("270"));
});

test("photo fallback shortlists a model even when SQL substring search would miss it", () => {
  const ids = shortlistPhotoMetadata(analysis, [
    { id: 1, name: "Court Vision", brand: "Nike", category: "Patika" },
    { id: 2, name: "AirMax270", brand: "NIKE", category: "Patika" },
    { id: 3, name: "Air Max 2090", brand: "Nike", category: "Patika" },
  ]);
  assert.equal(ids[0], 2);
});

test("R2 image keys must belong to the selected product path", () => {
  assert.equal(trustedProductImageKey("/api/assets/stockbase/products/1/photo.jpg", 1, "stockbase"), "stockbase/products/1/photo.jpg");
  assert.equal(trustedProductImageKey("/api/assets/stockbase/products/2/photo.jpg", 1, "stockbase"), null);
  assert.equal(trustedProductImageKey("https://other.example/photo.jpg", 1, "stockbase"), null);
  assert.equal(trustedProductImageKey("/api/assets/stockbase/products/1/%2e%2e/photo.jpg", 1, "stockbase"), null);
});
