export const LOW_STOCK_THRESHOLD = 5;

export function getEffectiveReorderLevel(reorderLevel?: number | null) {
  return typeof reorderLevel === "number" && reorderLevel >= 0
    ? reorderLevel
    : LOW_STOCK_THRESHOLD;
}

export function isLowStock(stock: number, reorderLevel?: number | null) {
  if (stock <= 0) {
    return false;
  }

  return stock <= getEffectiveReorderLevel(reorderLevel);
}

export function getStockTone(stock: number, reorderLevel?: number | null) {
  if (stock <= 0) {
    return {
      label: "Pa stok",
      badgeClassName: "bg-rose-50 text-rose-700",
    };
  }

  if (isLowStock(stock, reorderLevel)) {
    return {
      label: "Stok i ulet",
      badgeClassName: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Ne stok",
    badgeClassName: "bg-emerald-50 text-emerald-700",
  };
}
