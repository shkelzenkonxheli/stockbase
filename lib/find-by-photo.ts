import { prisma } from "@/lib/prisma";
import type { ProductAnalysis } from "@/lib/product-match-core";
import { isSingleStrongPhotoMatch, summarizePhotoStock, type PhotoColorGroup, type RankedPhotoCandidate } from "@/lib/photo-match-policy";

export type PhotoResult = {
  productId: number;
  name: string;
  brand: string | null;
  category: string;
  confidence: "strong" | "possible";
  imagePath: string | null;
  matchedColor: string | null;
  colors: PhotoColorGroup[];
  warehouses: Array<{ name: string; stock: number }>;
  unassignedStock: number;
};

export async function findPhotoResultDetails(tenantId: number, candidates: RankedPhotoCandidate[], analysis: ProductAnalysis): Promise<PhotoResult[]> {
  const eligible = candidates.filter((candidate) => candidate.confidence !== "LOW").slice(0, 5);
  if (!eligible.length) return [];
  const products = await prisma.product.findMany({
    where: { tenantId, id: { in: eligible.map((candidate) => candidate.id) } },
    select: {
      id: true, name: true, brand: true, category: { select: { name: true } },
      variants: {
        where: { tenantId },
        select: {
          color: true, size: true, stock: true, imagePath: true,
          inventories: { where: { warehouse: { tenantId } }, select: { stock: true, warehouse: { select: { name: true } } } },
        },
      },
    },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const singleStrongId = isSingleStrongPhotoMatch(eligible) ? eligible[0].id : null;
  return eligible.flatMap((candidate) => {
    const product = byId.get(candidate.id);
    if (!product) return [];
    const summary = summarizePhotoStock(product.variants, candidate.color ?? analysis.color);
    return [{
      productId: product.id, name: product.name, brand: product.brand, category: product.category.name,
      confidence: product.variants.length && candidate.id === singleStrongId ? "strong" as const : "possible" as const,
      ...summary,
    }];
  });
}
