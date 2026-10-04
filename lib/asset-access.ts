import { createHmac, timingSafeEqual } from "node:crypto";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);
export const PUBLIC_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
export const MAX_PUBLIC_IMAGE_BYTES = 25 * 1024 * 1024;
const SIGNATURE_LIFETIME_MS = 15 * 60 * 1000;

export type AssetKey = {
  key: string;
  path: string;
  kind: "product" | "social" | "logo";
  ownerId: number;
};

export function parseAssetPath(pathname: string, appFolder: string): AssetKey | null {
  const prefix = "/api/assets/";
  if (!pathname.startsWith(prefix) || pathname.length > 600) return null;

  let parts: string[];
  try {
    parts = pathname.slice(prefix.length).split("/").map(decodeURIComponent);
  } catch {
    return null;
  }
  if (parts.some((part) => !part || part.length > 160 || !/^[a-zA-Z0-9._-]+$/.test(part) || part === "." || part === "..")) return null;

  const folders = [...new Set([appFolder, "stockbase", "stockbase-test"])];
  for (const folder of folders) {
    const folderParts = folder.split("/");
    if (parts.length !== folderParts.length + 3 || !folderParts.every((part, index) => parts[index] === part)) continue;
    const [kind, id, filename] = parts.slice(folderParts.length);
    if ((kind !== "products" && kind !== "social" && kind !== "logos") || !/^[1-9]\d*$/.test(id)) return null;
    const ownerId = Number(id);
    const extension = filename.split(".").pop()?.toLowerCase();
    if (!Number.isSafeInteger(ownerId) || !extension || !IMAGE_EXTENSIONS.has(extension)) return null;
    const key = parts.join("/");
    return { key, path: `${prefix}${parts.map(encodeURIComponent).join("/")}`, kind: kind === "products" ? "product" : kind === "logos" ? "logo" : "social", ownerId };
  }
  return null;
}

function signature(key: string, tenantId: number, expires: number, secret: string) {
  return createHmac("sha256", secret).update(`stockbase-asset-v1\n${key}\n${tenantId}\n${expires}`).digest("hex");
}

export function signAssetUrl(url: URL, asset: AssetKey, tenantId: number, secret: string, now = Date.now()) {
  const expires = now + SIGNATURE_LIFETIME_MS;
  url.searchParams.set("tenant", String(tenantId));
  url.searchParams.set("expires", String(expires));
  url.searchParams.set("signature", signature(asset.key, tenantId, expires, secret));
  return url.toString();
}

export function verifyAssetSignature(url: URL, asset: AssetKey, tenantId: number, secret: string, now = Date.now()) {
  const expires = Number(url.searchParams.get("expires"));
  const provided = url.searchParams.get("signature") ?? "";
  if (url.searchParams.get("tenant") !== String(tenantId) || !Number.isSafeInteger(expires) || expires <= now || expires > now + SIGNATURE_LIFETIME_MS || !/^[a-f0-9]{64}$/.test(provided)) return false;
  return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(signature(asset.key, tenantId, expires, secret), "hex"));
}
