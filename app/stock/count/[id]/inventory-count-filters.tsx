"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarcodeScanDialog } from "@/app/components/barcode-scan-dialog";
import type { InventoryCountFilterValue } from "@/lib/inventory-counts";

type InventoryCountFiltersProps = {
  searchQuery: string;
  selectedCategory: string;
  selectedModel: string;
  selectedFilter: InventoryCountFilterValue;
  categoryOptions: string[];
  modelOptionsByCategory: Record<string, string[]>;
  warehouseId: number;
};

export function InventoryCountFilters({
  searchQuery,
  selectedCategory,
  selectedModel,
  selectedFilter,
  categoryOptions,
  modelOptionsByCategory,
  warehouseId,
}: InventoryCountFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchQuery);
  const [category, setCategory] = useState(selectedCategory);
  const [model, setModel] = useState(selectedModel);
  const [filter, setFilter] = useState<InventoryCountFilterValue>(selectedFilter);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const firstRenderRef = useRef(true);

  const modelOptions = useMemo(() => {
    if (!category) {
      return [...new Set(Object.values(modelOptionsByCategory).flat())];
    }

    return modelOptionsByCategory[category] ?? [];
  }, [category, modelOptionsByCategory]);

  function updateUrl(nextValues: {
    query?: string;
    category?: string;
    model?: string;
    filter?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    const nextQuery = nextValues.query ?? query;
    const nextCategory = nextValues.category ?? category;
    const nextModel = nextValues.model ?? model;
    const nextFilter = nextValues.filter ?? filter;

    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    else params.delete("q");

    if (nextCategory.trim()) params.set("category", nextCategory.trim());
    else params.delete("category");

    if (nextModel.trim()) params.set("model", nextModel.trim());
    else params.delete("model");

    if (nextFilter.trim() && nextFilter !== "all") params.set("filter", nextFilter.trim());
    else params.delete("filter");

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}#details` : `${pathname}#details`;

    startTransition(() => {
      router.replace(nextUrl);
    });
  }

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      updateUrl({ query });
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (!scannerMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setScannerMessage(null);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [scannerMessage]);

  async function handleScanDetected(code: string) {
    try {
      const response = await fetch(
        `/api/variants/lookup?code=${encodeURIComponent(code)}&warehouseId=${warehouseId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        setScannerMessage("Nuk u gjet variant me kete barcode ne kete depo.");
        return;
      }

      const data = (await response.json()) as {
        variant: {
          sku?: string | null;
          color: string;
          size: string;
        };
        product: {
          name: string;
        };
      };

      const nextQuery =
        data.variant.sku?.trim() ||
        `${data.product.name} ${data.variant.color} ${data.variant.size}`;

      setQuery(nextQuery);
      updateUrl({ query: nextQuery });
      setScannerMessage(`U gjet: ${data.product.name} / ${data.variant.color} / ${data.variant.size}`);
    } catch {
      setScannerMessage("Skanimi u lexua, por lookup deshtoi. Provo perseri.");
    }
  }

  return (
    <>
    <div className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_220px_220px_220px_auto_auto]">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Kerko produkt, sku, ngjyre, madhesi, lokacion..."
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
      />

      <select
        value={category}
        onChange={(event) => {
          const nextCategory = event.target.value;
          setCategory(nextCategory);
          setModel("");
          updateUrl({ category: nextCategory, model: "" });
        }}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
      >
        <option value="">Te gjitha kategorite</option>
        {categoryOptions.map((categoryOption) => (
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
          updateUrl({ model: nextModel });
        }}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
      >
        <option value="">Te gjitha modelet</option>
        {modelOptions.map((modelOption) => (
          <option key={modelOption} value={modelOption}>
            {modelOption}
          </option>
        ))}
      </select>

      <select
        value={filter}
        onChange={(event) => {
          const nextFilter = event.target.value as InventoryCountFilterValue;
          setFilter(nextFilter);
          updateUrl({ filter: nextFilter });
        }}
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
      >
        <option value="all">Te gjitha</option>
        <option value="counted">Te numeruara</option>
        <option value="uncounted">Pa numeruar</option>
        <option value="changed">Me diference</option>
      </select>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Scan
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setCategory("");
            setModel("");
            setFilter("all");
            startTransition(() => {
              router.replace(`${pathname}#details`);
            });
          }}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <p className="text-xs text-slate-500 lg:col-span-full">
        {isPending
          ? "Duke rifreskuar listen..."
          : scannerMessage || "Search, kategoria dhe modeli rifreskohen menjehere."}
      </p>
    </div>
    <BarcodeScanDialog
      open={scannerOpen}
      title="Skano variantin per numerim"
      description="Barcode-i kerkohet ne depon e ketij sesioni dhe lista filtrohet direkt te varianti i gjetur."
      onClose={() => setScannerOpen(false)}
      onDetected={(detectedCode) => {
        void handleScanDetected(detectedCode);
      }}
    />
    </>
  );
}
