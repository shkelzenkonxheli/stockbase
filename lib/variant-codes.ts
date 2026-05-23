type BuildVariantSkuInput = {
  productName: string;
  size?: string | null;
  color: string;
};

function normalizeWords(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

function toCompactProductCode(value: string) {
  const words = normalizeWords(value);

  if (words.length === 0) {
    return "ITEM";
  }

  if (words.length === 1) {
    const [word] = words;
    const letters = word.replace(/\d+/g, "");
    const digits = word.replace(/\D+/g, "");
    return `${letters.slice(0, 4)}${digits}`.toUpperCase() || "ITEM";
  }

  const combined = words
    .slice(0, 3)
    .map((word) => {
      const letters = word.replace(/\d+/g, "");
      const digits = word.replace(/\D+/g, "");

      if (!letters && digits) {
        return digits.slice(0, 2);
      }

      return `${letters.slice(0, 2)}${digits.slice(0, 2)}`;
    })
    .join("");

  return combined.toUpperCase().slice(0, 8) || "ITEM";
}

function toCompactColorCode(value: string) {
  const words = normalizeWords(value);

  if (words.length === 0) {
    return "CLR";
  }

  const combined =
    words.length === 1
      ? words[0].slice(0, 3)
      : words
          .slice(0, 2)
          .map((word) => word.slice(0, 2))
          .join("");

  return combined.toUpperCase() || "CLR";
}

export function buildVariantSku({
  productName,
  size,
  color,
}: BuildVariantSkuInput) {
  const parts = [toCompactProductCode(productName), toCompactColorCode(color)];
  const normalizedSize = size?.trim().toUpperCase();

  if (normalizedSize) {
    parts.push(normalizedSize);
  }

  return parts.join("-");
}

export function normalizeVariantCode(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function ensureUniqueSku(baseSku: string, usedSkus: Set<string>) {
  let candidate = baseSku;
  let counter = 2;

  while (usedSkus.has(candidate)) {
    candidate = `${baseSku}-${counter}`;
    counter += 1;
  }

  usedSkus.add(candidate);
  return candidate;
}

export function buildBarcodeFromVariantId(variantId: number) {
  const base = `290${String(variantId).padStart(9, "0")}`;
  const digits = base.split("").map(Number);
  const weightedSum = digits.reduce((sum, digit, index) => {
    return sum + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);
  const checkDigit = (10 - (weightedSum % 10)) % 10;

  return `${base}${checkDigit}`;
}
