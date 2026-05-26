export const CATALOG_TYPES = [
  "FOOTWEAR",
  "ELECTRONICS",
  "HOME_GOODS",
  "DECOR",
] as const;

export type CatalogType = (typeof CATALOG_TYPES)[number];
export const CUSTOM_FIELD_INPUT_TYPES = ["text", "number"] as const;
export type CustomFieldInputType = (typeof CUSTOM_FIELD_INPUT_TYPES)[number];

export type CustomVariantField = {
  id: string;
  label: string;
  type: CustomFieldInputType;
  enabled: boolean;
};

export const PRODUCT_CATEGORIES = [
  "Patika",
  "Kepuce",
  "Sandale",
  "Lini shtepie",
  "Pajisje elektrike",
  "Dekor",
] as const;

export type ProductCategoryName = (typeof PRODUCT_CATEGORIES)[number];

export type CategoryConfig = {
  description: string;
  productNameLabel: string;
  productNamePlaceholder: string;
  showProductBrandField: boolean;
  sizeLabel: string;
  sizePlaceholder: string;
  sizeInputType: "text" | "number" | "select";
  sizeOptions: string[];
  colorLabel: string;
  colorPlaceholder: string;
  colorInputType: "text" | "number" | "select";
  colorOptions: string[];
  materialLabel: string;
  materialPlaceholder: string;
  materialInputType: "text" | "number" | "select";
  materialOptions: string[];
  powerLabel: string;
  powerPlaceholder: string;
  powerInputType: "text" | "number" | "select";
  powerOptions: string[];
  showMaterialField: boolean;
  showPowerField: boolean;
  sharedVariantImageByColor: boolean;
  variantHelper: string;
  customVariantFields: CustomVariantField[];
};

type CatalogTemplate = {
  label: string;
  description: string;
  recommendedCategories: ProductCategoryName[];
  allowedCategories: ProductCategoryName[];
  variantFocus: string;
  productNamePlaceholder: string;
};

export type CategoryFieldOverride = Partial<
  Pick<
    CategoryConfig,
    | "sizeLabel"
    | "sizePlaceholder"
    | "productNameLabel"
    | "productNamePlaceholder"
    | "sizeInputType"
    | "sizeOptions"
    | "colorLabel"
    | "colorPlaceholder"
    | "colorInputType"
    | "colorOptions"
    | "materialLabel"
    | "materialPlaceholder"
    | "materialInputType"
    | "materialOptions"
    | "powerLabel"
    | "powerPlaceholder"
    | "powerInputType"
    | "powerOptions"
    | "showMaterialField"
    | "showPowerField"
    | "showProductBrandField"
    | "sharedVariantImageByColor"
    | "variantHelper"
    | "customVariantFields"
  >
>;

export type TenantCatalogConfig = {
  categoryOverrides?: Partial<Record<ProductCategoryName, CategoryFieldOverride>>;
  productListView?: ProductListViewConfig;
  orderListView?: OrderListViewConfig;
};

export const PRODUCT_LIST_FIELD_KEYS = [
  "brand",
  "category",
  "stock",
  "price",
  "sizes",
  "colors",
  "materials",
  "power",
] as const;

export type ProductListFieldKey = (typeof PRODUCT_LIST_FIELD_KEYS)[number];

export const ORDER_LIST_FIELD_KEYS = [
  "productImage",
  "variantSummary",
  "location",
  "customerName",
  "phone",
  "quantity",
  "source",
  "status",
  "date",
] as const;

export type OrderListFieldKey = (typeof ORDER_LIST_FIELD_KEYS)[number];

export type ProductListViewConfig = {
  layout: "grid" | "list";
  density: "compact" | "comfortable";
  order: ProductListFieldKey[];
  visibility: Record<ProductListFieldKey, boolean>;
};

export type OrderListViewConfig = {
  layout: "grid" | "list";
  density: "compact" | "comfortable";
  order: OrderListFieldKey[];
  visibility: Record<OrderListFieldKey, boolean>;
};

const DEFAULT_PRODUCT_LIST_VIEW: ProductListViewConfig = {
  layout: "grid",
  density: "comfortable",
  order: [...PRODUCT_LIST_FIELD_KEYS],
  visibility: {
    brand: true,
    category: true,
    stock: true,
    price: true,
    sizes: true,
    colors: true,
    materials: true,
    power: true,
  },
};

