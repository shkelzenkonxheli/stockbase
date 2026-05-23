import { createHash } from "node:crypto";
import path from "node:path";

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

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const appFolder = sanitizeCloudinaryFolder(
    process.env.CLOUDINARY_APP_FOLDER || "stockbase",
  );

  if (!cloudName || !apiKey || !apiSecret) {
    throw new ProductImageUploadError(
      "Mungojne kredencialet e Cloudinary ne .env.",
    );
  }

  return { cloudName, apiKey, apiSecret, appFolder };
}

function sanitizeCloudinaryFolder(value: string) {
  return value
    .split("/")
    .map((segment) => sanitizeFileSegment(segment))
    .filter(Boolean)
    .join("/");
}

function buildCloudinarySignature(
  params: Record<string, string | number>,
  apiSecret: string,
) {
  const sortedEntries = Object.entries(params).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const signatureBase = sortedEntries
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1")
    .update(`${signatureBase}${apiSecret}`)
    .digest("hex");
}

export async function saveProductImage(productId: number, file: File) {
  if (!file || file.size === 0) {
    return null;
  }

  if (!file.type.startsWith("image/")) {
    throw new ProductImageUploadError("File i zgjedhur nuk eshte foto valide.");
  }

  const config = cloudinaryConfig();

  if (!config) {
    return null;
  }

  const originalBase = path.basename(file.name, path.extname(file.name));
  const safeBase = sanitizeFileSegment(originalBase) || "image";
  const extension = extensionFromFile(file);
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${config.appFolder}/products/${productId}/${Date.now()}-${safeBase}`.replace(
    new RegExp(`${extension.replace(".", "\\.")}$`),
    "",
  );
  const signature = buildCloudinarySignature(
    {
      public_id: publicId,
      timestamp,
    },
    config.apiSecret,
  );
  const formData = new FormData();

  formData.append("file", file);
  formData.append("api_key", config.apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("public_id", publicId);
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const errorResult = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    const errorMessage =
      errorResult?.error?.message ||
      "Ngarkimi i fotos ne Cloudinary deshtoi.";

    throw new ProductImageUploadError(errorMessage);
  }

  const result = (await response.json()) as { secure_url?: string };

  if (!result.secure_url) {
    throw new ProductImageUploadError(
      "Cloudinary nuk ktheu URL per foton e ngarkuar.",
    );
  }

  return result.secure_url;
}
