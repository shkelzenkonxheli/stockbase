import { normalizeProductText, type MatchLevel, type VisualMatch, type MatchSignals } from "@/lib/product-match-core";

export type RankedPhotoCandidate = {
  id: number;
  color: string | null;
  confidence: MatchLevel;
  finalScore: number;
  visualMatch: VisualMatch;
  signals: MatchSignals;
};

export type PhotoStockVariant = {
  color: string;
  size: string;
  stock: number;
  imagePath: string | null;
  inventories: Array<{ stock: number; warehouse: { name: string } }>;
};

export type PhotoColorGroup = {
  color: string;
  imagePath: string | null;
  totalStock: number;
  sizes: Array<{ size: string; stock: number }>;
  warehouses: Array<{ name: string; stock: number }>;
  unassignedStock: number;
};

export function isSingleStrongPhotoMatch(candidates: RankedPhotoCandidate[]) {
  const [first, second] = candidates;
  return Boolean(first &&
    (first.confidence === "HIGH" || first.confidence === "VERY_HIGH") &&
    first.signals.model >= 0.88 && first.signals.brand >= 0.8 &&
    first.visualMatch !== "UNLIKELY" &&
    (first.visualMatch === "STRONG" || first.confidence === "VERY_HIGH") &&
    (!second || first.finalScore - second.finalScore >= 10));
}

export function summarizePhotoStock(variants: PhotoStockVariant[], preferredColor: string | null) {
  const colors = new Map<string, Omit<PhotoColorGroup, "sizes" | "warehouses"> & { sizeTotals: Map<string, number>; warehouseTotals: Map<string, number> }>();
  const warehouses = new Map<string, number>();
  let unassignedStock = 0;
  for (const variant of variants) {
    const stock = variant.inventories.length
      ? variant.inventories.reduce((sum, inventory) => sum + inventory.stock, 0)
      : variant.stock;
    if (!variant.inventories.length) unassignedStock += stock;
    for (const inventory of variant.inventories) {
      warehouses.set(inventory.warehouse.name, (warehouses.get(inventory.warehouse.name) ?? 0) + inventory.stock);
    }
    const key = normalizeProductText(variant.color);
    let group = colors.get(key);
    if (!group) {
      group = { color: variant.color, imagePath: variant.imagePath, totalStock: 0, unassignedStock: 0, sizeTotals: new Map(), warehouseTotals: new Map() };
      colors.set(key, group);
    }
    group.imagePath ||= variant.imagePath;
    group.totalStock += stock;
    group.sizeTotals.set(variant.size, (group.sizeTotals.get(variant.size) ?? 0) + stock);
    if (!variant.inventories.length) group.unassignedStock += stock;
    for (const inventory of variant.inventories) {
      group.warehouseTotals.set(inventory.warehouse.name, (group.warehouseTotals.get(inventory.warehouse.name) ?? 0) + inventory.stock);
    }
  }
  const colorGroups = [...colors.values()].map(({ sizeTotals, warehouseTotals, ...group }) => ({
    ...group,
    sizes: [...sizeTotals].map(([size, stock]) => ({ size, stock })).sort((left, right) => left.size.localeCompare(right.size, undefined, { numeric: true })),
    warehouses: [...warehouseTotals].map(([name, stock]) => ({ name, stock })).sort((a, b) => a.name.localeCompare(b.name)),
  }));
  const wantedColor = normalizeProductText(preferredColor);
  const matchedColor = colorGroups.find((group) => normalizeProductText(group.color) === wantedColor) ?? colorGroups[0];
  return {
    colors: colorGroups,
    matchedColor: matchedColor?.color ?? null,
    imagePath: matchedColor?.imagePath ?? colorGroups.find((group) => group.imagePath)?.imagePath ?? null,
    warehouses: [...warehouses].map(([name, stock]) => ({ name, stock })).sort((a, b) => a.name.localeCompare(b.name)),
    unassignedStock,
  };
}
