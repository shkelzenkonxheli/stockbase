import { getCurrentUser, hasRole } from "@/lib/auth";
import { findPhotoResultDetails } from "@/lib/find-by-photo";
import { isBarcodeEnabled } from "@/lib/inventory-module-access";
import { canSkipPhotoVisualComparison } from "@/lib/photo-match-policy";
import { prisma } from "@/lib/prisma";
import { findPhotoCandidates, type PhotoCandidateSearchStats } from "@/lib/product-duplicate-matching";
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Fotoja nuk u ngarkua. Provo perseri." }, { status: 400 });
  }
  const image = formData.get("image");
  if (!(image instanceof File) || !PHOTO_MIME_TYPES.includes(image.type as typeof PHOTO_MIME_TYPES[number]) ||
    image.size === 0 || image.size > MAX_PRODUCT_PHOTO_BYTES ||
    !hasSupportedPhotoSignature(image.type, new Uint8Array(await image.slice(0, 16).arrayBuffer()))) {
    return Response.json({ error: "Ngarko nje foto JPG, PNG ose WebP deri ne 8 MB." }, { status: 400 });
  }

  const tenantId = tenant.id;
  const warehouseValue = formData.get("warehouseId");
  if (warehouseValue !== null && (typeof warehouseValue !== "string" || !/^[1-9]\d*$/.test(warehouseValue))) {
    return Response.json({ error: "Depoja e zgjedhur nuk eshte valide." }, { status: 400 });
  }
  const warehouseId = warehouseValue === null ? null : Number(warehouseValue);
  if (warehouseId !== null && (!Number.isSafeInteger(warehouseId) ||
    !await prisma.warehouse.findFirst({ where: { id: warehouseId, tenantId, isActive: true }, select: { id: true } }))) {
    return Response.json({ error: "Depoja e zgjedhur nuk eshte valide." }, { status: 400 });
  }
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
        const searchStarted = Date.now();
        const searchStats: PhotoCandidateSearchStats = { initialCandidateCount: 0, fuzzyRanking: [], fallbackScanned: 0, fallbackShortlisted: 0 };
        const candidates = await findPhotoCandidates(tenantId, analysis, warehouseId, (stats) => { Object.assign(searchStats, stats); });
        if (request.signal.aborted || cancelled) return;
        const searchMs = Date.now() - searchStarted;
        const skipVisual = canSkipPhotoVisualComparison(analysis, candidates);
        const metadataRanked = candidates.map((candidate) => combineVisualMatch(candidate, "NOT_CHECKED"));
        let comparedIds: number[] = [];
        let previewMs = 0;
        let visualMs = 0;
        let visuals: Awaited<ReturnType<typeof compareCandidateImages>> = [];
        if (candidates.length && !skipVisual) {
          const visualStarted = Date.now();
          const visualPromise = compareCandidateImages(tenantId, image, candidates, (ids) => { comparedIds = ids; })
            .then((results) => { visualMs = Date.now() - visualStarted; return results; })
            .catch((error): Awaited<ReturnType<typeof compareCandidateImages>> => {
              visualMs = Date.now() - visualStarted;
              console.error("Find by Photo visual comparison failed", { code: error instanceof Error ? error.name : "Unknown" });
              return [];
            });
          const previewStarted = Date.now();
          const previewResults = await findPhotoResultDetails(tenantId, metadataRanked, analysis, warehouseId);
          previewMs = Date.now() - previewStarted;
          if (request.signal.aborted || cancelled) return;
          if (previewResults.length) send("preview", { results: previewResults });
          send("comparing");
          visuals = await visualPromise;
        }
        if (request.signal.aborted || cancelled) return;
        const visualById = new Map(visuals.map((result) => [result.productId, result]));
        const ranked = candidates.map((candidate) => combineVisualMatch(candidate, visualById.get(candidate.id)?.visualMatch ?? "NOT_CHECKED"))
          .sort((a, b) => b.finalScore - a.finalScore);
        const results = await findPhotoResultDetails(tenantId, ranked, analysis, warehouseId);
        if (process.env.NODE_ENV === "development") console.info("Find by Photo", {
          tenantId, warehouseId, analysisMs, searchMs, previewMs, metadata: analysis, initialCandidates: searchStats.initialCandidateCount,
          fallbackScanned: searchStats.fallbackScanned, fallbackShortlisted: searchStats.fallbackShortlisted, skipVisual,
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
