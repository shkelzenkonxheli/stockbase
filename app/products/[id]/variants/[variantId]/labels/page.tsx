import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { UploadedImage } from "@/app/components/uploaded-image";
import { requireRole } from "@/lib/auth";
import { Code39Barcode, isCode39ValueSupported } from "@/lib/code39-barcode";
import { parseTenantCatalogConfig, type TenantCatalogConfig } from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import {
  LABEL_TEMPLATES,
  type LabelTemplate,
  type LabelTemplateKey,
} from "./label-templates";
import { LabelControls } from "./label-controls";

type VariantLabelsPageProps = {
  params: Promise<{
    id: string;
    variantId: string;
  }>;
  searchParams?: Promise<{
    qty?: string;
    w?: string;
    h?: string;
    name?: string;
    variant?: string;
    count?: string;
    img?: string;
    sku?: string;
    cat?: string;
    template?: string;
    preset?: string;
    success?: string;
    error?: string;
  }>;
};

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function isTemplateKey(value: string | undefined): value is LabelTemplateKey {
  return Boolean(value && value in LABEL_TEMPLATES);
}

function toQueryBool(value: boolean) {
  return value ? "1" : "0";
}

function SectionSparkIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
      <path d="M10 2.4 11.9 7l4.7 1-3.5 3.1.6 4.8-4.1-2.3-4.1 2.3.6-4.8L3.5 8l4.7-1L10 2.4Z" />
    </svg>
  );
}

function PresetIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.7]">
      <path d="M4.5 5.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
      <path d="M7 5.5V4.3c0-.4.3-.8.8-.8h4.4c.5 0 .8.4.8.8v1.2" />
      <path d="M7.2 10h5.6" strokeLinecap="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function buildPresetHref(input: {
  productId: number;
  variantId: number;
  quantity: number;
  preset: {
    id: string;
    template: string;
    widthMm: number;
    heightMm: number;
    showName: boolean;
    showVariant: boolean;
    showLabelCount: boolean;
    showImage: boolean;
    showSku: boolean;
    showCategory: boolean;
  };
}) {
  const params = new URLSearchParams({
    qty: String(input.quantity),
    template: input.preset.template,
    w: String(input.preset.widthMm),
    h: String(input.preset.heightMm),
    name: toQueryBool(input.preset.showName),
    variant: toQueryBool(input.preset.showVariant),
    count: toQueryBool(input.preset.showLabelCount),
    img: toQueryBool(input.preset.showImage),
    sku: toQueryBool(input.preset.showSku),
    cat: toQueryBool(input.preset.showCategory),
    preset: input.preset.id,
  });

  return `/products/${input.productId}/variants/${input.variantId}/labels?${params.toString()}`;
}

async function saveLabelPreset(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const productId = Number(formData.get("productId"));
  const variantId = Number(formData.get("variantId"));
  const presetName = formData.get("presetName")?.toString().trim();
  const template = formData.get("template")?.toString().trim() ?? "custom";
  const widthMm = Number(formData.get("widthMm"));
  const heightMm = Number(formData.get("heightMm"));

  if (!tenantId || Number.isNaN(productId) || Number.isNaN(variantId) || !presetName) {
    redirect(`/products/${productId}/variants/${variantId}/labels?error=preset-save`);
  }

  const existingSettings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: {
      catalogConfig: true,
      businessName: true,
      language: true,
      currency: true,
      primaryColor: true,
    },
  });

  const tenantConfig = parseTenantCatalogConfig(existingSettings?.catalogConfig);
  const currentPresets = tenantConfig?.labelPresets ?? [];
  const normalizedName = presetName.toLowerCase();
  const nextPreset = {
    id: randomUUID(),
    name: presetName,
    template,
    widthMm,
    heightMm,
    showName: formData.get("showName")?.toString() === "1",
    showVariant: formData.get("showVariant")?.toString() === "1",
    showLabelCount: formData.get("showLabelCount")?.toString() === "1",
    showImage: formData.get("showImage")?.toString() === "1",
    showSku: formData.get("showSku")?.toString() === "1",
    showCategory: formData.get("showCategory")?.toString() === "1",
  };

  const nextCatalogConfig: TenantCatalogConfig = {
    ...(tenantConfig ?? {}),
    labelPresets: [
      ...currentPresets.filter((item) => item.name.toLowerCase() !== normalizedName),
      nextPreset,
    ].slice(-12),
  };

  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      businessName: existingSettings?.businessName ?? currentUser.tenant?.name ?? "Business",
      language: existingSettings?.language ?? "sq",
      currency: existingSettings?.currency ?? "EUR",
      primaryColor: existingSettings?.primaryColor ?? null,
      catalogConfig: nextCatalogConfig,
    },
    update: {
      catalogConfig: nextCatalogConfig,
    },
  });

  redirect(`/products/${productId}/variants/${variantId}/labels?success=preset-saved`);
}

