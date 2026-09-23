import { getCurrentUser, hasRole } from "@/lib/auth";
import { findPhotoResultDetails } from "@/lib/find-by-photo";
import { isBarcodeEnabled } from "@/lib/inventory-module-access";
import { findDuplicateCandidates, type CandidateSearchStats } from "@/lib/product-duplicate-matching";
import { combineVisualMatch } from "@/lib/product-match-core";
import { analyzeProductPhoto, hasSupportedPhotoSignature, MAX_PRODUCT_PHOTO_BYTES, PHOTO_MIME_TYPES } from "@/lib/product-photo-analysis";
import { getAiProductAssistantConfig } from "@/lib/product-taxonomy";
import { compareCandidateImages } from "@/lib/product-visual-matching";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const tenant = user?.tenant;
  if (!user || !tenant || !hasRole(user, ["SUPER_ADMIN", "SELLER", "WAREHOUSE"]) ||
    !isBarcodeEnabled(tenant.catalogConfig) || !getAiProductAssistantConfig(tenant.catalogConfig).enabled) {
    return Response.json({ error: "Nuk ke qasje." }, { status: 403 });
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Sherbimi i kerkimit me foto nuk eshte konfiguruar." }, { status: 503 });

  let image: FormDataEntryValue | null;
  try {
    image = (await request.formData()).get("image");
  } catch {
    return Response.json({ error: "Fotoja nuk u ngarkua. Provo perseri." }, { status: 400 });
  }
  if (!(image instanceof File) || !PHOTO_MIME_TYPES.includes(image.type as typeof PHOTO_MIME_TYPES[number]) ||
    image.size === 0 || image.size > MAX_PRODUCT_PHOTO_BYTES ||
    !hasSupportedPhotoSignature(image.type, new Uint8Array(await image.slice(0, 16).arrayBuffer()))) {
    return Response.json({ error: "Ngarko nje foto JPG, PNG ose WebP deri ne 8 MB." }, { status: 400 });
  }

  const tenantId = tenant.id;
  const encoder = new TextEncoder();
  const started = Date.now();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown> = {}) => {
        if (!cancelled && !request.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify({ event, ...data })}\n`));
      };
      try {
        send("analyzing");
        const analysisStarted = Date.now();
        const analysis = await analyzeProductPhoto(image, apiKey, request.signal);
        if (request.signal.aborted || cancelled) return;
        const analysisMs = Date.now() - analysisStarted;
        send("searching");
        const searchStats: CandidateSearchStats = { initialCandidateCount: 0, fuzzyRanking: [] };
        const candidates = await findDuplicateCandidates(tenantId, analysis, undefined, (stats) => { Object.assign(searchStats, stats); });
        if (request.signal.aborted || cancelled) return;
        send("comparing");
        let comparedIds: number[] = [];
        const visualStarted = Date.now();
        let visuals: Awaited<ReturnType<typeof compareCandidateImages>> = [];
        try {
          visuals = await compareCandidateImages(tenantId, image, candidates, (ids) => { comparedIds = ids; });
        } catch (error) {
          console.error("Find by Photo visual comparison failed", { code: error instanceof Error ? error.name : "Unknown" });
        }
        if (request.signal.aborted || cancelled) return;
        const visualMs = Date.now() - visualStarted;
        const visualById = new Map(visuals.map((result) => [result.productId, result]));
        const ranked = candidates.map((candidate) => combineVisualMatch(candidate, visualById.get(candidate.id)?.visualMatch ?? "NOT_CHECKED"))
          .sort((a, b) => b.finalScore - a.finalScore);
        const results = await findPhotoResultDetails(tenantId, ranked, analysis);
        if (process.env.NODE_ENV === "development") console.info("Find by Photo", {
          tenantId, analysisMs, metadata: analysis, initialCandidates: searchStats.initialCandidateCount,
          fuzzyRanking: searchStats.fuzzyRanking, comparedIds, visualMs,
          finalRanking: ranked.map((item) => ({ id: item.id, score: item.finalScore, confidence: item.confidence, visual: item.visualMatch })),
          totalMs: Date.now() - started,
        });
        send("result", { results });
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        console.error("Find by Photo failed", { code: code || (error instanceof Error ? error.name : "Unknown") });
        send("error", { message: code === "credit_balance_exhausted" ? "Sherbimi AI nuk ka kredi. Kontakto administratorin." : "Kerkimi me foto deshtoi. Provo perseri." });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() { cancelled = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
