"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ProductVariantsFiltersProps = {
  selectedSize: string;
  selectedColor: string;
  selectedStock: string;
  sizes: string[];
  colors: string[];
};

export function ProductVariantsFilters({
  selectedSize,
  selectedColor,
  selectedStock,
  sizes,
  colors,
}: ProductVariantsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [size, setSize] = useState(selectedSize);
  const [color, setColor] = useState(selectedColor);
  const [stock, setStock] = useState(selectedStock);

  const updateFilters = useCallback(
    (nextSize: string, nextColor: string, nextStock: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextSize) {
        params.set("size", nextSize);
      } else {
        params.delete("size");
      }

      if (nextColor) {
        params.set("color", nextColor);
      } else {
        params.delete("color");
      }

      if (nextStock) {
        params.set("stock", nextStock);
      } else {
        params.delete("stock");
      }

      const nextUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;

      startTransition(() => {
        router.replace(nextUrl);
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setSize(selectedSize);
  }, [selectedSize]);

  useEffect(() => {
    setColor(selectedColor);
  }, [selectedColor]);

  useEffect(() => {
    setStock(selectedStock);
  }, [selectedStock]);

  useEffect(() => {
    if (
      size === selectedSize &&
      color === selectedColor &&
      stock === selectedStock
    ) {
      return;
    }

    updateFilters(size, color, stock);
  }, [
    size,
    color,
    stock,
    selectedSize,
    selectedColor,
    selectedStock,
    updateFilters,
  ]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_220px]">
      <label className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Numri
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M4 7h16M4 12h16M4 17h16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <select
            value={size}
            onChange={(event) => setSize(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
          >
            <option value="">Te gjithe numrat</option>
            {sizes.map((item) => (
              <option key={item} value={item}>
                Nr {item}
              </option>
            ))}
          </select>
        </div>
      </label>

      <label className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Ngjyra
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M12 3 4.5 9.75a7.5 7.5 0 1 0 15 0L12 3Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <select
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
          >
            <option value="">Te gjitha ngjyrat</option>
            {colors.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </label>

      <label className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Gjendja e Stokut
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                d="M4 12h16M12 4v16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <select
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
          >
            <option value="">Gjithe stoku</option>
            <option value="in">Ne stok</option>
            <option value="low">Stok i ulet</option>
            <option value="out">Pa stok</option>
          </select>
        </div>
      </label>
    </div>
  );
}
