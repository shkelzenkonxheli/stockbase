export type OrderVariantDisplayInput = {
  size: string;
  color: string;
  category: string;
  material?: string | null;
  powerWatts?: string | null;
};

function normalizeCategoryName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getOrderVariantMode(category: string) {
  const normalized = normalizeCategoryName(category);

  if (["patika", "kepuce", "sandale"].includes(normalized)) {
    return "footwear";
  }

  if (normalized === "pajisje elektrike") {
    return "electronics";
  }

  return "home";
}

export function getOrderVariantSummary({
  size,
  color,
  category,
  material,
  powerWatts,
}: OrderVariantDisplayInput) {
  const mode = getOrderVariantMode(category);

  if (mode === "footwear") {
    return `${color} / Nr ${size}`;
  }

  if (mode === "electronics") {
    const suffix = powerWatts ? ` / ${powerWatts}` : "";
    return `${color} / ${size}${suffix}`;
  }

  const suffix = material ? ` / ${material}` : "";
  return `${color} / ${size}${suffix}`;
}
