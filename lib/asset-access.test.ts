import assert from "node:assert/strict";
import test from "node:test";
import { parseAssetPath, signAssetUrl, verifyAssetSignature } from "./asset-access";

test("only product and social raster image paths in known folders are public asset candidates", () => {
  assert.deepEqual(parseAssetPath("/api/assets/stockbase/products/42/123-shoe.jpg", "stockbase"), {
    key: "stockbase/products/42/123-shoe.jpg", path: "/api/assets/stockbase/products/42/123-shoe.jpg", kind: "product", ownerId: 42,
  });
  assert.equal(parseAssetPath("/api/assets/stockbase-test/social/3/123.png", "stockbase")?.kind, "social");
  assert.equal(parseAssetPath("/api/assets/company/media/products/42/photo.webp", "company/media")?.ownerId, 42);
  for (const path of [
    "/api/assets/stockbase/backups/database.sql", "/api/assets/other/products/42/photo.jpg",
    "/api/assets/stockbase/products/42/photo.svg", "/api/assets/stockbase/products/42/%2e%2e/photo.jpg",
    "/api/assets/stockbase/products/42/%2fsecret.jpg", "/api/assets/stockbase/products/0/photo.jpg",
  ]) assert.equal(parseAssetPath(path, "stockbase"), null, path);
});

test("asset signatures are tenant-scoped, key-scoped and short-lived", () => {
  const asset = parseAssetPath("/api/assets/stockbase/products/42/photo.jpg", "stockbase");
  assert.ok(asset);
  const now = 1_000_000;
  const url = new URL(signAssetUrl(new URL(`https://example.com${asset.path}`), asset, 3, "test-secret", now));
  assert.equal(verifyAssetSignature(url, asset, 3, "test-secret", now), true);
  assert.equal(verifyAssetSignature(url, asset, 4, "test-secret", now), false);
  assert.equal(verifyAssetSignature(url, asset, 3, "test-secret", now + 15 * 60 * 1000), false);
  const other = parseAssetPath("/api/assets/stockbase/products/43/photo.jpg", "stockbase");
  assert.ok(other);
  assert.equal(verifyAssetSignature(url, other, 3, "test-secret", now), false);
  url.searchParams.set("signature", "0".repeat(64));
  assert.equal(verifyAssetSignature(url, asset, 3, "test-secret", now), false);
});
