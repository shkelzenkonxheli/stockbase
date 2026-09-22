import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { buildAppAssetUrl, getR2Client, getR2Config } from "@/lib/r2";

export async function saveSocialImage(tenantId: number, file: File) {
  if (!file || file.size === 0 || !file.type.startsWith("image/")) throw new Error("Zgjidh nje foto valide.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Foto mund te jete maksimumi 10MB.");
  const config = getR2Config();
  const extension = path.extname(file.name).toLowerCase() || ".jpg";
  const key = `${config.appFolder}/social/${tenantId}/${Date.now()}${extension}`;
  await getR2Client().send(new PutObjectCommand({ Bucket: config.bucketName, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type, CacheControl: "public, max-age=31536000, immutable" }));
  return buildAppAssetUrl(key);
}
