export type ProductAnalysis = {
  brand: string | null;
  model: string | null;
  category: string | null;
  color: string | null;
  material: string | null;
  attributes: string[];
  confidence: number;
};

export type MatchLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
export type VisualMatch = "STRONG" | "POSSIBLE" | "UNLIKELY" | "NOT_CHECKED";
export type MatchSignals = {
  identifier: number;
  brand: number;
  model: number;
  name: number;
  category: number;
  color: number;
  attributes: number;
};

export type MatchVariant = {
  id: number;
  color: string;
  size: string;
  stock: number;
  imagePath: string | null;
  sku: string | null;
  barcode: string | null;
  customAttributes: unknown;
};

export type MatchProduct = {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  variants: MatchVariant[];
};

export const MATCH_CONFIG = {
  weights: { brand: 20, model: 50, name: 5, category: 10, color: 10, attributes: 5 },
  candidateLimit: 120,
  responseLimit: 5,
  visualCandidateLimit: 5,
  photoFallbackScanLimit: 1500,
  photoFallbackShortlistLimit: 80,
  minimumCandidateScore: 15,
  levels: { medium: 45, high: 70, veryHigh: 90 },
  visualAdjustments: { STRONG: 10, POSSIBLE: 3, UNLIKELY: -8, NOT_CHECKED: 0 },
} as const;

export function normalizeProductText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([\p{L}])(\d)/gu, "$1 $2")
    .replace(/(\d)([\p{L}])/gu, "$1 $2")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeModel(model: string | null | undefined, brand: string | null | undefined) {
  const normalizedModel = normalizeProductText(model);
  const normalizedBrand = normalizeProductText(brand);
  if (normalizedBrand && normalizedModel.startsWith(`${normalizedBrand} `)) {
    return normalizedModel.slice(normalizedBrand.length + 1);
  }
  return normalizedModel;
}

export function buildCandidateSearch(tenantId: number, analysis: ProductAnalysis) {
  const normalizedModel = normalizeModel(analysis.model, analysis.brand);
  const tokens = normalizedModel.split(" ").filter((token) => token.length >= 3).sort((a, b) => Number(/\d/.test(b)) - Number(/\d/.test(a)) || b.length - a.length);
  const needles = [...new Set([analysis.model?.trim(), ...tokens, analysis.brand?.trim()].filter((value): value is string => Boolean(value)))].slice(0, 5);
  return {
    tenantId,
    needles,
    where: { tenantId, OR: needles.flatMap((needle) => [
      { name: { contains: needle, mode: "insensitive" as const } },
      { brand: { contains: needle, mode: "insensitive" as const } },
    ]) },
  };
}

function distance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const old = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return previous[right.length];
}

export function textSimilarity(left: string | null | undefined, right: string | null | undefined) {
  const a = normalizeProductText(left);
  const b = normalizeProductText(right);
  if (!a || !b) return 0;
  if (a === b || a.replace(/\s/g, "") === b.replace(/\s/g, "")) return 1;
  const tokensA = new Set(a.split(" "));
  const tokensB = new Set(b.split(" "));
  const overlap = [...tokensA].filter((token) => tokensB.has(token)).length;
  const tokenScore = overlap / Math.max(tokensA.size, tokensB.size);
  const compactA = a.replace(/\s/g, "");
  const compactB = b.replace(/\s/g, "");
  const editScore = 1 - distance(compactA, compactB) / Math.max(compactA.length, compactB.length);
  return Math.max(0, Math.min(1, Math.max(editScore, tokenScore)));
}

function categorySimilarity(left: string | null, right: string) {
  const aliases: Record<string, string> = { sneakers: "patika", sneaker: "patika", trainers: "patika", atlete: "patika", shoes: "kepuce", sandals: "sandale" };
  const a = normalizeProductText(left);
  const b = normalizeProductText(right);
  return textSimilarity(aliases[a] ?? a, aliases[b] ?? b);
}

function attributeSimilarity(analysis: ProductAnalysis, variant: MatchVariant) {
  if (analysis.attributes.length === 0) return 0;
  const values = variant.customAttributes && typeof variant.customAttributes === "object" && !Array.isArray(variant.customAttributes)
    ? Object.values(variant.customAttributes).filter((value): value is string => typeof value === "string")
    : [];
  const existing = values.join(" ");
  return existing ? textSimilarity(analysis.attributes.join(" "), existing) : 0;
}

