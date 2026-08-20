"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type OrdersFiltersProps = {
  searchQuery: string;
  selectedSource: string;
  selectedStatus: string;
  selectedDate: string;
};

export function OrdersFilters({
  searchQuery,
  selectedSource,
  selectedStatus,
  selectedDate,
}: OrdersFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchQuery);
  const [source, setSource] = useState(selectedSource);
  const [status, setStatus] = useState(selectedStatus);
  const [date, setDate] = useState(selectedDate);

  const updateFilters = useCallback(
    (nextQuery: string, nextSource: string, nextStatus: string, nextDate: string) => {
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

      if (nextStatus) {
        params.set("status", nextStatus);
      } else {
        params.delete("status");
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
    setStatus(selectedStatus);
  }, [selectedStatus]);

  useEffect(() => {
    setDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (
        query === searchQuery &&
        source === selectedSource &&
        status === selectedStatus &&
        date === selectedDate
      ) {
        return;
      }

      updateFilters(query, source, status, date);
    }, 250);

    return () => clearTimeout(timeout);
  }, [
    query,
    source,
    status,
    date,
    searchQuery,
    selectedSource,
    selectedStatus,
    selectedDate,
    updateFilters,
  ]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_180px_180px_minmax(0,1fr)]">
      <div className="order-4 space-y-1 lg:order-4">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-emerald-600/70 stroke-[1.8]"
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kerko porosi..."
            className="w-full rounded-2xl border border-emerald-100 bg-white/90 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-emerald-50/40 focus:ring-4 focus:ring-emerald-100/70"
          />
        </div>
        <p className="text-xs text-slate-500">
          {isPending
            ? "Duke filtruar..."
            : "Kerko automatikisht sapo te shkruash"}
        </p>
      </div>

      <input
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        className="order-1 h-12 rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-emerald-50/40 focus:ring-4 focus:ring-emerald-100/70"
      />

      <select
        value={source}
        onChange={(event) => setSource(event.target.value)}
        className="order-2 h-12 rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-emerald-50/40 focus:ring-4 focus:ring-emerald-100/70"
      >
        <option value="">Filtra te tjere</option>
        <option value="INSTAGRAM">Instagram</option>
        <option value="STORE">Shitore</option>
        <option value="WHOLESALE">Shumice</option>
      </select>

      <select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        className="order-3 h-12 rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-emerald-50/40 focus:ring-4 focus:ring-emerald-100/70"
      >
        <option value="">Te gjitha statuset</option>
        <option value="NEW">NEW</option>
        <option value="READY">READY</option>
        <option value="DONE">DONE</option>
        <option value="PARTIALLY_RETURNED">PARTIALLY_RETURNED</option>
        <option value="RETURNED">RETURNED</option>
        <option value="CANCELED">CANCELED</option>
      </select>
    </div>
  );
}
