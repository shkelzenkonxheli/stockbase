import { prisma } from "@/lib/prisma";
import { photoWarehouseProductFilter } from "@/lib/photo-match-policy";
import { MATCH_CONFIG, buildCandidateSearch, normalizeModel, normalizeProductText, scoreProductMatch, shortlistPhotoMetadata, type ProductAnalysis } from "@/lib/product-match-core";

export type CandidateSearchStats = { initialCandidateCount: number; fuzzyRanking: Array<{ productId: number; score: number }> };

export async function findDuplicateCandidates(tenantId: number, analysis: ProductAnalysis, identifier?: string | null, onStats?: (stats: CandidateSearchStats) => void, warehouseId: number | null = null) {
  const { needles } = buildCandidateSearch(tenantId, analysis);
  const warehouseFilter = photoWarehouseProductFilter(tenantId, warehouseId);
  const normalizedModel = normalizeModel(analysis.model, analysis.brand);
  if (needles.length === 0 && !identifier) {
    onStats?.({ initialCandidateCount: 0, fuzzyRanking: [] });
    return [];
  }

  const [textProductGroups, identifierVariants] = await Promise.all([
    Promise.all(needles.map((needle) => prisma.product.findMany({
      where: { tenantId, ...warehouseFilter, OR: [{ name: { contains: needle, mode: "insensitive" } }, { brand: { contains: needle, mode: "insensitive" } }] },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }))),
    identifier ? prisma.variant.findMany({ where: { tenantId, ...(warehouseId === null ? {} : { inventories: { some: { warehouseId, stock: { gt: 0 }, warehouse: { tenantId } } } }), OR: [{ sku: { equals: identifier, mode: "insensitive" } }, { barcode: { equals: identifier, mode: "insensitive" } }] }, select: { productId: true }, take: 5 }) : Promise.resolve([]),
  ]);
  const ids = [...new Set([...identifierVariants.map((variant) => variant.productId), ...textProductGroups.flat().map((product) => product.id)])].slice(0, MATCH_CONFIG.candidateLimit);
  if (ids.length === 0) {
    onStats?.({ initialCandidateCount: 0, fuzzyRanking: [] });
    return [];
  }
  const products = await prisma.product.findMany({
    where: { tenantId, ...warehouseFilter, id: { in: ids } },
    select: {
      id: true, name: true, brand: true, category: { select: { name: true } },
      variants: { select: { id: true, color: true, size: true, stock: true, imagePath: true, sku: true, barcode: true, customAttributes: true }, take: 100 },
    },
  });
  const results = products.map((product) => scoreProductMatch(analysis, { ...product, category: product.category.name, variants: product.variants }, identifier))
    .filter((candidate) => candidate.fuzzyScore >= MATCH_CONFIG.minimumCandidateScore)
    .sort((a, b) => b.fuzzyScore - a.fuzzyScore)
    .slice(0, MATCH_CONFIG.responseLimit);
  onStats?.({ initialCandidateCount: ids.length, fuzzyRanking: results.map((candidate) => ({ productId: candidate.id, score: candidate.fuzzyScore })) });
  if (process.env.NODE_ENV === "development") console.info("Product duplicate match", { normalized: { brand: normalizeProductText(analysis.brand), model: normalizedModel, category: normalizeProductText(analysis.category), color: normalizeProductText(analysis.color) }, candidateCount: products.length, scores: results.map(({ fuzzyScore, confidence }) => ({ fuzzyScore, confidence })) });
  return results;
}

export type PhotoCandidateSearchStats = CandidateSearchStats & { fallbackScanned: number; fallbackShortlisted: number };

export async function findPhotoCandidates(tenantId: number, analysis: ProductAnalysis, warehouseId: number | null = null, onStats?: (stats: PhotoCandidateSearchStats) => void) {
  let primaryStats: CandidateSearchStats = { initialCandidateCount: 0, fuzzyRanking: [] };
  const primary = await findDuplicateCandidates(tenantId, analysis, undefined, (stats) => { primaryStats = stats; }, warehouseId);
  const warehouseFilter = photoWarehouseProductFilter(tenantId, warehouseId);
  let fallbackScanned = 0;
  let fallbackShortlisted = 0;
  let combined = primary;

  if (!primary.some((candidate) => candidate.fuzzyScore >= MATCH_CONFIG.levels.high && candidate.signals.model >= 0.88)) {
    const metadata = await prisma.product.findMany({
      where: { tenantId, ...warehouseFilter },
      orderBy: { id: "desc" },
      take: MATCH_CONFIG.photoFallbackScanLimit,
      select: { id: true, name: true, brand: true, category: { select: { name: true } } },
    });
    fallbackScanned = metadata.length;
    const ids = shortlistPhotoMetadata(analysis, metadata.map((product) => ({
      id: product.id, name: product.name, brand: product.brand, category: product.category.name,
    })));
    fallbackShortlisted = ids.length;
    if (ids.length) {
      const products = await prisma.product.findMany({
        where: { tenantId, ...warehouseFilter, id: { in: ids } },
        select: {
          id: true, name: true, brand: true, category: { select: { name: true } },
          variants: { where: { tenantId }, select: { id: true, color: true, size: true, stock: true, imagePath: true, sku: true, barcode: true, customAttributes: true }, take: 100 },
        },
      });
      const fallback = products.map((product) => scoreProductMatch(analysis, { ...product, category: product.category.name, variants: product.variants }))
        .filter((candidate) => candidate.fuzzyScore >= MATCH_CONFIG.minimumCandidateScore);
      combined = [...new Map([...primary, ...fallback].map((candidate) => [candidate.id, candidate])).values()]
        .sort((a, b) => b.fuzzyScore - a.fuzzyScore)
        .slice(0, MATCH_CONFIG.responseLimit);
    }
  }

  onStats?.({ ...primaryStats, fallbackScanned, fallbackShortlisted,
    fuzzyRanking: combined.map((candidate) => ({ productId: candidate.id, score: candidate.fuzzyScore })) });
  return combined;
}