const DEFAULT_ORDER_LIST_VIEW: OrderListViewConfig = {
  layout: "grid",
  density: "comfortable",
  order: [...ORDER_LIST_FIELD_KEYS],
  visibility: {
    productImage: true,
    variantSummary: true,
    location: false,
    customerName: true,
    phone: true,
    quantity: true,
    source: true,
    status: true,
    date: true,
  },
};

const DEFAULT_CONFIG: CategoryConfig = {
  description:
    "Perdor produkte te organizuara sipas kategorise dhe variante sipas atributeve reale te artikullit.",
  productNameLabel: "Emri i produktit",
  productNamePlaceholder: "p.sh. Produkt Premium",
  showProductBrandField: false,
  sizeLabel: "Madhesia / Dimensioni",
  sizePlaceholder: "p.sh. 50x70 cm",
  sizeInputType: "text",
  sizeOptions: [],
  colorLabel: "Ngjyra",
  colorPlaceholder: "p.sh. E bardhe",
  colorInputType: "text",
  colorOptions: [],
  materialLabel: "Materiali",
  materialPlaceholder: "p.sh. Pambuk",
  materialInputType: "text",
  materialOptions: [],
  powerLabel: "Fuqia (W)",
  powerPlaceholder: "p.sh. 800W",
  powerInputType: "text",
  powerOptions: [],
  showMaterialField: true,
  showPowerField: true,
  sharedVariantImageByColor: false,
  variantHelper: "Ploteso atributet reale te variantit dhe ruaj stokun e cmimin.",
  customVariantFields: [],
};

