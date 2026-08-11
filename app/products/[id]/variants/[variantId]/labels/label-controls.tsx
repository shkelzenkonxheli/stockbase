"use client";

import { type ReactNode, useMemo, useState } from "react";
import { LABEL_TEMPLATE_OPTIONS, type LabelTemplateKey } from "./label-templates";

type LabelControlsProps = {
  templateKey: LabelTemplateKey;
  quantity: number;
  widthMm: number;
  heightMm: number;
  showName: boolean;
  showVariant: boolean;
  showLabelCount: boolean;
  showImage: boolean;
  showSku: boolean;
  showCategory: boolean;
  presetPanel?: ReactNode;
};

function SetupIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.7]">
      <path d="M8 3h4" strokeLinecap="round" />
      <path d="M6.2 5.2a2 2 0 0 1 1.4-.6h4.8a2 2 0 0 1 1.4.6l1 1A2 2 0 0 1 15.4 7v5.8a2 2 0 0 1-.6 1.4l-1 1a2 2 0 0 1-1.4.6H7.6a2 2 0 0 1-1.4-.6l-1-1a2 2 0 0 1-.6-1.4V7a2 2 0 0 1 .6-1.4l1-1Z" />
      <path d="M10 8v4" strokeLinecap="round" />
      <path d="M8.2 10h3.6" strokeLinecap="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.7]">
      <path d="M6 7V3.8c0-.4.3-.8.8-.8h6.4c.5 0 .8.4.8.8V7" />
      <path d="M5 13H4a1 1 0 0 1-1-1V8.8c0-.9.7-1.6 1.6-1.6h10.8c.9 0 1.6.7 1.6 1.6V12a1 1 0 0 1-1 1h-1" />
      <path d="M6 11.8h8V16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4.2Z" />
      <circle cx="14.2" cy="9.5" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.7]">
      <path d="M6 3.5h5l3 3V15a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 5 15V5A1.5 1.5 0 0 1 6.5 3.5Z" />
      <path d="M11 3.8V7h3.2" />
      <path d="M7.2 12.7h1c.6 0 1-.4 1-1s-.4-1-1-1h-1v3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 10.7h1c.7 0 1.3.6 1.3 1.3v0c0 .7-.6 1.3-1.3 1.3h-1v-2.6Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccentIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current">
      <path d="M10 2.5 12.2 7l4.8.7-3.5 3.4.8 4.8L10 13.6 5.7 16l.8-4.8L3 7.7 7.8 7 10 2.5Z" />
    </svg>
  );
}

