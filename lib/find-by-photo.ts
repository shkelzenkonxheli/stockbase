import { prisma } from "@/lib/prisma";
import type { ProductAnalysis } from "@/lib/product-match-core";
import { isPlausiblePhotoCandidate, isSingleStrongPhotoMatch, photoWarehouseProductFilter, summarizePhotoStock, type PhotoColorGroup, type RankedPhotoCandidate } from "@/lib/photo-match-policy";

export type PhotoResult = {
  productId: number;
  name: string;
  brand: string | null;
  category: string;
  confidence: "strong" | "possible";
  photoCompared: boolean;
  imagePath: string | null;
  matchedColor: string | null;
  colors: PhotoColorGroup[];
  warehouses: Array<{ name: string; stock: number }>;
  unassignedStock: number;
};

export async function findPhotoResultDetails(tenantId: number, candidates: RankedPhotoCandidate[], analysis: ProductAnalysis, warehouseId: number | null = null): Promise<PhotoResult[]> {
  const eligible = candidates.filter(isPlausiblePhotoCandidate).slice(0, 5);
  if (!eligible.length) return [];
  const products = await prisma.product.findMany({
    where: { tenantId, ...photoWarehouseProductFilter(tenantId, warehouseId), id: { in: eligible.map((candidate) => candidate.id) } },
    select: {
      id: true, name: true, brand: true, category: { select: { name: true } },
      variants: {
        where: { tenantId, ...(warehouseId === null ? {} : { inventories: { some: { warehouseId, stock: { gt: 0 }, warehouse: { tenantId } } } }) },
        select: {
          color: true, size: true, stock: true, imagePath: true,
          inventories: { where: { warehouse: { tenantId }, ...(warehouseId === null ? {} : { warehouseId }) }, select: { stock: true, warehouse: { select: { name: true } } } },
        },
      },
    },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const singleStrongId = isSingleStrongPhotoMatch(eligible) ? eligible[0].id : null;
  return eligible.flatMap((candidate) => {
    const product = byId.get(candidate.id);
    if (!product) return [];
    const summary = summarizePhotoStock(product.variants, candidate.color ?? analysis.color, warehouseId !== null);
    return [{
      productId: product.id, name: product.name, brand: product.brand, category: product.category.name,
      confidence: product.variants.length && candidate.id === singleStrongId ? "strong" as const : "possible" as const,
      photoCompared: candidate.visualMatch !== "NOT_CHECKED",
      ...summary,
    }];
  });
}
