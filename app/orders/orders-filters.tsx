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
  const printParams = new URLSearchParams({ date });
  if (query.trim()) printParams.set("q", query.trim());
  if (source) printParams.set("source", source);
  if (status) printParams.set("status", status);

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
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,230px)_180px_180px_minmax(0,1fr)]">
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

      <div className="order-1 flex min-w-0 gap-2">
        <input
          type="date"
          aria-label="Data e porosive"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="h-12 min-w-0 flex-1 rounded-2xl border border-emerald-100 bg-white/90 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:bg-emerald-50/40 focus:ring-4 focus:ring-emerald-100/70"
        />
        <a
          href={`/orders/print?${printParams.toString()}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Printo porosite per daten e zgjedhur"
          title="Printo porosite per daten e zgjedhur"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-white/90 text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.7]" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <path d="M6 15h12v6H6zM18 12h.01" />
          </svg>
        </a>
      </div>

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
