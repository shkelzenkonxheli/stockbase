import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
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

function extensionFromFile(file: File) {
  const fromName = path.extname(file.name).toLowerCase();

  if (fromName) {
    return fromName;
  }

  switch (file.type) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/avif":
      return ".avif";
    default:
      return ".jpg";
  }
}

export async function listProductImages(productId: number) {
  void productId;
  return [];
}

export async function saveProductImage(productId: number, file: File) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!file.type.startsWith("image/")) {
    throw new ProductImageUploadError("File i zgjedhur nuk eshte foto valide.");
  }

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
  const extension = extensionFromFile(file);
  const objectKey = `${config.appFolder}/products/${productId}/${Date.now()}-${safeBase}${extension}`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: objectKey,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type || "image/jpeg",
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
