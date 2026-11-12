export function nextStockSizeRow(previous: { size: string; stock: string }) {
  const size = previous.size.trim();
  const numericSize = Number(size);

  return {
    size: size && Number.isFinite(numericSize) && numericSize >= 0 && numericSize < 9999
      ? String(numericSize + 1)
      : "",
    stock: previous.stock,
  };
}
