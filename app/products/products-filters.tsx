"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarcodeScanDialog } from "@/app/components/barcode-scan-dialog";

type ProductsFiltersProps = {
  searchQuery: string;
  selectedCode: string;
  selectedCategory: string;
  selectedModel: string;
  selectedWarehouse: string;
  selectedStock: string;
  categories: string[];
  models: string[];
  warehouses: string[];
};

const selectClass = "mt-1 block h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export function ProductsFilters({
  searchQuery,
  selectedCode,
  selectedCategory,
  selectedModel,
  selectedWarehouse,
  selectedStock,
  categories,
  models,
  warehouses,
}: ProductsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(searchQuery);
  const [code, setCode] = useState(selectedCode);
  const [category, setCategory] = useState(selectedCategory);
  const [model, setModel] = useState(selectedModel);
  const [warehouse, setWarehouse] = useState(selectedWarehouse);
  const [stock, setStock] = useState(selectedStock);
  const [scannerOpen, setScannerOpen] = useState(false);

  const filteredModels = category
    ? [...new Set(models.filter((option) => option.toLowerCase().startsWith(`${category.toLowerCase()}::`)).map((option) => option.split("::")[1] ?? option))]
    : [...new Set(models.map((option) => option.split("::")[1] ?? option))];

  const updateFilters = useCallback((
    nextQuery: string,
    nextCode: string,
    nextCategory: string,
    nextModel: string,
    nextWarehouse: string,
    nextStock: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (nextCode.trim()) params.set("code", nextCode.trim().toUpperCase());
    else params.delete("code");
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    else params.delete("q");
    if (nextCategory.trim()) params.set("category", nextCategory.trim());
    else params.delete("category");
    if (nextModel.trim()) params.set("model", nextModel.trim());
    else params.delete("model");
    if (nextWarehouse.trim()) params.set("warehouse", nextWarehouse.trim());
    else params.delete("warehouse");
    if (nextStock.trim()) params.set("stock", nextStock.trim());
    else params.delete("stock");

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => router.replace(nextUrl));
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (query !== searchQuery) updateFilters(query, code, category, model, warehouse, stock);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [category, code, model, query, searchQuery, stock, updateFilters, warehouse]);

  function resetFilters() {
    setQuery("");
    setCode("");
    setCategory("");
    setModel("");
    setWarehouse("");
    setStock("in");
    startTransition(() => router.replace(pathname));
  }

  const hasExtraFilters = Boolean(query || code || category || model || warehouse || (stock && stock !== "in"));

  return (
    <>
      <form onSubmit={(event) => { event.preventDefault(); updateFilters(query, code, category, model, warehouse, stock); }}>
        <div className="flex flex-col gap-2 md:flex-row">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Kerko produkt, kategori, ngjyre, dimension ose SKU</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 fill-none stroke-slate-400 stroke-[1.8]"><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kerko emer, brand, ngjyre, numer ose SKU"
              className="h-10 w-full rounded-xl border border-slate-200 bg-[#fbfcfa] pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setScannerOpen(true)} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 md:flex-none">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.7]"><path d="M6 3H4a1 1 0 0 0-1 1v2m11-3h2a1 1 0 0 1 1 1v2M3 14v2a1 1 0 0 0 1 1h2m11-3v2a1 1 0 0 1-1 1h-2M5 10h10M7 8v4m3-4v4m3-4v4" strokeLinecap="round" /></svg>
              Skano
            </button>
            <button type="button" onClick={resetFilters} disabled={!hasExtraFilters} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45 md:flex-none">Pastro</button>
          </div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="min-w-0 text-xs font-semibold text-slate-600">Kategoria
            <select value={category} onChange={(event) => { const next = event.target.value; setCategory(next); setModel(""); updateFilters(query, code, next, "", warehouse, stock); }} className={selectClass}>
              <option value="">Te gjitha kategorite</option>
              {categories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-xs font-semibold text-slate-600">Produkti / Modeli
            <select value={model} onChange={(event) => { const next = event.target.value; setModel(next); updateFilters(query, code, category, next, warehouse, stock); }} disabled={filteredModels.length === 0} className={selectClass}>
              <option value="">Te gjitha produktet</option>
              {filteredModels.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-xs font-semibold text-slate-600">Depoja
            <select value={warehouse} onChange={(event) => { const next = event.target.value; setWarehouse(next); updateFilters(query, code, category, model, next, stock); }} disabled={warehouses.length === 0} className={selectClass}>
              <option value="">Te gjitha depot</option>
              {warehouses.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-xs font-semibold text-slate-600">Gjendja e stokut
            <select value={stock} onChange={(event) => { const next = event.target.value; setStock(next); updateFilters(query, code, category, model, warehouse, next); }} className={selectClass}>
              <option value="all">Te gjitha produktet</option>
              <option value="low">Vetem stok i ulet</option>
              <option value="in">Vetem ne stok</option>
              <option value="out">Pa stok (edhe pa variante)</option>
            </select>
          </label>
        </div>

        {code ? <p className="mt-3 text-xs font-medium text-emerald-800">Barcode aktiv: {code}</p> : null}
      </form>

      <BarcodeScanDialog
        open={scannerOpen}
        title="Skano produktin"
        description="Sapo lexohet barcode-i, lista filtrohet dhe shfaq vetem produktin perkates."
        onClose={() => setScannerOpen(false)}
        onDetected={(detectedCode) => {
          setCode(detectedCode);
          updateFilters(query, detectedCode, category, model, warehouse, stock);
        }}
      />
    </>
  );
}