export function LabelControls({
  templateKey,
  quantity,
  widthMm,
  heightMm,
  showName,
  showVariant,
  showLabelCount,
  showImage,
  showSku,
  showCategory,
  presetPanel,
}: LabelControlsProps) {
  const [pdfHintVisible, setPdfHintVisible] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const isCustomTemplate = templateKey === "custom";
  const configFormId = "label-config-form";
  const selectedTemplateLabel =
    LABEL_TEMPLATE_OPTIONS.find((item) => item.key === templateKey)?.label ?? templateKey;

  const enabledFieldsLabel = useMemo(
    () =>
      [
        showName ? "Emri" : null,
        showVariant ? "Varianti" : null,
        showLabelCount ? "Nr" : null,
        showImage ? "Foto" : null,
        showSku ? "SKU" : null,
        showCategory ? "Kategoria" : null,
      ]
        .filter(Boolean)
        .join(", "),
    [showCategory, showImage, showLabelCount, showName, showSku, showVariant],
  );

  async function waitForPrintableImages() {
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>(".print-label-page img, .print-sheet-page img"),
    );

    if (images.length === 0) {
      return;
    }

    await Promise.all(
      images.map((image) => {
        if (image.complete && image.naturalWidth > 0) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          const cleanup = () => {
            image.removeEventListener("load", cleanup);
            image.removeEventListener("error", cleanup);
            resolve();
          };

          image.addEventListener("load", cleanup, { once: true });
          image.addEventListener("error", cleanup, { once: true });
        });
      }),
    );
  }

  async function handlePrint(nextPdfHintVisible: boolean) {
    setPdfHintVisible(nextPdfHintVisible);
    setIsPrinting(true);

    try {
      if ("fonts" in document) {
        await document.fonts.ready;
      }

      await waitForPrintableImages();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
      window.print();
    } finally {
      window.setTimeout(() => setIsPrinting(false), 300);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setIsSetupOpen(true)}
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-700"
          >
            <SetupIcon />
            Config
          </button>
          <button
            type="button"
            onClick={() => {
              void handlePrint(false);
            }}
            disabled={isPrinting}
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 disabled:opacity-60"
          >
            <PrintIcon />
            {isPrinting ? "Po pergatitet..." : "Print"}
          </button>
          <button
            type="button"
            onClick={() => {
              void handlePrint(true);
            }}
            disabled={isPrinting}
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-700 disabled:opacity-60"
          >
            <PdfIcon />
            PDF
          </button>
        </div>

        {pdfHintVisible ? (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 shadow-sm">
              Per PDF zgjedh `Save as PDF`.
            </span>
          </div>
        ) : null}
      </div>

      {isSetupOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/60 p-4 print:hidden">
          <button
            type="button"
            onClick={() => setIsSetupOpen(false)}
            className="absolute inset-0"
            aria-label="Mbyll setup"
          />

          <div className="relative z-[141] flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-[linear-gradient(180deg,_rgba(248,250,252,1),_rgba(255,255,255,1))] px-4 py-4 sm:px-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  <SetupIcon />
                  Configuration
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-950">Menaxho etiketat</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 font-medium text-emerald-700">
                    {selectedTemplateLabel}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium">
                    {widthMm} x {heightMm} mm
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium">
                    {quantity} etiketa
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSetupOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Mbyll"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <form id={configFormId} method="get" className="space-y-4">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Formati</p>
                    <p className="text-xs text-slate-500">Zgjidh template dhe madhesine e etiketës.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Template
                      </span>
                      <select
                        name="template"
                        defaultValue={templateKey}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                      >
                        {LABEL_TEMPLATE_OPTIONS.map((template) => (
                          <option key={template.key} value={template.key}>
                            {template.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Sasia
                      </span>
                      <input
                        type="number"
                        name="qty"
                        min="1"
                        max="500"
                        defaultValue={quantity}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Gjeresia
                      </span>
                      <input
                        type="number"
                        name="w"
                        min="30"
                        max="100"
                        step="1"
                        defaultValue={widthMm}
                        disabled={!isCustomTemplate}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Lartesia
                      </span>
                      <input
                        type="number"
                        name="h"
                        min="20"
                        max="80"
                        step="1"
                        defaultValue={heightMm}
                        disabled={!isCustomTemplate}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-[22px] border border-emerald-200/80 bg-[linear-gradient(180deg,_rgba(236,253,245,0.82),_rgba(255,255,255,1))] p-3.5 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Fushat e etiketës</p>
                    <p className="text-xs text-slate-500">Zgjidh çka shfaqet në etiketë.</p>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      { name: "name", label: "Emri", value: showName },
                      { name: "variant", label: "Varianti", value: showVariant },
                      { name: "count", label: "Nr", value: showLabelCount },
                      { name: "img", label: "Foto", value: showImage },
                      { name: "sku", label: "SKU", value: showSku },
                      { name: "cat", label: "Kategoria", value: showCategory },
                    ].map((field) => (
                      <label
                        key={field.name}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/90 px-3 py-2.5 shadow-sm"
                      >
                        <div>
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            {field.label}
                          </span>
                        </div>
                        <select
                          name={field.name}
                          defaultValue={field.value ? "1" : "0"}
                          className="min-w-[88px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                        >
                          <option value="1">Po</option>
                          <option value="0">Jo</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-100 bg-white/95 pt-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    {!isCustomTemplate ? "Per A4 madhesia vjen nga template." : "Custom label lejon madhesi manuale."}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setIsSetupOpen(false)}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Anulo
                    </button>
                    <button
                      type="submit"
                      form={configFormId}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(15,23,42,0.22)] transition hover:bg-slate-800"
                    >
                      <AccentIcon />
                      Shiko pamjen
                    </button>
                  </div>
                </div>
              </form>

              {presetPanel ? <div className="mt-4 space-y-4">{presetPanel}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


