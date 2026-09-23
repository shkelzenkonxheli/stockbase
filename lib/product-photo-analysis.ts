import OpenAI from "openai";
import type { ProductAnalysis } from "@/lib/product-match-core";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    brand: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    color: { type: ["string", "null"] },
    material: { type: ["string", "null"] },
    attributes: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["brand", "model", "category", "color", "material", "attributes", "confidence"],
} as const;

export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PRODUCT_PHOTO_BYTES = 8 * 1024 * 1024;

export function hasSupportedPhotoSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function analyzeProductPhoto(image: File, apiKey: string, signal?: AbortSignal): Promise<ProductAnalysis> {
  const dataUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.AI_PRODUCT_MODEL?.trim() || "gpt-5-mini",
    input: [{ role: "user", content: [
      { type: "input_text", text: "Analizo vetem produktin ne foto. Lexo emrin ose logon e brandit kur dallohet qarte. Jep modelin e sakte vetem nese lexohet ne foto; mos e hamendeso nga pamja ose nga brandi. Jep null per brandin ose modelin kur nuk je i sigurt. Ngjyra te jete e shkurter (nje ose dy ngjyra kryesore, p.sh. Brown/Cream), jo pershkrim i detajeve ose i sholles. Per patika, kepuce dhe sandale kthe material null dhe attributes []. Mos hamendeso numrin, sasine, koston ose cmimin." },
      { type: "input_image", image_url: dataUrl, detail: "auto" },
    ] }],
    text: { format: { type: "json_schema", name: "product_analysis", strict: true, schema } },
  }, { signal });
  return JSON.parse(response.output_text) as ProductAnalysis;
}