const CATEGORY_CONFIG: Record<ProductCategoryName, CategoryConfig> = {
  Patika: {
    description:
      "Per patika dhe sneaker-a. Varianti ruan numrin, ngjyren, stokun dhe cmimin.",
    productNameLabel: "Modeli",
    productNamePlaceholder: "p.sh. Air Max 90",
    showProductBrandField: true,
    sizeLabel: "Numri",
    sizePlaceholder: "p.sh. 42",
    sizeInputType: "number",
    sizeOptions: [],
    colorLabel: "Ngjyra",
    colorPlaceholder: "p.sh. Black",
    colorInputType: "text",
    colorOptions: [],
    materialLabel: "Materiali (opsional)",
    materialPlaceholder: "p.sh. Mesh",
    materialInputType: "text",
    materialOptions: [],
    powerLabel: "Fuqia (nuk aplikohet)",
    powerPlaceholder: "Lere bosh",
    powerInputType: "text",
    powerOptions: [],
    showMaterialField: false,
    showPowerField: false,
    sharedVariantImageByColor: true,
    variantHelper: "Shto nje ngjyre me nje foto, pastaj shto numrat, stokun dhe cmimin per secilin numer.",
    customVariantFields: [],
  },
  Kepuce: {
    description:
      "Per kepuce klasike ose casual. Varianti ruan numrin, ngjyren, stokun dhe cmimin.",
    productNameLabel: "Modeli",
    productNamePlaceholder: "p.sh. Derby Leather",
    showProductBrandField: true,
    sizeLabel: "Numri",
    sizePlaceholder: "p.sh. 43",
    sizeInputType: "number",
    sizeOptions: [],
    colorLabel: "Ngjyra",
    colorPlaceholder: "p.sh. Brown",
    colorInputType: "text",
    colorOptions: [],
    materialLabel: "Materiali (opsional)",
    materialPlaceholder: "p.sh. Leather",
    materialInputType: "text",
    materialOptions: [],
    powerLabel: "Fuqia (nuk aplikohet)",
    powerPlaceholder: "Lere bosh",
    powerInputType: "text",
    powerOptions: [],
    showMaterialField: false,
    showPowerField: false,
    sharedVariantImageByColor: true,
    variantHelper: "Shto nje ngjyre me nje foto, pastaj shto numrat, stokun dhe cmimin per secilin numer.",
    customVariantFields: [],
  },
  Sandale: {
    description:
      "Per sandale dhe shapka. Varianti ruan numrin, ngjyren, stokun dhe cmimin.",
    productNameLabel: "Modeli",
    productNamePlaceholder: "p.sh. Summer Slide",
    showProductBrandField: true,
    sizeLabel: "Numri",
    sizePlaceholder: "p.sh. 41",
    sizeInputType: "number",
    sizeOptions: [],
    colorLabel: "Ngjyra",
    colorPlaceholder: "p.sh. Beige",
    colorInputType: "text",
    colorOptions: [],
    materialLabel: "Materiali (opsional)",
    materialPlaceholder: "p.sh. Synthetic",
    materialInputType: "text",
    materialOptions: [],
    powerLabel: "Fuqia (nuk aplikohet)",
    powerPlaceholder: "Lere bosh",
    powerInputType: "text",
    powerOptions: [],
    showMaterialField: false,
    showPowerField: false,
    sharedVariantImageByColor: true,
    variantHelper: "Shto nje ngjyre me nje foto, pastaj shto numrat, stokun dhe cmimin per secilin numer.",
    customVariantFields: [],
  },
  "Lini shtepie": {
    description:
      "Per peshqira, qarshafa, jasteke dhe jorgane. Varianti ruan kryesisht madhesine, ngjyren dhe materialin.",
    productNameLabel: "Emri i produktit",
    productNamePlaceholder: "p.sh. Peshqir Premium",
    showProductBrandField: false,
    sizeLabel: "Madhesia",
    sizePlaceholder: "p.sh. 50x70 cm",
    sizeInputType: "text",
    sizeOptions: [],
    colorLabel: "Ngjyra",
    colorPlaceholder: "p.sh. Bezhe",
    colorInputType: "text",
    colorOptions: [],
    materialLabel: "Materiali",
    materialPlaceholder: "p.sh. Pambuk 100%",
    materialInputType: "text",
    materialOptions: [],
    powerLabel: "Fuqia (opsionale)",
    powerPlaceholder: "Nuk aplikohet zakonisht",
    powerInputType: "text",
    powerOptions: [],
    showMaterialField: true,
    showPowerField: false,
    sharedVariantImageByColor: false,
    variantHelper: "Per cdo variant ruaj madhesine, ngjyren, materialin, stokun dhe cmimin.",
    customVariantFields: [],
  },
  "Pajisje elektrike": {
    description:
      "Per freskues, mikrovale dhe toster. Ruaj modelin, ngjyren dhe fuqine ne watt.",
    productNameLabel: "Modeli",
    productNamePlaceholder: "p.sh. Fshese Wet & Dry",
    showProductBrandField: true,
    sizeLabel: "Versioni (opsional)",
    sizePlaceholder: "p.sh. Pro, 3L ose leje bosh",
    sizeInputType: "text",
    sizeOptions: [],
    colorLabel: "Ngjyra",
    colorPlaceholder: "p.sh. Inox",
    colorInputType: "text",
    colorOptions: [],
    materialLabel: "Materiali (opsional)",
    materialPlaceholder: "p.sh. Stainless steel",
    materialInputType: "text",
    materialOptions: [],
    powerLabel: "Fuqia (W)",
    powerPlaceholder: "p.sh. 800W",
    powerInputType: "text",
    powerOptions: [],
    showMaterialField: false,
    showPowerField: true,
    sharedVariantImageByColor: false,
    variantHelper: "Per cdo variant ruaj ngjyren, fuqine/versionin, stokun dhe cmimin.",
    customVariantFields: [],
  },
  Dekor: {
    description:
      "Per piktura dhe artikuj dekorativ. Varianti ruan dimensionin, materialin dhe ngjyren kur ka dallime.",
    productNameLabel: "Emri i produktit",
    productNamePlaceholder: "p.sh. Pikture Murale",
    showProductBrandField: false,
    sizeLabel: "Dimensioni",
    sizePlaceholder: "p.sh. 70x100 cm",
    sizeInputType: "text",
    sizeOptions: [],
    colorLabel: "Ngjyra / Toni",
    colorPlaceholder: "p.sh. Gold frame",
    colorInputType: "text",
    colorOptions: [],
    materialLabel: "Materiali",
    materialPlaceholder: "p.sh. Panze",
    materialInputType: "text",
    materialOptions: [],
    powerLabel: "Fuqia (opsionale)",
    powerPlaceholder: "Zakonisht bosh",
    powerInputType: "text",
    powerOptions: [],
    showMaterialField: true,
    showPowerField: false,
    sharedVariantImageByColor: false,
    variantHelper: "Per cdo variant ruaj dimensionin, materialin, ngjyren dhe cmimin.",
    customVariantFields: [],
  },
};

