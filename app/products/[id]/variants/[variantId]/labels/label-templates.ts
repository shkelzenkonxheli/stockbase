export type LabelTemplateKey = "custom" | "a4-2x7" | "a4-3x8" | "a4-4x12";

export type LabelTemplate = {
  key: LabelTemplateKey;
  label: string;
  description: string;
  mode: "single" | "sheet";
  widthMm: number;
  heightMm: number;
  pageWidthMm: number;
  pageHeightMm: number;
  columns?: number;
  rows?: number;
  gapXmm?: number;
  gapYmm?: number;
  paddingXmm?: number;
  paddingYmm?: number;
};

export const LABEL_TEMPLATES: Record<LabelTemplateKey, LabelTemplate> = {
  custom: {
    key: "custom",
    label: "Custom label",
    description: "Nje etikete per faqe me madhesi te lire.",
    mode: "single",
    widthMm: 50,
    heightMm: 30,
    pageWidthMm: 50,
    pageHeightMm: 30,
  },
  "a4-2x7": {
    key: "a4-2x7",
    label: "A4 2 x 7",
    description: "14 etiketa per faqe A4, per etiketa te medha.",
    mode: "sheet",
    widthMm: 99.1,
    heightMm: 38.1,
    pageWidthMm: 210,
    pageHeightMm: 297,
    columns: 2,
    rows: 7,
    gapXmm: 2.5,
    gapYmm: 2.5,
    paddingXmm: 4.65,
    paddingYmm: 10.9,
  },
  "a4-3x8": {
    key: "a4-3x8",
    label: "A4 3 x 8",
    description: "24 etiketa per faqe A4, balancuar per shumicen e produkteve.",
    mode: "sheet",
    widthMm: 63.5,
    heightMm: 33.9,
    pageWidthMm: 210,
    pageHeightMm: 297,
    columns: 3,
    rows: 8,
    gapXmm: 2.5,
    gapYmm: 1.8,
    paddingXmm: 7.25,
    paddingYmm: 9.6,
  },
  "a4-4x12": {
    key: "a4-4x12",
    label: "A4 4 x 12",
    description: "48 etiketa per faqe A4, per etiketa te vogla.",
    mode: "sheet",
    widthMm: 45.0,
    heightMm: 21.2,
    pageWidthMm: 210,
    pageHeightMm: 297,
    columns: 4,
    rows: 12,
    gapXmm: 2.0,
    gapYmm: 2.0,
    paddingXmm: 10.0,
    paddingYmm: 8.3,
  },
};

export const LABEL_TEMPLATE_OPTIONS = Object.values(LABEL_TEMPLATES);
