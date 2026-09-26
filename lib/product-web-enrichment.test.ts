import assert from "node:assert/strict";
import test from "node:test";
import { applyWebSuggestion } from "./product-web-enrichment";

const photo = {
  brand: "Nike",
  model: null,
  category: "Patika",
  color: "White",
  material: null,
  attributes: [],
  confidence: 0.7,
};

test("web evidence can suggest a missing model without changing the photographed color", () => {
  const result = applyWebSuggestion(photo, { brand: "NIKE", model: "Air Max 270" }, ["https://example.com/nike"]);
  assert.equal(result.analysis.brand, "Nike");
  assert.equal(result.analysis.model, "Air Max 270");
  assert.equal(result.analysis.color, "White");
  assert.equal(result.analysis.confidence, photo.confidence);
  assert.equal(result.applied, true);
});

test("conflicting brand cannot replace the image analysis or supply a model", () => {
  const result = applyWebSuggestion(photo, { brand: "Adidas", model: "Samba" }, ["https://example.com/adidas"]);
  assert.deepEqual(result.analysis, photo);
  assert.equal(result.applied, false);
});

test("no web source means no change", () => {
  const result = applyWebSuggestion(photo, { brand: "Nike", model: "Air Max 270" }, []);
  assert.deepEqual(result.analysis, photo);
  assert.equal(result.applied, false);
});

test("web search cannot overwrite an already detected model", () => {
  const known = { ...photo, model: "Air Force 1" };
  const result = applyWebSuggestion(known, { brand: "Nike", model: "Air Max 270" }, ["https://example.com/nike"]);
  assert.deepEqual(result.analysis, known);
});