const CATALOG_TEMPLATES: Record<CatalogType, CatalogTemplate> = {
  FOOTWEAR: {
    label: "Patika / Kepuce",
    description:
      "Ky template eshte per kataloge me ngjyra dhe numra. Forma e variantit fokusohet te numri, ngjyra, stoku dhe cmimi.",
    recommendedCategories: ["Patika", "Kepuce", "Sandale"],
    allowedCategories: ["Patika", "Kepuce", "Sandale"],
    variantFocus: "Ngjyra, numri, stoku dhe cmimi per secilin variant.",
    productNamePlaceholder: "p.sh. Nike Air Max 90",
  },
  ELECTRONICS: {
    label: "Pajisje elektrike",
    description:
      "Ky template punon me modele, ngjyra, fuqi dhe versione opsionale per secilin variant.",
    recommendedCategories: ["Pajisje elektrike"],
    allowedCategories: ["Pajisje elektrike"],
    variantFocus: "Ngjyra, fuqia, versioni opsional, stoku dhe cmimi.",
    productNamePlaceholder: "p.sh. Fshese Wet & Dry",
  },
  HOME_GOODS: {
    label: "Produkte shtepiake",
    description:
      "Ky template eshte per lini shtepie dhe artikuj te ngjashem ku materiali, madhesia dhe ngjyra jane dallimet kryesore.",
    recommendedCategories: ["Lini shtepie", "Dekor"],
    allowedCategories: ["Lini shtepie", "Dekor"],
    variantFocus: "Madhesia, materiali, ngjyra, stoku dhe cmimi.",
    productNamePlaceholder: "p.sh. Peshqir Premium",
  },
  DECOR: {
    label: "Dekor",
    description:
      "Ky template eshte per artikuj dekorativ ku dimensioni, materiali dhe toni jane atributet kryesore te variantit.",
    recommendedCategories: ["Dekor"],
    allowedCategories: ["Dekor"],
    variantFocus: "Dimensioni, materiali, ngjyra/toni, stoku dhe cmimi.",
    productNamePlaceholder: "p.sh. Pikture Murale",
  },
};

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeViewConfig<TFieldKey extends string>(input: {
  value: unknown;
  keys: readonly TFieldKey[];
  defaults: {
    order: TFieldKey[];
    visibility: Record<TFieldKey, boolean>;
  } & Record<string, unknown>;
}) {
  if (!isRecord(input.value)) {
    return input.defaults;
  }

  const nextOrder: TFieldKey[] = [];
  const seen = new Set<TFieldKey>();

  if (Array.isArray(input.value.order)) {
    for (const candidate of input.value.order) {
      if (
        typeof candidate === "string" &&
        input.keys.includes(candidate as TFieldKey) &&
        !seen.has(candidate as TFieldKey)
      ) {
        seen.add(candidate as TFieldKey);
        nextOrder.push(candidate as TFieldKey);
      }
    }
  }

  for (const key of input.keys) {
    if (!seen.has(key)) {
      nextOrder.push(key);
    }
  }

  const nextVisibility = { ...input.defaults.visibility };
  if (isRecord(input.value.visibility)) {
    for (const key of input.keys) {
      if (typeof input.value.visibility[key] === "boolean") {
        nextVisibility[key] = input.value.visibility[key] as boolean;
      }
    }
  }

  const nextConfig = {
    ...input.defaults,
    order: nextOrder,
    visibility: nextVisibility,
  };

  if ("layout" in input.defaults) {
    return {
      ...nextConfig,
      layout: input.value.layout === "list" ? "list" : "grid",
      density: input.value.density === "compact" ? "compact" : "comfortable",
    };
  }

  return nextConfig;
}

function sanitizeCustomVariantField(value: unknown): CustomVariantField | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const label = typeof value.label === "string" ? value.label.trim() : "";
  const type = value.type === "number" ? "number" : value.type === "text" ? "text" : null;
  const enabled = typeof value.enabled === "boolean" ? value.enabled : true;

  if (!id || !label || !type) {
    return null;
  }

  return { id, label, type, enabled };
}

export function sanitizeCustomVariantFields(value: unknown): CustomVariantField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const nextFields: CustomVariantField[] = [];
  const seenIds = new Set<string>();

  for (const item of value) {
    const parsed = sanitizeCustomVariantField(item);
    if (!parsed || seenIds.has(parsed.id)) {
      continue;
    }

    seenIds.add(parsed.id);
    nextFields.push(parsed);
  }

  return nextFields;
}

