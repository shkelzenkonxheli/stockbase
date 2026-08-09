"use client";

import { useState } from "react";

type LabelControlsProps = {
  quantity: number;
  widthMm: number;
  heightMm: number;
  showName: boolean;
  showVariant: boolean;
  showLabelCount: boolean;
  showImage: boolean;
  showSku: boolean;
  showCategory: boolean;
};

export function LabelControls({
  quantity,
  widthMm,
  heightMm,
  showName,
  showVariant,
  showLabelCount,
  showImage,
  showSku,
  showCategory,
}: LabelControlsProps) {
  const [pdfHintVisible, setPdfHintVisible] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  async function waitForPrintableImages() {
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>(".print-label-page img"),
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
    <div className="flex flex-col gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm print:hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Label Setup
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            Preview dhe Print
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Zgjidh madhesine e etiketes dhe fushat qe do te shfaqen para printimit.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              void handlePrint(false);
            }}
            disabled={isPrinting}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
          >
            {isPrinting ? "Po pergatitet..." : "Print Browser"}
          </button>
          <button
            type="button"
            onClick={() => {
              void handlePrint(true);
            }}
            disabled={isPrinting}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Ruaj si PDF
          </button>
        </div>
      </div>

      {pdfHintVisible ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Ne dialogun e printimit zgjidh destinacionin <span className="font-semibold">Save as PDF</span>.
        </div>
      ) : null}

      <form method="get" className="grid gap-4 lg:grid-cols-[120px_120px_120px_repeat(6,auto)_1fr] lg:items-end">
        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Sasia
          </span>
          <input
            type="number"
            name="qty"
            min="1"
            max="500"
            defaultValue={quantity}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          />
        </label>

        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Gjeresia
          </span>
          <input
            type="number"
            name="w"
            min="30"
            max="100"
            step="1"
            defaultValue={widthMm}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          />
        </label>

        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Lartesia
          </span>
          <input
            type="number"
            name="h"
            min="20"
            max="80"
            step="1"
            defaultValue={heightMm}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          />
        </label>

        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Emri
          </span>
          <select
            name="name"
            defaultValue={showName ? "1" : "0"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          >
            <option value="1">Po</option>
            <option value="0">Jo</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Varianti
          </span>
          <select
            name="variant"
            defaultValue={showVariant ? "1" : "0"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          >
            <option value="1">Po</option>
            <option value="0">Jo</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Nr etiketes
          </span>
          <select
            name="count"
            defaultValue={showLabelCount ? "1" : "0"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          >
            <option value="1">Po</option>
            <option value="0">Jo</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Foto
          </span>
          <select
            name="img"
            defaultValue={showImage ? "1" : "0"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          >
            <option value="1">Po</option>
            <option value="0">Jo</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            SKU
          </span>
          <select
            name="sku"
            defaultValue={showSku ? "1" : "0"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          >
            <option value="1">Po</option>
            <option value="0">Jo</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Kategoria
          </span>
          <select
            name="cat"
            defaultValue={showCategory ? "1" : "0"}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
          >
            <option value="1">Po</option>
            <option value="0">Jo</option>
          </select>
        </label>

        <div className="flex justify-start lg:justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Rifresko preview
          </button>
        </div>
      </form>
    </div>
  );
}
