import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { findDuplicateCandidates } from "@/lib/product-duplicate-matching";
import { combineVisualMatch } from "@/lib/product-match-core";
import type { ProductAnalysis } from "@/lib/product-match-core";
import { analyzeProductPhoto } from "@/lib/product-photo-analysis";
import { compareCandidateImages } from "@/lib/product-visual-matching";
import { getAiProductAssistantConfig } from "@/lib/product-taxonomy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant || !hasRole(currentUser, ["SUPER_ADMIN"]) || !getAiProductAssistantConfig(currentUser.tenant.catalogConfig).enabled) {
    return NextResponse.json({ error: "Nuk ke qasje." }, { status: 403 });
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY mungon ne konfigurim." }, { status: 503 });

  const formData = await request.formData();
  const image = formData.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/") || image.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Ngarko nje foto JPG, PNG ose WebP deri ne 8 MB." }, { status: 400 });
  }

  try {
    const analysis: ProductAnalysis = await analyzeProductPhoto(image, apiKey);
    try {
      const metadataCandidates = await findDuplicateCandidates(currentUser.tenant.id, analysis);
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
      }).sort((a, b) => b.finalScore - a.finalScore);
      if (process.env.NODE_ENV === "development") console.info("Product match ranking", { visualComparison: visualResults.map(({ productId, visualMatch }) => ({ productId, visualMatch })), ranking: existingProducts.map((candidate) => ({ productId: candidate.id, confidence: candidate.confidence, fuzzyScore: candidate.fuzzyScore, finalScore: candidate.finalScore })) });
      return NextResponse.json({ analysis, existingProducts });
    } catch (error) {
      console.error("AI product match lookup failed", { tenantId: currentUser.tenant.id, message: error instanceof Error ? error.message : "Unknown error" });
      return NextResponse.json({ analysis, existingProducts: [], matchCheckFailed: true });
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
