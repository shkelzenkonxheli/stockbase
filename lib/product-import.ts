export const IMPORT_FIELD_KEYS = [
  "productName",
  "brand",
  "category",
  "warehouse",
  "size",
  "color",
  "stock",
  "price",
  "sku",
  "barcode",
  "material",
  "powerWatts",
  "locationCode",
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELD_KEYS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportFieldKey, string> = {
  productName: "Emri i produktit",
  brand: "Brandi",
  category: "Kategoria",
  warehouse: "Depoja",
  size: "Madhesia / Numri",
  color: "Ngjyra",
  stock: "Stoku",
  price: "Cmimi",
  sku: "SKU",
  barcode: "Barcode",
  material: "Materiali",
  powerWatts: "Fuqia",
  locationCode: "Lokacioni",
};

export const REQUIRED_IMPORT_FIELDS: ImportFieldKey[] = [
  "productName",
  "category",
  "stock",
  "price",
];

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HEADER_MATCHERS: Array<[ImportFieldKey, string[]]> = [
  ["productName", ["emri", "produkti", "product", "product name", "modeli", "model"]],
  ["brand", ["brand", "brandi", "marka"]],
  ["category", ["category", "kategoria", "kategori"]],
  ["warehouse", ["warehouse", "depo", "depoja", "depot"]],
  ["size", ["size", "madhesia", "dimensioni", "dimension", "numri", "number"]],
  ["color", ["color", "ngjyra", "ngjyre"]],
  ["stock", ["stock", "stoku", "sasia", "qty", "quantity"]],
  ["price", ["price", "cmimi", "price eur", "unit price"]],
  ["sku", ["sku", "kodi", "code"]],
  ["barcode", ["barcode", "bar code"]],
  ["material", ["material", "materiali"]],
  ["powerWatts", ["power", "fuqia", "watts", "watt", "w"]],
  ["locationCode", ["location", "lokacioni", "lokacion", "raft", "shelf"]],
];

export function suggestImportField(header: string): ImportFieldKey | "" {
  const normalized = normalizeHeader(header);

  for (const [field, keywords] of HEADER_MATCHERS) {
    if (keywords.some((keyword) => normalized === keyword || normalized.includes(keyword))) {
      return field;
    }
  }

  return "";
}

export function parseLocalizedNumber(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(/,/g, ".");
  if (!normalized) {
    return Number.NaN;
  }

  return Number(normalized);
}

export function normalizeImportText(value: unknown) {
  return String(value ?? "").trim();
}