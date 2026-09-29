import OpenAI from "openai";
import type { ProductAnalysis } from "@/lib/product-match-core";
export { PHOTO_MIME_TYPES, MAX_PRODUCT_PHOTO_BYTES, hasSupportedPhotoSignature } from "@/lib/image-upload-validation";

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
