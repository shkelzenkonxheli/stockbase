import { createHash } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { trustedProductImageKey } from "@/lib/product-image-key";
import { getR2Client, getR2Config } from "@/lib/r2";
import type { MatchProduct } from "@/lib/product-match-core";

const PAGE_SIZE = 200;
const BATCH_SIZE = 16;
const PREFIX_BYTES = 16 * 1024;

export function normalizeObjectEtag(etag: string | undefined) {
  return etag?.replace(/^"|"$/g, "").toLowerCase() ?? "";
}

export type ExactPhotoMatch = { product: MatchProduct; imagePath: string };

export async function findExactProductPhoto(tenantId: number, image: File, brandHint: string | null): Promise<ExactPhotoMatch | null> {
  const bytes = Buffer.from(await image.arrayBuffer());
  const md5 = createHash("md5").update(bytes).digest("hex");
  const config = getR2Config();
  const client = getR2Client();
  const allowedFolders = [...new Set([config.appFolder, "stockbase", "stockbase-test"])];
  const inspected = new Set<string>();
  let errors = 0;

  async function inspect(productId: number, imagePath: string) {
    const key = allowedFolders.map((folder) => trustedProductImageKey(imagePath, productId, folder)).find((value) => value !== null);
    if (!key || inspected.has(key)) return false;
    inspected.add(key);
    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: config.bucketName, Key: key }));
      if (head.ContentLength !== bytes.length) return false;
      const etag = normalizeObjectEtag(head.ETag);
      if (/^[a-f0-9]{32}$/.test(etag) && etag !== md5) return false;
      // Non-MD5 ETags can occur with multipart uploads; compare a short prefix first.
      if (etag !== md5) {
        const prefixLength = Math.min(bytes.length, PREFIX_BYTES);
        const prefix = await client.send(new GetObjectCommand({ Bucket: config.bucketName, Key: key, Range: `bytes=0-${prefixLength - 1}` }));
        if (!prefix.Body || !Buffer.from(await prefix.Body.transformToByteArray()).equals(bytes.subarray(0, prefixLength))) return false;
      }
      const full = await client.send(new GetObjectCommand({ Bucket: config.bucketName, Key: key }));
      return Boolean(full.Body && Buffer.from(await full.Body.transformToByteArray()).equals(bytes));
    } catch {
      errors += 1;
      return false;
    }
  }

  async function scan(brand: string | null) {
    let cursor: number | undefined;
    while (true) {
      const rows = await prisma.variant.findMany({
        where: { imagePath: { not: null }, product: { tenantId, ...(brand ? { brand: { contains: brand, mode: "insensitive" as const } } : {}) } },
        orderBy: { id: "asc" },
        take: PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, productId: true, imagePath: true },
      });
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;
      for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
        const matches = await Promise.all(rows.slice(offset, offset + BATCH_SIZE).map(async (row) =>
          row.imagePath && await inspect(row.productId, row.imagePath) ? row : null));
        const found = matches.find((row): row is NonNullable<typeof row> => row !== null);
        if (found?.imagePath) return { productId: found.productId, imagePath: found.imagePath };
      }
      if (rows.length < PAGE_SIZE) break;
    }
    return null;
  }

  const match = (brandHint ? await scan(brandHint) : null) ?? await scan(null);
  if (process.env.NODE_ENV === "development") console.info("Exact product photo lookup", { tenantId, imagesChecked: inspected.size, errors, matchedProductId: match?.productId ?? null });
  if (!match) {
    if (errors && errors === inspected.size) throw new Error("R2 photo lookup failed for all candidate images");
    return null;
  }
  const product = await prisma.product.findFirst({
    where: { id: match.productId, tenantId },
    select: { id: true, name: true, brand: true, category: { select: { name: true } }, variants: { select: { id: true, color: true, size: true, stock: true, imagePath: true, sku: true, barcode: true, customAttributes: true }, take: 100 } },
  });
  return product ? { product: { ...product, category: product.category.name, variants: product.variants }, imagePath: match.imagePath } : null;
}
