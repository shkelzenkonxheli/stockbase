export function groupTransferModels(variants: { color: string; product: { name: string } }[]) {
  const colorsByModel = new Map<string, Set<string>>();

  for (const variant of variants) {
    const colors = colorsByModel.get(variant.product.name) ?? new Set<string>();
    colors.add(variant.color);
    colorsByModel.set(variant.product.name, colors);
  }

  return [...colorsByModel].map(([name, colors]) => ({
    name,
    colors: [...colors].sort((a, b) => a.localeCompare(b, "sq", { sensitivity: "base" })),
  })).sort((a, b) => a.name.localeCompare(b.name, "sq", { sensitivity: "base" }));
}
