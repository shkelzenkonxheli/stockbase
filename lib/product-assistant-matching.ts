import { normalizeModel, normalizeProductText, type ProductAnalysis, type VisualMatch, type scoreProductMatch } from "@/lib/product-match-core";

const genericProductWords = new Set(["sneaker", "sneakers", "shoe", "shoes", "trainer", "trainers", "patika", "kepuce", "sandale"]);

export function analysisForProductSearch(analysis: ProductAnalysis): ProductAnalysis {
  const model = normalizeModel(analysis.model, analysis.brand);
  if (!model) return analysis;
  const descriptors = new Set([
    ...normalizeProductText(analysis.color).split(" "),
    ...normalizeProductText(analysis.category).split(" "),
    ...genericProductWords,
  ]);
  const trimmed = model.split(" ").filter((token) => !descriptors.has(token)).join(" ");
  return { ...analysis, model: trimmed || analysis.model };
}

type Candidate = ReturnType<typeof scoreProductMatch> & { visualMatch: VisualMatch };

export function isRelevantProductSuggestion(candidate: Candidate, analysis: ProductAnalysis) {
  if (candidate.signals.identifier === 1) return true;
  if (analysis.brand && candidate.signals.brand < 0.75) return false;
  if (analysis.model && candidate.signals.model >= 0.88) return true;
  if (candidate.visualMatch === "UNLIKELY") return false;
  if (analysis.model && candidate.signals.model >= 0.65) return true;
  return candidate.visualMatch === "STRONG" && candidate.signals.category >= 0.7 && candidate.signals.color >= 0.45;
}