async function deleteLabelPreset(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const productId = Number(formData.get("productId"));
  const variantId = Number(formData.get("variantId"));
  const presetId = formData.get("presetId")?.toString().trim();

  if (!tenantId || Number.isNaN(productId) || Number.isNaN(variantId) || !presetId) {
    redirect(`/products/${productId}/variants/${variantId}/labels?error=preset-delete`);
  }

  const existingSettings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { catalogConfig: true },
  });

  const tenantConfig = parseTenantCatalogConfig(existingSettings?.catalogConfig);
  const nextCatalogConfig: TenantCatalogConfig = {
    ...(tenantConfig ?? {}),
    labelPresets: (tenantConfig?.labelPresets ?? []).filter((item) => item.id !== presetId),
  };

  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      businessName: currentUser.tenant?.name ?? "Business",
      language: "sq",
      currency: "EUR",
      primaryColor: null,
      catalogConfig: nextCatalogConfig,
    },
    update: {
      catalogConfig: nextCatalogConfig,
    },
  });

  redirect(`/products/${productId}/variants/${variantId}/labels?success=preset-deleted`);
}

function resolveTemplate(
  templateKey: LabelTemplateKey,
  widthMm: number,
  heightMm: number,
): LabelTemplate {
  const selectedTemplate = LABEL_TEMPLATES[templateKey];

  if (selectedTemplate.mode === "single") {
    return {
      ...selectedTemplate,
      widthMm,
      heightMm,
      pageWidthMm: widthMm,
      pageHeightMm: heightMm,
    };
  }

  return selectedTemplate;
}

type LabelCardProps = {
  variant: {
    id: number;
    size: string;
    color: string;
    sku: string | null;
    barcode: string | null;
    imagePath: string | null;
    product: {
      name: string;
      category: {
        name: string;
      };
    };
  };
  labelIndex: number;
  quantity: number;
  barcodeValue: string;
  canRenderBarcode: boolean;
  showName: boolean;
  showVariant: boolean;
  showLabelCount: boolean;
  showImage: boolean;
  showSku: boolean;
  showCategory: boolean;
  compact?: boolean;
  printMode?: boolean;
};

