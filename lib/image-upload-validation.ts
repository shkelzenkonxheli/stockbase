export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PRODUCT_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_SOCIAL_PHOTO_BYTES = 10 * 1024 * 1024;

const extensionByMimeType: Record<(typeof PHOTO_MIME_TYPES)[number], string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function hasSupportedPhotoSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function inspectUploadImage(file: File, maxBytes: number) {
  if (!file.size || file.size > maxBytes || !PHOTO_MIME_TYPES.includes(file.type as (typeof PHOTO_MIME_TYPES)[number])) return null;
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasSupportedPhotoSignature(file.type, signature)) return null;
  return { contentType: file.type, extension: extensionByMimeType[file.type as (typeof PHOTO_MIME_TYPES)[number]] };
}
