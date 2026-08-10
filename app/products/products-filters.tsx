"use client";

import { useCallback, useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchQuery);
  const [code, setCode] = useState(selectedCode);
  const [category, setCategory] = useState(selectedCategory);
  const [model, setModel] = useState(selectedModel);
  const [warehouse, setWarehouse] = useState(selectedWarehouse);
  const [stock, setStock] = useState(selectedStock);
  const [scannerOpen, setScannerOpen] = useState(false);

  const filteredModels = category
    ? [
        ...new Set(
          models
            .filter((modelOption) =>
              modelOption.toLowerCase().startsWith(`${category.toLowerCase()}::`),
            )
            .map((modelOption) => modelOption.split("::")[1] ?? modelOption),
        ),
      ]
    : [...new Set(models.map((modelOption) => modelOption.split("::")[1] ?? modelOption))];

  const updateFilters = useCallback(
    (
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

      startTransition(() => {
        router.replace(nextUrl);
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <>
      <form
        className="space-y-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          updateFilters(query, code, category, model, warehouse, stock);
        }}
      >
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.45fr)_96px_180px_180px_180px_150px_108px]">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-slate-400 stroke-[1.8]"
              >
                <circle cx="11" cy="11" r="6" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Kerko produkt, kategori, ngjyre, dimension ose SKU..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 sm:min-w-[78px]"
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="mr-1.5 h-4 w-4 fill-none stroke-current stroke-[1.8]"
              >
                <circle cx="9" cy="9" r="4.5" />
                <path d="m13 13 3 3" strokeLinecap="round" />
              </svg>
              Kerko
            </button>
          </div>

          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Scan
          </button>

          <select
            value={category}
            onChange={(event) => {
              const nextCategory = event.target.value;
              setCategory(nextCategory);
              setModel("");
              updateFilters(query, code, nextCategory, "", warehouse, stock);
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
          >
            <option value="">Te gjitha kategorite</option>
            {categories.map((categoryOption) => (
              <option key={categoryOption} value={categoryOption}>
                {categoryOption}
              </option>
            ))}
          </select>

          <select
            value={model}
            onChange={(event) => {
              const nextModel = event.target.value;
              setModel(nextModel);
              updateFilters(query, code, category, nextModel, warehouse, stock);
            }}
            disabled={filteredModels.length === 0}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
          >
            <option value="">Te gjitha produktet</option>
            {filteredModels.map((modelOption) => (
              <option key={modelOption} value={modelOption}>
                {modelOption}
              </option>
            ))}
          </select>

          <select
            value={warehouse}
            onChange={(event) => {
              const nextWarehouse = event.target.value;
              setWarehouse(nextWarehouse);
              updateFilters(query, code, category, model, nextWarehouse, stock);
            }}
            disabled={warehouses.length === 0}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <option value="">Te gjitha depot</option>
            {warehouses.map((warehouseOption) => (
              <option key={warehouseOption} value={warehouseOption}>
                {warehouseOption}
              </option>
            ))}
          </select>

          <select
            value={stock}
            onChange={(event) => {
              const nextStock = event.target.value;
              setStock(nextStock);
              updateFilters(query, code, category, model, warehouse, nextStock);
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
          >
            <option value="">Gjithe stoku</option>
            <option value="low">Vetem stok i ulet</option>
            <option value="in">Vetem ne stok</option>
            <option value="out">Vetem pa stok</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCode("");
              setCategory("");
              setModel("");
              setWarehouse("");
              setStock("");
              startTransition(() => {
                router.replace(pathname);
              });
            }}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="mr-1.5 h-4 w-4 fill-none stroke-current stroke-[1.8]"
            >
              <path d="M4.5 10A5.5 5.5 0 1 0 6 6.1" strokeLinecap="round" />
              <path d="M4.5 4.75v2.5H7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reset
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          {isPending ? "Duke filtruar..." : code ? `Filtri aktiv nga barcode: ${code}` : "Filtrat punojne sipas kategorise, produktit dhe gjendjes se stokut."}
        </p>
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
