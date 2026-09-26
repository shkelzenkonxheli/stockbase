import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { findDuplicateCandidates } from "@/lib/product-duplicate-matching";
import { combineVisualMatch, scoreProductMatch } from "@/lib/product-match-core";
import type { ProductAnalysis } from "@/lib/product-match-core";
import { analysisForProductSearch, isRelevantProductSuggestion } from "@/lib/product-assistant-matching";
import { findExactProductPhoto } from "@/lib/product-exact-photo-match";
import { analyzeProductPhoto, hasSupportedPhotoSignature, MAX_PRODUCT_PHOTO_BYTES, PHOTO_MIME_TYPES } from "@/lib/product-photo-analysis";
import { compareCandidateImages } from "@/lib/product-visual-matching";
import { getAiProductAssistantConfig } from "@/lib/product-taxonomy";
import { enrichProductAnalysisFromWeb } from "@/lib/product-web-enrichment";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant || !hasRole(currentUser, ["SUPER_ADMIN"]) || !getAiProductAssistantConfig(currentUser.tenant.catalogConfig).enabled) {
    return NextResponse.json({ error: "Nuk ke qasje." }, { status: 403 });
  }
  const tenantId = currentUser.tenant.id;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY mungon ne konfigurim." }, { status: 503 });

  const formData = await request.formData();
  const image = formData.get("image");
  if (!(image instanceof File) || !PHOTO_MIME_TYPES.some((type) => type === image.type) || image.size > MAX_PRODUCT_PHOTO_BYTES || !hasSupportedPhotoSignature(image.type, new Uint8Array(await image.slice(0, 12).arrayBuffer()))) {
    return NextResponse.json({ error: "Ngarko nje foto JPG, PNG ose WebP deri ne 8 MB." }, { status: 400 });
  }

  try {
    let analysis: ProductAnalysis = await analyzeProductPhoto(image, apiKey);
    let exactCheckFailed = false;
    const exactLookup = findExactProductPhoto(tenantId, image, analysis.brand).catch((error) => {
      exactCheckFailed = true;
      console.warn("Exact product photo lookup failed", { tenantId, message: error instanceof Error ? error.message : "Unknown" });
      return null;
    });
    let webSources: string[] = [];
    let webSearchFailed = false;
    if (formData.get("searchWeb") === "true") {
      try {
        const suggestion = await enrichProductAnalysisFromWeb(image, apiKey, analysis);
        analysis = suggestion.analysis;
        webSources = suggestion.sources;
      } catch (error) {
        webSearchFailed = true;
        console.warn("Product web verification failed", { code: error instanceof Error ? error.name : "Unknown" });
      }
    }
    try {
      const searchAnalysis = analysisForProductSearch(analysis);
      const exact = await exactLookup;
      if (exact) {
        const candidate = scoreProductMatch(searchAnalysis, exact.product);
        const existingProduct = {
          ...combineVisualMatch(candidate, "STRONG"),
          imagePath: exact.imagePath,
          visualReason: null,
          finalScore: 100,
          confidence: "VERY_HIGH" as const,
          reasons: [...candidate.reasons, "exactPhoto"],
        };
        return NextResponse.json({ analysis, existingProducts: [existingProduct], webSources, webSearchFailed });
      }
      const metadataCandidates = await findDuplicateCandidates(currentUser.tenant.id, searchAnalysis);
      let visualResults: Awaited<ReturnType<typeof compareCandidateImages>> = [];
      try {
        visualResults = await compareCandidateImages(currentUser.tenant.id, image, metadataCandidates);
      } catch (error) {
        console.error("AI visual comparison failed", { code: error instanceof Error ? error.name : "Unknown" });
      }
      const visualById = new Map(visualResults.map((result) => [result.productId, result]));
      const existingProducts = metadataCandidates.map((candidate) => {
        const visual = visualById.get(candidate.id);
        return { ...combineVisualMatch(candidate, visual?.visualMatch ?? "NOT_CHECKED"), visualReason: visual?.reason ?? null };
      }).filter((candidate) => isRelevantProductSuggestion(candidate, searchAnalysis))
        .sort((a, b) => b.finalScore - a.finalScore);
      if (process.env.NODE_ENV === "development") console.info("Product match ranking", { visualComparison: visualResults.map(({ productId, visualMatch }) => ({ productId, visualMatch })), ranking: existingProducts.map((candidate) => ({ productId: candidate.id, confidence: candidate.confidence, fuzzyScore: candidate.fuzzyScore, finalScore: candidate.finalScore })) });
      return NextResponse.json({ analysis, existingProducts, webSources, webSearchFailed, exactCheckFailed });
    } catch (error) {
      console.error("AI product match lookup failed", { tenantId: currentUser.tenant.id, message: error instanceof Error ? error.message : "Unknown error" });
      return NextResponse.json({ analysis, existingProducts: [], matchCheckFailed: true, webSources, webSearchFailed });
    }
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    console.error("AI product analysis failed", { code });
    if (code === "credit_balance_exhausted") {
      return NextResponse.json({ error: "Nuk ka kredi ne OpenAI API. Shto kredi te Billing dhe provo perseri." }, { status: 402 });
    }
    return NextResponse.json({ error: "Analiza e fotos deshtoi. Provo perseri." }, { status: 502 });
  }
}
