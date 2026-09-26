import OpenAI from "openai";
import type { ProductAnalysis } from "@/lib/product-match-core";

const webSuggestionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    brand: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
  },
  required: ["brand", "model"],
} as const;

export type ProductWebSuggestion = {
  analysis: ProductAnalysis;
  sources: string[];
  applied: boolean;
};

export function applyWebSuggestion(
  analysis: ProductAnalysis,
  suggestion: { brand: string | null; model: string | null },
  sources: string[],
): ProductWebSuggestion {
  if (!sources.length) return { analysis, sources: [], applied: false };

  const proposedBrand = suggestion.brand?.trim() || null;
  const proposedModel = suggestion.model?.trim() || null;
  const sameBrand = !analysis.brand || (proposedBrand && analysis.brand.localeCompare(proposedBrand, undefined, { sensitivity: "base" }) === 0);
  const brand = analysis.brand || proposedBrand;
  // A conflicting brand is a warning, not permission to replace the photo analysis.
  const model = analysis.model || (sameBrand ? proposedModel : null);
  const applied = brand !== analysis.brand || model !== analysis.model;
  return { analysis: { ...analysis, brand, model }, sources: applied ? sources : [], applied };
}

export async function enrichProductAnalysisFromWeb(
  image: File,
  apiKey: string,
  analysis: ProductAnalysis,
): Promise<ProductWebSuggestion> {
  if (analysis.brand && analysis.model) return { analysis, sources: [], applied: false };

  const client = new OpenAI({ apiKey, timeout: 20000, maxRetries: 0 });
  const dataUrl = `data:${image.type};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  const response = await client.responses.create({
    model: process.env.AI_PRODUCT_WEB_MODEL?.trim() || "gpt-4.1-mini",
    tools: [{ type: "web_search", search_context_size: "low" }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: [{ role: "user", content: [
      { type: "input_text", text: `Examine this product photo and search the web for evidence of its exact brand/model. Initial visual reading: ${JSON.stringify({ brand: analysis.brand, model: analysis.model, category: analysis.category, color: analysis.color })}. Search using visible logos, text and distinctive design. Return null for a field if multiple products could fit or evidence is weak. Never infer a model from brand alone. Do not change the photographed color. Return only brand and model.` },
      { type: "input_image", image_url: dataUrl, detail: "low" },
    ] }],
    text: { format: { type: "json_schema", name: "product_web_suggestion", strict: true, schema: webSuggestionSchema } },
  });

  const sources = [...new Set(response.output.flatMap((item) =>
    item.type === "web_search_call" && item.action.type === "search"
      ? (item.action.sources ?? []).map((source) => source.url)
      : item.type === "message"
        ? item.content.flatMap((content) => content.type === "output_text"
          ? content.annotations.filter((annotation) => annotation.type === "url_citation").map((annotation) => annotation.url)
          : [])
        : [],
  ).filter((url) => { try { return new URL(url).protocol === "https:"; } catch { return false; } }))].slice(0, 3);

  if (!response.output.some((item) => item.type === "web_search_call" && item.status === "completed") || !sources.length) {
    return { analysis, sources: [], applied: false };
  }
  const suggestion = JSON.parse(response.output_text) as { brand: string | null; model: string | null };
  return applyWebSuggestion(analysis, suggestion, sources);
}
