import { PutObjectCommand } from "@aws-sdk/client-s3";
import { inspectUploadImage, MAX_SOCIAL_PHOTO_BYTES } from "@/lib/image-upload-validation";
import { buildAppAssetUrl, getR2Client, getR2Config } from "@/lib/r2";

export async function saveSocialImage(tenantId: number, file: File) {
  const image = await inspectUploadImage(file, MAX_SOCIAL_PHOTO_BYTES);
  if (!image) throw new Error("Ngarko nje foto JPG, PNG ose WebP deri ne 10 MB.");
  const config = getR2Config();
  const key = `${config.appFolder}/social/${tenantId}/${Date.now()}${image.extension}`;
  await getR2Client().send(new PutObjectCommand({ Bucket: config.bucketName, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: image.contentType, CacheControl: "public, max-age=31536000, immutable" }));
  return buildAppAssetUrl(key);
}
