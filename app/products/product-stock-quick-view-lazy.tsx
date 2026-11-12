"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { UploadedImage } from "@/app/components/uploaded-image";
import type { ProductStockQuickViewProps } from "./product-stock-quick-view";

const ProductStockQuickView = dynamic(() =>
  import("./product-stock-quick-view").then((module) => module.ProductStockQuickView),
);

export function ProductStockQuickViewLazy({
  showImageButton = true,
  iconOnly = false,
  className = "",
  imagePath,
  productName,
  ...props
}: ProductStockQuickViewProps) {
  const [opened, setOpened] = useState<{ view: "stock" | "image"; key: number } | null>(null);

  function open(view: "stock" | "image") {
    setOpened((current) => ({ view, key: (current?.key ?? 0) + 1 }));
  }

  return (
    <>
      {showImageButton ? (
        <button
          type="button"
          onClick={() => imagePath && open("image")}
          className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${className} ${imagePath ? "transition hover:border-slate-300" : ""}`}
          title={imagePath ? "Hap foton" : "Pa foto"}
          aria-label={imagePath ? `Hap foton: ${productName}` : "Pa foto"}
        >
          {imagePath ? (
            <UploadedImage src={imagePath} alt={productName} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">IMG</span>
          )}
        </button>
      ) : null}
      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.closest("details")?.removeAttribute("open");
          open("stock");
        }}
        className={`inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 ${iconOnly ? "h-10 w-10" : "px-3 py-2 text-sm font-medium"}`}
        aria-label="Stoku"
        title="Stoku"
      >
        {iconOnly ? (
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
            <path d="M4.375 6.25 10 3.75l5.625 2.5v7.5L10 16.25l-5.625-2.5v-7.5Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4.375 6.25 10 8.75m0 0 5.625-2.5M10 8.75v7.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        ) : "Stoku"}
      </button>
      {opened ? (
        <ProductStockQuickView
          key={opened.key}
          {...props}
          productName={productName}
          imagePath={imagePath}
          initialView={opened.view}
          hideTriggers
        />
      ) : null}
    </>
  );
}
