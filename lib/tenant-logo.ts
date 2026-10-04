import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { inspectUploadImage } from "@/lib/image-upload-validation";
import { buildAppAssetUrl, getR2Client, getR2Config } from "@/lib/r2";

export const MAX_TENANT_LOGO_BYTES = 2 * 1024 * 1024;

export async function saveTenantLogo(tenantId: number, file: File) {
  const image = await inspectUploadImage(file, MAX_TENANT_LOGO_BYTES);
  if (!image) throw new Error("Logoja duhet te jete JPG, PNG ose WebP deri ne 2 MB.");
  const config = getR2Config();
  const key = `${config.appFolder}/logos/${tenantId}/${randomUUID()}${image.extension}`;
  await getR2Client().send(new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: Buffer.from(await file.arrayBuffer()),
    ContentType: image.contentType,
    CacheControl: "private, no-store",
  }));
  return buildAppAssetUrl(key);
}
