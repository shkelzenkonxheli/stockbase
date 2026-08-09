import Link from "next/link";
import { notFound } from "next/navigation";
import { UploadedImage } from "@/app/components/uploaded-image";
import { requireRole } from "@/lib/auth";
import { Code39Barcode, isCode39ValueSupported } from "@/lib/code39-barcode";
import { prisma } from "@/lib/prisma";
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
  }>;
};

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

export default async function VariantLabelsPage({
  params,
  searchParams,
}: VariantLabelsPageProps) {
  await requireRole(["SUPER_ADMIN"]);

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
  const requestedQty = Number(resolvedSearchParams?.qty ?? variant.stock);
  const quantity = clampNumber(
    requestedQty > 0 ? requestedQty : Math.max(variant.stock, 1),
    1,
    500,
    Math.max(variant.stock, 1),
  );
  const widthMm = clampNumber(Number(resolvedSearchParams?.w ?? 50), 30, 100, 50);
  const heightMm = clampNumber(Number(resolvedSearchParams?.h ?? 30), 20, 80, 30);
  const showName = resolvedSearchParams?.name !== "0";
  const showVariant = resolvedSearchParams?.variant !== "0";
  const showLabelCount = resolvedSearchParams?.count !== "0";
  const showImage = resolvedSearchParams?.img !== "0";
  const showSku = resolvedSearchParams?.sku !== "0";
  const showCategory = resolvedSearchParams?.cat !== "0";
  const labels = Array.from({ length: quantity }, (_, index) => index);
  const barcodeValue = variant.barcode?.trim() || "";
  const canRenderBarcode = isCode39ValueSupported(barcodeValue);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:min-h-0 print:bg-white print:px-0 print:py-0">
      <style>{`
        @page {
          size: ${widthMm}mm ${heightMm}mm;
          margin: 0;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .screen-label-card {
            display: none !important;
          }

          .print-label-card {
            display: flex !important;
          }

          .print-label-page {
            display: block !important;
            width: ${widthMm}mm !important;
            min-height: ${heightMm}mm !important;
            height: ${heightMm}mm !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            break-inside: avoid !important;
          }

          .print-label-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-6xl space-y-6 print:max-w-none print:space-y-0">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm print:hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Printo etiketa
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {variant.product.name} - {variant.size} - {variant.color}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Preview: <span className="font-semibold text-slate-900">{widthMm}mm x {heightMm}mm</span> ·
                Sasia: <span className="font-semibold text-slate-900"> {quantity}</span>
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/products/${productId}/variants/${variant.id}/edit`}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Kthehu
              </Link>
            </div>
          </div>
        </div>

        <LabelControls
          quantity={quantity}
          widthMm={widthMm}
          heightMm={heightMm}
          showName={showName}
          showVariant={showVariant}
          showLabelCount={showLabelCount}
          showImage={showImage}
          showSku={showSku}
          showCategory={showCategory}
        />

        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm print:hidden sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Preview aktual
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Kjo është pamja që do të printohet ose ruhet si PDF.
            </p>
          </div>
        </div>

        <div className="grid gap-4 print:block sm:grid-cols-2 xl:grid-cols-3">
          {labels.map((labelIndex) => (
            <article
              key={`${variant.id}-${labelIndex}`}
              className="print-label-page relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[24px] border border-slate-300 bg-white p-4 shadow-sm print:mx-0 print:mb-0 print:max-w-none print:break-after-page print:break-inside-avoid print:rounded-none print:border-0 print:p-0 print:shadow-none"
              style={{
                width: `${widthMm}mm`,
                minHeight: `${heightMm}mm`,
                height: `${heightMm}mm`,
              }}
            >
              {showLabelCount ? (
                <div className="screen-label-card absolute right-4 top-4 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-slate-600">
                  {labelIndex + 1}/{quantity}
                </div>
              ) : null}

              <div className="screen-label-card flex items-start gap-3">
                {showImage ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 print:h-[8mm] print:w-[8mm] print:rounded-[2mm]">
                  {variant.imagePath ? (
                    <UploadedImage
                      src={variant.imagePath}
                      alt={`${variant.product.name} ${variant.color}`}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  {showCategory ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 print:text-[7px] print:tracking-[0.12em]">
                      {variant.product.category.name}
                    </p>
                  ) : null}
                  {showName ? (
                    <h2 className="mt-1 line-clamp-2 text-lg font-semibold tracking-tight text-slate-950 print:mt-[0.5mm] print:text-[9px] print:leading-[1.1]">
                      {variant.product.name}
                    </h2>
                  ) : null}
                  {showVariant ? (
                    <p className="mt-2 text-sm font-medium text-slate-700 print:mt-[1mm] print:text-[7px]">
                      Nr {variant.size} - {variant.color}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="screen-label-card mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                {canRenderBarcode && barcodeValue ? (
                  <Code39Barcode
                    value={barcodeValue}
                    height={34}
                    narrowBarWidth={1}
                    wideBarWidth={2.4}
                    className="h-16 w-full print:h-[9mm]"
                  />
                ) : (
                  <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs font-medium uppercase tracking-[0.2em] text-slate-500 print:h-[9mm] print:rounded-[2mm] print:text-[6px]">
                    Barcode preview s&apos;eshte gati
                  </div>
                )}
                <p className="mt-2 text-center text-sm font-semibold tracking-[0.2em] text-slate-900 print:mt-[0.8mm] print:text-[7px] print:tracking-[0.12em]">
                  {barcodeValue || "PA BARCODE"}
                </p>
              </div>

              <div className="screen-label-card mt-4 grid grid-cols-2 gap-2 text-xs">
                {showSku ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 print:rounded-[2mm] print:px-[1.5mm] print:py-[1mm]">
                    <p className="font-semibold uppercase tracking-[0.16em] text-slate-500 print:tracking-[0.1em]">
                      SKU
                    </p>
                    <p className="mt-1 break-all font-medium text-slate-900 print:mt-[0.5mm]">
                      {variant.sku || "-"}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="print-label-card hidden h-full w-full flex-col justify-between p-[2mm]">
                {showLabelCount ? (
                  <div className="absolute right-[1.6mm] top-[1.4mm] rounded-[1.4mm] border border-slate-300 bg-slate-50 px-[1.2mm] py-[0.5mm] text-[4.5px] font-semibold leading-none text-slate-700">
                    {labelIndex + 1}/{quantity}
                  </div>
                ) : null}
                <div className="flex items-start gap-[1.5mm]">
                  {showImage && variant.imagePath ? (
                    <div className="relative h-[7mm] w-[7mm] shrink-0 overflow-hidden rounded-[1.5mm] border border-slate-200 bg-slate-100">
                      <UploadedImage
                        src={variant.imagePath}
                        alt={`${variant.product.name} ${variant.color}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    {showCategory ? (
                      <p className="truncate text-[6px] font-semibold uppercase leading-none tracking-[0.08em] text-slate-500">
                        {variant.product.category.name}
                      </p>
                    ) : null}
                    {showName ? (
                      <p className="mt-[0.4mm] truncate text-[7px] font-semibold leading-none text-slate-950">
                        {variant.product.name}
                      </p>
                    ) : null}
                    {showVariant ? (
                      <p className="mt-[0.6mm] truncate text-[6px] leading-none text-slate-700">
                        Nr {variant.size} - {variant.color}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-[1.2mm] rounded-[1.5mm] border border-slate-200 bg-slate-50 px-[1mm] py-[0.8mm]">
                  {canRenderBarcode && barcodeValue ? (
                    <Code39Barcode
                      value={barcodeValue}
                      height={22}
                      narrowBarWidth={1}
                      wideBarWidth={2}
                      className="h-[7mm] w-full"
                    />
                  ) : (
                    <div className="flex h-[7mm] items-center justify-center rounded-[1mm] border border-dashed border-slate-300 bg-white text-[5px] font-medium uppercase tracking-[0.1em] text-slate-500">
                      Barcode preview s&apos;eshte gati
                    </div>
                  )}
                  <p className="mt-[0.5mm] truncate text-center text-[6px] font-semibold leading-none tracking-[0.08em] text-slate-900">
                    {barcodeValue || "PA BARCODE"}
                  </p>
                </div>

                <div className="mt-[1mm] flex items-center justify-between gap-[1mm] text-[5px] leading-none text-slate-700">
                  {showSku ? (
                    <p className="min-w-0 flex-1 truncate">
                      <span className="font-semibold text-slate-500">SKU:</span>{" "}
                      {variant.sku || "-"}
                    </p>
                  ) : <span />}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