function LabelCard({
  variant,
  labelIndex,
  quantity,
  barcodeValue,
  canRenderBarcode,
  showName,
  showVariant,
  showLabelCount,
  showImage,
  showSku,
  showCategory,
  compact = false,
  printMode = false,
}: LabelCardProps) {
  const wrapperClass = printMode
    ? "flex h-full w-full flex-col justify-between p-[2mm]"
    : compact
      ? "relative flex h-full min-h-[118px] flex-col justify-between overflow-hidden rounded-[18px] border border-slate-200/90 bg-white p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
      : "relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[28px] border border-slate-200/90 bg-white p-4 shadow-[0_20px_40px_rgba(15,23,42,0.08)]";

  const imageSizeClass = printMode
    ? "h-[7mm] w-[7mm] rounded-[1.5mm]"
    : compact
      ? "h-11 w-11 rounded-xl"
      : "h-16 w-16 rounded-2xl";

  const titleClass = printMode
    ? "mt-[0.4mm] truncate text-[7px] font-semibold leading-none text-slate-950"
    : compact
      ? "mt-0.5 line-clamp-2 text-sm font-semibold leading-4 text-slate-950"
      : "mt-1 line-clamp-2 text-lg font-semibold tracking-tight text-slate-950";

  const variantClass = printMode
    ? "mt-[0.6mm] truncate text-[6px] leading-none text-slate-700"
    : compact
      ? "mt-1 text-[11px] font-medium leading-4 text-slate-700"
      : "mt-2 text-sm font-medium text-slate-700";

  const barcodeWrapClass = printMode
    ? "mt-[1.2mm] rounded-[1.5mm] border border-slate-200 bg-slate-50 px-[1mm] py-[0.8mm]"
    : compact
      ? "mt-2 rounded-xl border border-emerald-100/80 bg-[linear-gradient(180deg,_rgba(236,253,245,0.66),_rgba(255,255,255,1))] px-2 py-2"
      : "mt-4 rounded-2xl border border-emerald-100/80 bg-[linear-gradient(180deg,_rgba(236,253,245,0.66),_rgba(255,255,255,1))] px-3 py-3";

  const barcodeTextClass = printMode
    ? "mt-[0.5mm] truncate text-center text-[6px] font-semibold leading-none tracking-[0.08em] text-slate-900"
    : compact
      ? "mt-1.5 truncate text-center text-[10px] font-semibold tracking-[0.14em] text-slate-900"
      : "mt-2 text-center text-sm font-semibold tracking-[0.2em] text-slate-900";

  return (
    <div className={wrapperClass}>
      {showLabelCount ? (
        <div
          className={
            printMode
              ? "absolute right-[1.6mm] top-[1.4mm] rounded-[1.4mm] border border-slate-300 bg-slate-50 px-[1.2mm] py-[0.5mm] text-[4.5px] font-semibold leading-none text-slate-700"
              : compact
                ? "absolute right-2.5 top-2.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold tracking-[0.06em] text-slate-600"
                : "absolute right-4 top-4 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-600"
          }
        >
          {labelIndex + 1}/{quantity}
        </div>
      ) : null}

      <div className={printMode ? "flex items-start gap-[1.5mm]" : compact ? "flex items-start gap-2" : "flex items-start gap-3"}>
        {showImage ? (
          <div className={`relative shrink-0 overflow-hidden border border-slate-200 bg-slate-100 ${imageSizeClass}`}>
            {variant.imagePath ? (
              <UploadedImage
                src={variant.imagePath}
                alt={`${variant.product.name} ${variant.color}`}
                className="h-full w-full object-cover"
                loading="eager"
                decoding="sync"
              />
            ) : null}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          {showCategory ? (
            <p
              className={
                printMode
                  ? "truncate text-[6px] font-semibold uppercase leading-none tracking-[0.08em] text-slate-500"
                  : compact
                    ? "text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"
                    : "text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
              }
            >
              {variant.product.category.name}
            </p>
          ) : null}
          {showName ? <p className={titleClass}>{variant.product.name}</p> : null}
          {showVariant ? (
            <p className={variantClass}>
              Nr {variant.size} - {variant.color}
            </p>
          ) : null}
        </div>
      </div>

      <div className={barcodeWrapClass}>
        {canRenderBarcode && barcodeValue ? (
          <Code39Barcode
            value={barcodeValue}
            height={printMode ? 22 : compact ? 26 : 34}
            narrowBarWidth={1}
            wideBarWidth={printMode ? 2 : compact ? 1.8 : 2.4}
            className={printMode ? "h-[7mm] w-full" : compact ? "h-10 w-full" : "h-16 w-full"}
          />
        ) : (
          <div
            className={
              printMode
                ? "flex h-[7mm] items-center justify-center rounded-[1mm] border border-dashed border-slate-300 bg-white text-[5px] font-medium uppercase tracking-[0.1em] text-slate-500"
                : compact
                  ? "flex h-10 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500"
                  : "flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs font-medium uppercase tracking-[0.2em] text-slate-500"
            }
          >
            Barcode preview s&apos;eshte gati
          </div>
        )}
        <p className={barcodeTextClass}>{barcodeValue || "PA BARCODE"}</p>
      </div>

      {showSku ? (
        printMode ? (
          <div className="mt-[1mm] flex items-center justify-between gap-[1mm] text-[5px] leading-none text-slate-700">
            <p className="min-w-0 flex-1 truncate">
              <span className="font-semibold text-slate-500">SKU:</span> {variant.sku || "-"}
            </p>
          </div>
        ) : compact ? (
          <div className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-700">
            <span className="font-semibold text-slate-500">SKU:</span> {variant.sku || "-"}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="font-semibold uppercase tracking-[0.16em] text-slate-500">SKU</p>
              <p className="mt-1 break-all font-medium text-slate-900">{variant.sku || "-"}</p>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

export default async function VariantLabelsPage({
  params,
  searchParams,
}: VariantLabelsPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);

  const { id, variantId } = await params;
  const productId = Number(id);
  const parsedVariantId = Number(variantId);

  if (Number.isNaN(productId) || Number.isNaN(parsedVariantId)) {
    notFound();
  }

  const variant = await prisma.variant.findUnique({
    where: { id: parsedVariantId },
    select: {
      id: true,
      size: true,
      color: true,
      sku: true,
      barcode: true,
      imagePath: true,
      stock: true,
      product: {
        select: {
          id: true,
          name: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!variant || variant.product.id !== productId) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const savedPresets = currentUser.tenant?.catalogConfig?.labelPresets ?? [];
  const templateKey = isTemplateKey(resolvedSearchParams?.template)
    ? resolvedSearchParams.template
    : "custom";
  const requestedQty = Number(resolvedSearchParams?.qty ?? variant.stock);
  const quantity = clampNumber(
    requestedQty > 0 ? requestedQty : Math.max(variant.stock, 1),
    1,
    500,
    Math.max(variant.stock, 1),
  );
  const customWidthMm = clampNumber(Number(resolvedSearchParams?.w ?? 50), 30, 100, 50);
  const customHeightMm = clampNumber(Number(resolvedSearchParams?.h ?? 30), 20, 80, 30);
  const template = resolveTemplate(templateKey, customWidthMm, customHeightMm);
  const showName = resolvedSearchParams?.name !== "0";
  const showVariant = resolvedSearchParams?.variant !== "0";
  const showLabelCount = resolvedSearchParams?.count !== "0";
  const showImage = resolvedSearchParams?.img !== "0";
  const showSku = resolvedSearchParams?.sku !== "0";
  const showCategory = resolvedSearchParams?.cat !== "0";
  const labels = Array.from({ length: quantity }, (_, index) => index);
  const barcodeValue = variant.barcode?.trim() || "";
  const canRenderBarcode = isCode39ValueSupported(barcodeValue);
  const labelsPerSheet =
    template.mode === "sheet" ? (template.columns ?? 1) * (template.rows ?? 1) : 1;
  const pages = chunkArray(labels, labelsPerSheet);
  const previewPage = pages[0] ?? [];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#eef3f8_0%,_#f8fafc_24%,_#eef2f7_100%)] px-4 py-6 print:min-h-0 print:bg-white print:px-0 print:py-0 sm:px-5">
      <style>{`
        @page {
          size: ${template.pageWidthMm}mm ${template.pageHeightMm}mm;
          margin: 0;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .print-label-page {
            display: block !important;
            width: ${template.widthMm}mm !important;
            min-height: ${template.heightMm}mm !important;
            height: ${template.heightMm}mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            break-inside: avoid !important;
          }

          .print-sheet-page {
            display: block !important;
            width: ${template.pageWidthMm}mm !important;
            min-height: ${template.pageHeightMm}mm !important;
            height: ${template.pageHeightMm}mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            break-inside: avoid !important;
          }

          .print-label-page:last-child,
          .print-sheet-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-6xl space-y-5 print:max-w-none print:space-y-0">
        <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_24px_54px_rgba(15,23,42,0.08)] print:hidden">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_34%),linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(255,255,255,1))] p-4 sm:p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    <SectionSparkIcon />
                    Barcode labels
                  </div>
                  <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-slate-950 sm:text-[34px]">
                    {variant.product.name} - {variant.size} - {variant.color}
                  </h1>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                      {template.label}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                      {template.widthMm}mm x {template.heightMm}mm
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                      {quantity} etiketa
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 lg:items-end">
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <LabelControls
                      templateKey={template.key}
                      quantity={quantity}
                      widthMm={template.widthMm}
                      heightMm={template.heightMm}
                      showName={showName}
                      showVariant={showVariant}
                      showLabelCount={showLabelCount}
                      showImage={showImage}
                      showSku={showSku}
                      showCategory={showCategory}
                      presetPanel={
                        <section className="rounded-[26px] border border-slate-200/80 bg-white shadow-sm">
                          <div className="border-b border-slate-100 px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                                <PresetIcon />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-950">Preset-et</p>
                                <p className="text-xs text-slate-500">Zgjidh ose ruaj konfigurime printimi.</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4 p-4">
                            {savedPresets.length > 0 ? (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {savedPresets.map((preset) => {
                                  const href = buildPresetHref({
                                    productId,
                                    variantId: variant.id,
                                    quantity,
                                    preset,
                                  });

                                  return (
                                    <div
                                      key={preset.id}
                                      className="group flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(248,250,252,1),_rgba(255,255,255,1))] px-3.5 py-3 shadow-sm transition hover:border-emerald-200 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]"
                                    >
                                      <Link href={href} className="min-w-0 flex-1">
                                        <div className="space-y-1">
                                          <p className="truncate text-sm font-semibold text-slate-900 transition group-hover:text-emerald-700">
                                            {preset.name}
                                          </p>
                                          <p className="text-xs text-slate-500">{preset.template}</p>
                                        </div>
                                      </Link>
                                      <form action={deleteLabelPreset}>
                                        <input type="hidden" name="productId" value={productId} />
                                        <input type="hidden" name="variantId" value={variant.id} />
                                        <input type="hidden" name="presetId" value={preset.id} />
                                        <button
                                          type="submit"
                                          className="rounded-full border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                                        >
                                          Fshi
                                        </button>
                                      </form>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                                Nuk ka ende preset te ruajtura.
                              </div>
                            )}

                            <form
                              action={saveLabelPreset}
                              className="rounded-[26px] border border-emerald-200/70 bg-[linear-gradient(180deg,_rgba(236,253,245,0.8),_rgba(255,255,255,1))] p-4 shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                                  <SectionSparkIcon />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">Ruaj preset</p>
                                  <p className="text-xs text-slate-500">Ruaje konfigurimin aktual per perdorim te shpejte.</p>
                                </div>
                              </div>

                              <div className="mt-4 flex gap-2">
                                <input
                                  type="text"
                                  name="presetName"
                                  required
                                  placeholder="p.sh. A4 standard"
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                                />
                                <button
                                  type="submit"
                                  className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
                                >
                                  Ruaj
                                </button>
                              </div>
                              <input type="hidden" name="productId" value={productId} />
                              <input type="hidden" name="variantId" value={variant.id} />
                              <input type="hidden" name="template" value={template.key} />
                              <input type="hidden" name="widthMm" value={template.widthMm} />
                              <input type="hidden" name="heightMm" value={template.heightMm} />
                              <input type="hidden" name="showName" value={toQueryBool(showName)} />
                              <input type="hidden" name="showVariant" value={toQueryBool(showVariant)} />
                              <input type="hidden" name="showLabelCount" value={toQueryBool(showLabelCount)} />
                              <input type="hidden" name="showImage" value={toQueryBool(showImage)} />
                              <input type="hidden" name="showSku" value={toQueryBool(showSku)} />
                              <input type="hidden" name="showCategory" value={toQueryBool(showCategory)} />
                            </form>
                          </div>
                        </section>
                      }
                    />

                    <Link
                      href={`/products/${productId}/variants/${variant.id}/edit`}
                      className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-700"
                      aria-label="Kthehu"
                    >
                      <BackIcon />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {resolvedSearchParams?.success ? (
          <FlashMessage
            type="success"
            text={
              resolvedSearchParams.success === "preset-saved"
                ? "Preset-i u ruajt me sukses."
                : resolvedSearchParams.success === "preset-deleted"
                  ? "Preset-i u fshi me sukses."
                  : "Veprimi u krye me sukses."
            }
            className="rounded-2xl px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm print:hidden"
          />
        ) : null}

        {resolvedSearchParams?.error ? (
          <FlashMessage
            type="error"
            text="Veprimi nuk u krye. Provo perseri."
            className="rounded-2xl px-4 py-3 text-sm font-medium shadow-sm print:hidden"
          />
        ) : null}

        <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_22px_48px_rgba(15,23,42,0.08)] print:hidden">
          <div className="border-b border-slate-100 bg-[linear-gradient(180deg,_rgba(248,250,252,1),_rgba(255,255,255,1))] px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <SectionSparkIcon />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Preview aktual
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {template.mode === "sheet"
                    ? `Po shikon faqen 1 nga ${pages.length} te template-it ${template.label}.`
                    : "Kjo eshte pamja qe do te printohet ose ruhet si PDF."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {template.mode === "single" ? (
          <div className="grid gap-4 print:hidden sm:grid-cols-2 xl:grid-cols-3">
            {labels.map((labelIndex) => (
              <LabelCard
                key={`${variant.id}-${labelIndex}`}
                variant={variant}
                labelIndex={labelIndex}
                quantity={quantity}
                barcodeValue={barcodeValue}
                canRenderBarcode={canRenderBarcode}
                showName={showName}
                showVariant={showVariant}
                showLabelCount={showLabelCount}
                showImage={showImage}
                showSku={showSku}
                showCategory={showCategory}
              />
            ))}
          </div>
        ) : (
          <div className="print:hidden overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_22px_48px_rgba(15,23,42,0.08)]">
            <div className="overflow-x-auto">
              <div className="mx-auto min-w-[780px] max-w-[980px] bg-[linear-gradient(180deg,_#f8fafc,_#eef4f6)] p-5 sm:p-6">
                <div
                  className="mx-auto grid rounded-[28px] border border-slate-200/80 bg-white p-3 shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
                  style={{
                    aspectRatio: `${template.pageWidthMm} / ${template.pageHeightMm}`,
                    gridTemplateColumns: `repeat(${template.columns ?? 1}, minmax(0, 1fr))`,
                    gap: `${Math.max(8, (template.gapXmm ?? 2) * 2.8)}px ${Math.max(
                      8,
                      (template.gapYmm ?? 2) * 2.8,
                    )}px`,
                    padding: `${Math.max(12, (template.paddingYmm ?? 8) * 2.8)}px ${Math.max(
                      12,
                      (template.paddingXmm ?? 8) * 2.8,
                    )}px`,
                  }}
                >
                  {previewPage.map((labelIndex) => (
                    <LabelCard
                      key={`preview-${variant.id}-${labelIndex}`}
                      variant={variant}
                      labelIndex={labelIndex}
                      quantity={quantity}
                      barcodeValue={barcodeValue}
                      canRenderBarcode={canRenderBarcode}
                      showName={showName}
                      showVariant={showVariant}
                      showLabelCount={showLabelCount}
                      showImage={showImage}
                      showSku={showSku}
                      showCategory={showCategory}
                      compact
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {template.mode === "single" ? (
          <div className="hidden print:block">
            {labels.map((labelIndex) => (
              <article
                key={`print-${variant.id}-${labelIndex}`}
                className="print-label-page relative overflow-hidden bg-white"
              >
                <LabelCard
                  variant={variant}
                  labelIndex={labelIndex}
                  quantity={quantity}
                  barcodeValue={barcodeValue}
                  canRenderBarcode={canRenderBarcode}
                  showName={showName}
                  showVariant={showVariant}
                  showLabelCount={showLabelCount}
                  showImage={showImage}
                  showSku={showSku}
                  showCategory={showCategory}
                  printMode
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="hidden print:block">
            {pages.map((pageLabels, pageIndex) => (
              <article
                key={`sheet-${variant.id}-${pageIndex}`}
                className="print-sheet-page bg-white"
              >
                <div
                  className="grid h-full w-full"
                  style={{
                    gridTemplateColumns: `repeat(${template.columns ?? 1}, ${template.widthMm}mm)`,
                    gridTemplateRows: `repeat(${template.rows ?? 1}, ${template.heightMm}mm)`,
                    columnGap: `${template.gapXmm ?? 0}mm`,
                    rowGap: `${template.gapYmm ?? 0}mm`,
                    padding: `${template.paddingYmm ?? 0}mm ${template.paddingXmm ?? 0}mm`,
                    boxSizing: "border-box",
                  }}
                >
                  {pageLabels.map((labelIndex) => (
                    <div
                      key={`sheet-label-${variant.id}-${labelIndex}`}
                      style={{ width: `${template.widthMm}mm`, height: `${template.heightMm}mm` }}
                    >
                      <LabelCard
                        variant={variant}
                        labelIndex={labelIndex}
                        quantity={quantity}
                        barcodeValue={barcodeValue}
                        canRenderBarcode={canRenderBarcode}
                        showName={showName}
                        showVariant={showVariant}
                        showLabelCount={showLabelCount}
                        showImage={showImage}
                        showSku={showSku}
                        showCategory={showCategory}
                        printMode
                      />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
