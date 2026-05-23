"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type OrdersFiltersProps = {
  searchQuery: string;
  selectedSource: string;
  selectedDate: string;
};

export function OrdersFilters({
  searchQuery,
  selectedSource,
  selectedDate,
}: OrdersFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchQuery);
  const [source, setSource] = useState(selectedSource);
  const [date, setDate] = useState(selectedDate);

  const updateFilters = useCallback(
    (nextQuery: string, nextSource: string, nextDate: string) => {
      const params = new URLSearchParams(searchParams.toString());

      params.delete("page");

      if (nextQuery.trim()) {
        params.set("q", nextQuery.trim());
      } else {
        params.delete("q");
      }

      if (nextSource) {
        params.set("source", nextSource);
      } else {
        params.delete("source");
      }

      if (nextDate) {
        params.set("date", nextDate);
      } else {
        params.delete("date");
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
    setQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setSource(selectedSource);
  }, [selectedSource]);

  useEffect(() => {
    setDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (
        query === searchQuery &&
        source === selectedSource &&
        date === selectedDate
      ) {
        return;
      }

      updateFilters(query, source, date);
    }, 250);

    return () => clearTimeout(timeout);
  }, [
    query,
    source,
    date,
    searchQuery,
    selectedSource,
    selectedDate,
    updateFilters,
  ]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
      <input
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
      />

      <select
        value={source}
        onChange={(event) => setSource(event.target.value)}
        className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
      >
        <option value="">Filtra te tjere</option>
        <option value="INSTAGRAM">Instagram</option>
        <option value="STORE">Shitore</option>
        <option value="WHOLESALE">Shumice</option>
      </select>

      <div className="space-y-1">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-slate-400 stroke-[1.8]"
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kerko porosi..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
          />
        </div>
        <p className="text-xs text-slate-500">
          {isPending
            ? "Duke filtruar..."
            : "Kerko automatikisht sapo te shkruash"}
        </p>
      </div>
    </div>
  );
}