export function parseVariantCustomAttributes(value: unknown) {
  if (!isRecord(value)) {
    return {} as Record<string, string>;
  }

  const nextAttributes: Record<string, string> = {};

  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate === "string") {
      nextAttributes[key] = candidate;
    }
  }

  return nextAttributes;
}

export function sanitizeCategoryFieldOverride(value: unknown): CategoryFieldOverride | null {
  if (!isRecord(value)) {
    return null;
  }

  const nextOverride: CategoryFieldOverride = {};

  const stringFields = [
    "sizeLabel",
    "sizePlaceholder",
    "productNameLabel",
    "productNamePlaceholder",
    "colorLabel",
    "colorPlaceholder",
    "materialLabel",
    "materialPlaceholder",
    "powerLabel",
    "powerPlaceholder",
    "variantHelper",
  ] as const;
  const inputTypeFields = [
    "sizeInputType",
    "colorInputType",
    "materialInputType",
    "powerInputType",
  ] as const;
  const optionsFields = [
    "sizeOptions",
    "colorOptions",
    "materialOptions",
    "powerOptions",
  ] as const;

  for (const field of stringFields) {
    const candidate = value[field];
    if (typeof candidate === "string" && candidate.trim()) {
      nextOverride[field] = candidate.trim();
    }
  }

  if (typeof value.showMaterialField === "boolean") {
    nextOverride.showMaterialField = value.showMaterialField;
  }

  if (typeof value.showPowerField === "boolean") {
    nextOverride.showPowerField = value.showPowerField;
  }

  if (typeof value.showProductBrandField === "boolean") {
    nextOverride.showProductBrandField = value.showProductBrandField;
  }

  if (typeof value.sharedVariantImageByColor === "boolean") {
    nextOverride.sharedVariantImageByColor = value.sharedVariantImageByColor;
  }

  for (const field of inputTypeFields) {
    const candidate = value[field];
    if (candidate === "text" || candidate === "number" || candidate === "select") {
      nextOverride[field] = candidate;
    }
  }

  for (const field of optionsFields) {
    const candidate = value[field];
    if (Array.isArray(candidate)) {
      const parsedOptions = candidate
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
      nextOverride[field] = parsedOptions;
    }
  }

  const customVariantFields = sanitizeCustomVariantFields(value.customVariantFields);
  if (customVariantFields.length > 0) {
    nextOverride.customVariantFields = customVariantFields;
  }

  return Object.keys(nextOverride).length > 0 ? nextOverride : null;
}

export function parseTenantCatalogConfig(value: unknown): TenantCatalogConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const nextConfig: TenantCatalogConfig = {
    productListView: sanitizeViewConfig({
      value: value.productListView,
      keys: PRODUCT_LIST_FIELD_KEYS,
      defaults: DEFAULT_PRODUCT_LIST_VIEW,
    }) as ProductListViewConfig,
    orderListView: sanitizeViewConfig({
      value: value.orderListView,
      keys: ORDER_LIST_FIELD_KEYS,
      defaults: DEFAULT_ORDER_LIST_VIEW,
    }) as OrderListViewConfig,
  };

  if (isRecord(value.categoryOverrides)) {
    const categoryOverrides: Partial<Record<ProductCategoryName, CategoryFieldOverride>> = {};

    for (const categoryName of PRODUCT_CATEGORIES) {
      const override = sanitizeCategoryFieldOverride(value.categoryOverrides[categoryName]);
      if (override) {
        categoryOverrides[categoryName] = override;
      }
    }

    if (Object.keys(categoryOverrides).length > 0) {
      nextConfig.categoryOverrides = categoryOverrides;
    }
  }

  return nextConfig;
}

export function createCategoryFieldKey(categoryName: string) {
  return normalizeName(categoryName).replace(/[^a-z0-9]+/g, "_");
}

export function getCatalogCategoryOverride(
  tenantConfig: TenantCatalogConfig | null | undefined,
  categoryName?: string | null,
) {
  if (!tenantConfig?.categoryOverrides || !categoryName) {
    return null;
  }

  const normalizedCategoryName = normalizeName(categoryName);
  const matchedEntry = Object.entries(tenantConfig.categoryOverrides).find(
    ([name]) => normalizeName(name) === normalizedCategoryName,
  );

  return matchedEntry?.[1] ?? null;
}

export function parseCategoryFieldConfig(value: unknown) {
  return sanitizeCategoryFieldOverride(value);
}

