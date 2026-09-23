import { prisma } from "@/lib/prisma";
import { MATCH_CONFIG, buildCandidateSearch, normalizeModel, normalizeProductText, scoreProductMatch, type ProductAnalysis } from "@/lib/product-match-core";

export type CandidateSearchStats = { initialCandidateCount: number; fuzzyRanking: Array<{ productId: number; score: number }> };

export async function findDuplicateCandidates(tenantId: number, analysis: ProductAnalysis, identifier?: string | null, onStats?: (stats: CandidateSearchStats) => void) {
  const { needles } = buildCandidateSearch(tenantId, analysis);
  const normalizedModel = normalizeModel(analysis.model, analysis.brand);
  if (needles.length === 0 && !identifier) {
    onStats?.({ initialCandidateCount: 0, fuzzyRanking: [] });
    return [];
  }

  const [textProductGroups, identifierVariants] = await Promise.all([
    Promise.all(needles.map((needle) => prisma.product.findMany({
      where: { tenantId, OR: [{ name: { contains: needle, mode: "insensitive" } }, { brand: { contains: needle, mode: "insensitive" } }] },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }))),
    identifier ? prisma.variant.findMany({ where: { tenantId, OR: [{ sku: { equals: identifier, mode: "insensitive" } }, { barcode: { equals: identifier, mode: "insensitive" } }] }, select: { productId: true }, take: 5 }) : Promise.resolve([]),
  ]);
  const ids = [...new Set([...identifierVariants.map((variant) => variant.productId), ...textProductGroups.flat().map((product) => product.id)])].slice(0, MATCH_CONFIG.candidateLimit);
  if (ids.length === 0) {
    onStats?.({ initialCandidateCount: 0, fuzzyRanking: [] });
    return [];
  }
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: ids } },
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