export function scoreProductMatch(analysis: ProductAnalysis, product: MatchProduct, identifier?: string | null) {
  const normalizedModel = normalizeModel(analysis.model, analysis.brand);
  const productModel = normalizeModel(product.name, product.brand);
  const identifierValue = identifier?.trim().toUpperCase();
  const identifierMatch = Boolean(identifierValue && product.variants.some((variant) => variant.sku?.toUpperCase() === identifierValue || variant.barcode?.toUpperCase() === identifierValue));
  const rankedVariants = product.variants.map((variant) => ({
    ...variant,
    colorSimilarity: textSimilarity(analysis.color, variant.color),
    attributeSimilarity: attributeSimilarity(analysis, variant),
  })).sort((a, b) => b.colorSimilarity - a.colorSimilarity || b.attributeSimilarity - a.attributeSimilarity);
  const best = rankedVariants[0];
  const signals: MatchSignals = {
    identifier: identifierMatch ? 1 : 0,
    brand: textSimilarity(analysis.brand, product.brand),
    model: textSimilarity(normalizedModel, productModel),
    name: textSimilarity(analysis.model, product.name),
    category: categorySimilarity(analysis.category, product.category),
    color: best?.colorSimilarity ?? 0,
    attributes: best?.attributeSimilarity ?? 0,
  };
  const fuzzyScore = identifierMatch ? 100 : Math.round(Object.entries(MATCH_CONFIG.weights).reduce((total, [key, weight]) => total + weight * signals[key as keyof typeof MATCH_CONFIG.weights], 0));
  const strongModelAndBrand = signals.model >= 0.88 && signals.brand >= 0.8;
  const confidence: MatchLevel = identifierMatch || (fuzzyScore >= MATCH_CONFIG.levels.veryHigh && signals.model >= 0.98 && signals.brand >= 0.98)
    ? "VERY_HIGH"
    : fuzzyScore >= MATCH_CONFIG.levels.high && strongModelAndBrand ? "HIGH"
    : fuzzyScore >= MATCH_CONFIG.levels.medium ? "MEDIUM" : "LOW";
  const reasons = [
    identifierMatch ? "identifier" : null,
    signals.brand >= 0.9 ? "brand" : null,
    signals.model >= 0.8 ? "model" : null,
    signals.category >= 0.9 ? "category" : null,
    signals.color >= 0.75 ? "color" : null,
    signals.attributes >= 0.75 ? "attributes" : null,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    id: product.id,
    productId: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    color: best?.color ?? null,
    imagePath: best?.imagePath ?? rankedVariants.find((variant) => variant.imagePath)?.imagePath ?? null,
    matchedVariants: rankedVariants.slice(0, 5).map((variant) => ({ id: variant.id, color: variant.color, size: variant.size, stock: variant.stock, imagePath: variant.imagePath, colorSimilarity: variant.colorSimilarity })),
    signals,
    fuzzyScore,
    confidence,
    reasons,
    matchedOn: reasons,
  };
}

export function shortlistPhotoMetadata(analysis: ProductAnalysis, products: Array<Pick<MatchProduct, "id" | "name" | "brand" | "category">>) {
  return products.map((product) => ({
    id: product.id,
    score: scoreProductMatch(analysis, { ...product, variants: [] }).fuzzyScore,
  })).filter((product) => product.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MATCH_CONFIG.photoFallbackShortlistLimit)
    .map((product) => product.id);
}

export function combineVisualMatch<T extends ReturnType<typeof scoreProductMatch>>(candidate: T, visualMatch: VisualMatch) {
  const finalScore = Math.max(0, Math.min(100, candidate.fuzzyScore + MATCH_CONFIG.visualAdjustments[visualMatch]));
  const confidence: MatchLevel = candidate.signals.identifier === 1
    ? "VERY_HIGH"
    : visualMatch === "UNLIKELY" && candidate.signals.model < 0.98 ? "LOW"
    : finalScore >= MATCH_CONFIG.levels.veryHigh && candidate.signals.model >= 0.98 && candidate.signals.brand >= 0.98 ? "VERY_HIGH"
    : finalScore >= MATCH_CONFIG.levels.high && candidate.signals.model >= 0.88 && candidate.signals.brand >= 0.8 ? "HIGH"
    : finalScore >= MATCH_CONFIG.levels.medium ? "MEDIUM" : "LOW";
  return { ...candidate, visualMatch, finalScore, confidence, reasons: visualMatch === "STRONG" ? [...candidate.reasons, "visual"] : candidate.reasons };
}
