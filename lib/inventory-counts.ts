export type InventoryCountFilterValue = "all" | "counted" | "uncounted" | "changed";

export type InventoryCountLineView = {
  id: number;
  expectedStock: number;
  countedStock: number | null;
  difference: number | null;
  locationCode: string | null;
  note: string | null;
  variant: {
    id: number;
    size: string;
    color: string;
    sku: string | null;
    imagePath: string | null;
    product: {
      name: string;
      brand: string | null;
      category: {
        name: string;
      };
    };
  };
};

export function normalizeInventoryCountFilter(value?: string | null): InventoryCountFilterValue {
  if (value === "counted" || value === "uncounted" || value === "changed") {
    return value;
  }
  return "all";
}

export function filterInventoryCountLines(
  lines: InventoryCountLineView[],
  query?: string | null,
  filter: InventoryCountFilterValue = "all",
  category?: string | null,
  model?: string | null,
) {
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const normalizedCategory = category?.trim().toLowerCase() ?? "";
  const normalizedModel = model?.trim().toLowerCase() ?? "";

  return lines.filter((line) => {
    if (
      normalizedCategory &&
      line.variant.product.category.name.trim().toLowerCase() !== normalizedCategory
    ) {
      return false;
    }

    if (normalizedModel && line.variant.product.name.trim().toLowerCase() !== normalizedModel) {
      return false;
    }

    if (filter === "counted" && line.countedStock === null) {
      return false;
    }

    if (filter === "uncounted" && line.countedStock !== null) {
      return false;
    }

    if (filter === "changed" && (line.difference ?? 0) === 0) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchable = [
      line.variant.product.brand,
      line.variant.product.name,
      line.variant.product.category.name,
      line.variant.color,
      line.variant.size,
      line.variant.sku,
      line.locationCode,
      line.note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(normalizedQuery);
  });
}

export function formatInventoryDifference(difference: number | null) {
  if (difference === null) {
    return "-";
  }

  if (difference > 0) {
    return `+${difference}`;
  }

  return `${difference}`;
}