export function getCategoryConfig(categoryName?: string | null): CategoryConfig {
  if (!categoryName) {
    return DEFAULT_CONFIG;
  }

  const normalizedCategoryName = normalizeName(categoryName);
  const matchedEntry = Object.entries(CATEGORY_CONFIG).find(
    ([name]) => normalizeName(name) === normalizedCategoryName,
  );

  return matchedEntry?.[1] ?? DEFAULT_CONFIG;
}

function hasKnownCategoryConfig(categoryName?: string | null) {
  if (!categoryName) {
    return false;
  }

  const normalizedCategoryName = normalizeName(categoryName);
  return Object.keys(CATEGORY_CONFIG).some(
    (name) => normalizeName(name) === normalizedCategoryName,
  );
}

export function getCatalogTemplate(catalogType?: CatalogType | null): CatalogTemplate {
  if (!catalogType) {
    return CATALOG_TEMPLATES.ELECTRONICS;
  }

  return CATALOG_TEMPLATES[catalogType] ?? CATALOG_TEMPLATES.ELECTRONICS;
}

export function getCatalogAllowedCategories(catalogType?: CatalogType | null) {
  return getCatalogTemplate(catalogType).allowedCategories;
}

export function getCatalogDefaultCategoryName(catalogType?: CatalogType | null) {
  return getCatalogAllowedCategories(catalogType)[0] ?? PRODUCT_CATEGORIES[0];
}

export function getCatalogAwareCategoryConfig(
  catalogType?: CatalogType | null,
  categoryName?: string | null,
  tenantConfig?: TenantCatalogConfig | null,
  categoryOverride?: CategoryFieldOverride | null,
): CategoryConfig {
  const baseConfig = getCategoryConfig(categoryName);
  const shouldUseTemplateDefaults = !hasKnownCategoryConfig(categoryName);

  let resolvedConfig = baseConfig;

  if (shouldUseTemplateDefaults && catalogType === "FOOTWEAR") {
    resolvedConfig = {
      ...baseConfig,
      description:
        "Per patika dhe kepuce. Varianti ruan kryesisht numrin, ngjyren, stokun dhe cmimin.",
      productNameLabel: "Modeli",
      productNamePlaceholder: "p.sh. Air Max 90",
      showProductBrandField: true,
      sizeLabel: "Numri",
      sizePlaceholder: "p.sh. 42",
      colorLabel: "Ngjyra",
      colorPlaceholder: "p.sh. Black",
      materialLabel: "Materiali (opsional)",
      materialPlaceholder: "p.sh. Leather",
      powerLabel: "Fuqia (nuk aplikohet)",
      powerPlaceholder: "Lere bosh",
      showMaterialField: false,
      showPowerField: false,
      sharedVariantImageByColor: true,
      variantHelper: "Shto nje ngjyre me nje foto, pastaj shto numrat, stokun dhe cmimin per secilin numer.",
    };
  } else if (shouldUseTemplateDefaults && catalogType === "DECOR") {
    resolvedConfig = {
      ...baseConfig,
      sizeLabel: "Dimensioni",
      sizePlaceholder: "p.sh. 70x100 cm",
      colorLabel: "Ngjyra / Toni",
      colorPlaceholder: "p.sh. Gold frame",
      showPowerField: false,
      variantHelper: "Per cdo variant ruaj dimensionin, materialin, ngjyren dhe cmimin.",
    };
  } else if (shouldUseTemplateDefaults && catalogType === "HOME_GOODS") {
    resolvedConfig = {
      ...baseConfig,
      showPowerField: false,
      variantHelper: "Per cdo variant ruaj madhesine, materialin, ngjyren, stokun dhe cmimin.",
    };
  }

  const tenantOverride = getCatalogCategoryOverride(tenantConfig, categoryName);

  if (!tenantOverride && !categoryOverride) {
    return resolvedConfig;
  }

  return {
    ...resolvedConfig,
    ...tenantOverride,
    ...categoryOverride,
  };
}

export function getCategoryDescription(categoryName?: string | null) {
  return getCategoryConfig(categoryName).description;
}

export function getProductListViewConfig(tenantConfig?: TenantCatalogConfig | null) {
  return tenantConfig?.productListView ?? DEFAULT_PRODUCT_LIST_VIEW;
}

export function getOrderListViewConfig(tenantConfig?: TenantCatalogConfig | null) {
  return tenantConfig?.orderListView ?? DEFAULT_ORDER_LIST_VIEW;
}
