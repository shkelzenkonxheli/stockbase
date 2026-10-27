export type StockTransferAdjustment = {
  variantId: number;
  quantity: number;
};

export function parseStockTransferAdjustments(raw: string | null): StockTransferAdjustment[] | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 100) return null;

  const seen = new Set<number>();
  const adjustments: StockTransferAdjustment[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") return null;
    const { variantId, quantity } = item as Record<string, unknown>;
    if (
      typeof variantId !== "number" || !Number.isSafeInteger(variantId) || variantId <= 0 ||
      typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0 ||
      seen.has(variantId)
    ) return null;

    seen.add(variantId);
    adjustments.push({ variantId, quantity });
  }

  return adjustments;
}
