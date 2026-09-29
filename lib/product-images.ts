import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { inspectUploadImage, MAX_PRODUCT_PHOTO_BYTES } from "@/lib/image-upload-validation";
import { buildAppAssetUrl, getR2Client, getR2Config } from "@/lib/r2";

export class ProductImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductImageUploadError";
  }
}

function sanitizeFileSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function listProductImages(productId: number) {
  void productId;
  return [];
}

export async function saveProductImage(productId: number, file: File) {
  if (!file || file.size === 0) {
    return null;
  }

  const image = await inspectUploadImage(file, MAX_PRODUCT_PHOTO_BYTES);
  if (!image) throw new ProductImageUploadError("Ngarko nje foto JPG, PNG ose WebP deri ne 8 MB.");

  let config;
  let client;

  try {
    config = getR2Config();
    client = getR2Client();
  } catch (error) {
    throw new ProductImageUploadError(
      error instanceof Error ? error.message : "Mungon konfigurimi i R2 ne .env.",
    );
  }

  const originalBase = path.basename(file.name, path.extname(file.name));
  const safeBase = sanitizeFileSegment(originalBase) || "image";
  const objectKey = `${config.appFolder}/products/${productId}/${Date.now()}-${safeBase}${image.extension}`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: image.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (error) {
    throw new ProductImageUploadError(
      error instanceof Error
        ? `Ngarkimi i fotos ne R2 deshtoi: ${error.message}`
        : "Ngarkimi i fotos ne R2 deshtoi.",
    );
  }

  return buildAppAssetUrl(objectKey);
}
