export const LOW_STOCK_THRESHOLD = 5;

export function getStockTone(stock: number) {
  if (stock <= 0) {
    return {
      label: "Pa stok",
      badgeClassName: "bg-rose-50 text-rose-700",
    };
  }

  if (stock <= LOW_STOCK_THRESHOLD) {
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
