import { GetObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { trustedProductImageKey } from "@/lib/product-image-key";
import { getR2Client, getR2Config } from "@/lib/r2";
import { MATCH_CONFIG, type VisualMatch } from "@/lib/product-match-core";

type VisualCandidate = { id: number; imagePath: string | null };
type VisualResult = { productId: number; visualMatch: VisualMatch; reason: string | null };

const visualSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    matches: { type: "array", items: {
      type: "object", additionalProperties: false,
      properties: { productId: { type: "integer" }, visualMatch: { type: "string", enum: ["STRONG", "POSSIBLE", "UNLIKELY"] }, reason: { type: ["string", "null"] } },
      required: ["productId", "visualMatch", "reason"],
    } },
  },
  required: ["matches"],
} as const;

async function readCandidateImage(imagePath: string, productId: number) {
  const config = getR2Config();
  const key = trustedProductImageKey(imagePath, productId, config.appFolder);
  if (!key) return null;
  const result = await getR2Client().send(new GetObjectCommand({ Bucket: config.bucketName, Key: key }));
  if (!result.Body || (result.ContentLength && result.ContentLength > 4 * 1024 * 1024)) return null;
  const mimeType = (result.ContentType ?? "").split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) return null;
  const bytes = Buffer.from(await result.Body.transformToByteArray());
  if (bytes.length > 4 * 1024 * 1024) return null;
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export async function compareCandidateImages(tenantId: number, uploadedImage: File, candidates: VisualCandidate[], onCompared?: (productIds: number[]) => void): Promise<VisualResult[]> {
  const chosen = candidates.slice(0, MATCH_CONFIG.visualCandidateLimit);
  const fallback = chosen.map((candidate) => ({ productId: candidate.id, visualMatch: "NOT_CHECKED" as const, reason: null }));
  if (!chosen.length || !process.env.OPENAI_API_KEY) {
    onCompared?.([]);
    return fallback;
  }

  const ownedProducts = await prisma.product.findMany({
    where: { tenantId, id: { in: chosen.map((candidate) => candidate.id) } },
    select: { id: true, variants: { where: { imagePath: { not: null } }, select: { imagePath: true }, take: 20 } },
  });
  const ownedById = new Map(ownedProducts.map((product) => [product.id, product]));
  const images = await Promise.all(chosen.map(async (candidate) => {
    const owned = ownedById.get(candidate.id);
    const path = owned?.variants.find((variant) => variant.imagePath === candidate.imagePath)?.imagePath ?? owned?.variants[0]?.imagePath;
    if (!path) return null;
    try {
      const image = await readCandidateImage(path, candidate.id);
      return image ? { productId: candidate.id, image } : null;
    } catch {
      return null;
    }
  }));
  const available = images.filter((image): image is { productId: number; image: string } => Boolean(image));
  onCompared?.(available.map((image) => image.productId));
  if (available.length === 0) return fallback;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const uploadedDataUrl = `data:${uploadedImage.type};base64,${Buffer.from(await uploadedImage.arrayBuffer()).toString("base64")}`;
  const response = await client.responses.create({
    model: process.env.AI_VISUAL_MODEL?.trim() || process.env.AI_PRODUCT_MODEL?.trim() || "gpt-5-mini",
    input: [{ role: "user", content: [
      { type: "input_text", text: "Compare image 0 (new product) with each numbered existing product image. Assess whether they could depict the same product/model despite different angles, background or lighting. Different models with similar styling must not be STRONG. Return one item per existing product ID. Do not infer SKU, barcode or identity from appearance alone." },
      { type: "input_image", image_url: uploadedDataUrl, detail: "low" },
      ...available.flatMap((entry) => [
        { type: "input_text" as const, text: `Existing product ID ${entry.productId}:` },
        { type: "input_image" as const, image_url: entry.image, detail: "low" as const },
      ]),
    ] }],
    text: { format: { type: "json_schema", name: "product_visual_match", strict: true, schema: visualSchema } },
  });
  const parsed = JSON.parse(response.output_text) as { matches: Array<{ productId: number; visualMatch: VisualMatch; reason: string | null }> };
  const returned = new Map(parsed.matches.filter((item) => available.some((entry) => entry.productId === item.productId) && ["STRONG", "POSSIBLE", "UNLIKELY"].includes(item.visualMatch)).map((item) => [item.productId, item]));
  return fallback.map((item) => returned.get(item.productId) ?? item);
}
