import assert from "node:assert/strict";
import test from "node:test";
import { inspectUploadImage } from "./image-upload-validation";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test("upload validation uses image bytes and MIME, not the filename extension", async () => {
  const file = new File([png], "photo.svg", { type: "image/png" });
  assert.deepEqual(await inspectUploadImage(file, 100), { contentType: "image/png", extension: ".png" });
  assert.equal(await inspectUploadImage(new File([png], "photo.png", { type: "image/jpeg" }), 100), null);
  assert.equal(await inspectUploadImage(new File(["<svg></svg>"], "photo.svg", { type: "image/svg+xml" }), 100), null);
  assert.equal(await inspectUploadImage(file, 5), null);
  assert.equal(await inspectUploadImage(new File([], "empty.png", { type: "image/png" }), 100), null);
});
