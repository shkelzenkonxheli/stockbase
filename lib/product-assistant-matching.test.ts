import assert from "node:assert/strict";
import test from "node:test";
import { analysisForProductSearch, isRelevantProductSuggestion } from "./product-assistant-matching";
import { combineVisualMatch, scoreProductMatch, type MatchProduct, type ProductAnalysis } from "./product-match-core";

const analysis: ProductAnalysis = { brand: "BALENCIAGA", model: "Speed Sock Black/White Sneakers", category: "Sneakers", color: "Black/White", material: null, attributes: [], confidence: 0.9 };
const product: MatchProduct = { id: 1, name: "Speed Sock", brand: "Balenciaga", category: "Patika", variants: [{ id: 10, color: "Black-White", size: "42", stock: 1, imagePath: "/photo.jpg", sku: null, barcode: null, customAttributes: null }] };

test("removes color and category words only from the matching copy", () => {
  const search = analysisForProductSearch(analysis);
  assert.equal(search.model, "speed sock");
  assert.equal(analysis.model, "Speed Sock Black/White Sneakers");
  assert.equal(scoreProductMatch(search, product).signals.model, 1);
});

test("same brand and color with an unrelated model is not shown", () => {
  const search = analysisForProductSearch(analysis);
  const unrelated = { ...product, name: "Track 3.0" };
  assert.equal(isRelevantProductSuggestion(combineVisualMatch(scoreProductMatch(search, unrelated), "NOT_CHECKED"), search), false);
});

test("same model in a different color remains a candidate", () => {
  const search = analysisForProductSearch(analysis);
  const differentColor = { ...product, variants: [{ ...product.variants[0], color: "Red" }] };
  assert.equal(isRelevantProductSuggestion(combineVisualMatch(scoreProductMatch(search, differentColor), "NOT_CHECKED"), search), true);
  assert.equal(isRelevantProductSuggestion(combineVisualMatch(scoreProductMatch(search, differentColor), "UNLIKELY"), search), true);
});

test("a strong visual match can rescue a generic stored name", () => {
  const search = analysisForProductSearch(analysis);
  const generic = { ...product, name: "Qorapa" };
  assert.equal(isRelevantProductSuggestion(combineVisualMatch(scoreProductMatch(search, generic), "STRONG"), search), true);
  assert.equal(isRelevantProductSuggestion(combineVisualMatch(scoreProductMatch(search, generic), "UNLIKELY"), search), false);
});
