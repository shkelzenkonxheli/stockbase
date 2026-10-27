"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { BarcodeScanDialog } from "@/app/components/barcode-scan-dialog";
import { UploadedImage } from "@/app/components/uploaded-image";

type WarehouseOption = { id: number; name: string };
type TransferVariant = {
  id: number;
  productId: number;
  productName: string;
  brand: string | null;
  category: string;
  size: string;
  color: string;
  imagePath: string | null;
  sku: string | null;
  stock: number;
};
type CartItem = { variant: TransferVariant; quantity: number };
type TransferFilters = { category: string; brand: string; model: string; color: string };
type FilterOptions = { categories: string[]; brands: string[]; models: { name: string; colors: string[] }[] };
const emptyFilters: TransferFilters = { category: "", brand: "", model: "", color: "" };

function VariantImage({ variant }: { variant: TransferVariant }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-emerald-900">
      {variant.imagePath ? <UploadedImage src={variant.imagePath} alt={variant.productName} className="h-full w-full object-cover" /> : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current stroke-[1.6]"><path d="m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10" /></svg>
      )}
    </div>
  );
}

function SubmitTransferButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60">{pending ? "Duke ruajtur..." : "Konfirmo transferin"}</button>;
}

export function TransferStockForm({ action, warehouses }: {
  action: (formData: FormData) => void | Promise<void>;
  warehouses: WarehouseOption[];
}) {
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0] ? String(warehouses[0].id) : "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1] ? String(warehouses[1].id) : "");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<TransferFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<TransferFilters>(emptyFilters);
  const [optionsCache, setOptionsCache] = useState<Record<string, FilterOptions>>({});
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [results, setResults] = useState<TransferVariant[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftQuantities, setDraftQuantities] = useState<Record<number, number>>({});
  const [cart, setCart] = useState<Record<number, CartItem>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const reviewRef = useRef<HTMLDialogElement>(null);
  const appliedFilterCount = Object.values(appliedFilters).filter(Boolean).length;
  const searchActive = Boolean(query.trim() || appliedFilterCount);
  const requestKey = JSON.stringify([fromWarehouseId, query.trim(), appliedFilters]);
  const searchLoading = searchActive && (loading || loadedKey !== requestKey);
  const optionsKey = JSON.stringify([fromWarehouseId, draftFilters.category, draftFilters.brand]);
  const filterOptions = optionsCache[optionsKey];
  const categoryOptions = optionsCache[JSON.stringify([fromWarehouseId, "", ""])] ?? filterOptions;
  const brandOptions = optionsCache[JSON.stringify([fromWarehouseId, draftFilters.category, ""])] ?? filterOptions;
  const colorOptions = filterOptions?.models.find((item) => item.name === draftFilters.model)?.colors ?? [];

  useEffect(() => {
    if (!filtersOpen || !fromWarehouseId || filterOptions) return;
    const controller = new AbortController();
    const loadOptions = async () => {
      setFilterLoading(true);
      setFilterError(null);
      try {
        const params = new URLSearchParams({ warehouseId: fromWarehouseId, options: "1", category: draftFilters.category, brand: draftFilters.brand });
        const response = await fetch(`/api/stock/transfer/variants?${params}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("load failed");
        const options = (await response.json()) as FilterOptions;
        if (!controller.signal.aborted) setOptionsCache((current) => ({ ...current, [optionsKey]: options }));
      } catch {
        if (!controller.signal.aborted) setFilterError("Filtrat nuk u ngarkuan. Mbylli dhe hapi perseri.");
      } finally {
        if (!controller.signal.aborted) setFilterLoading(false);
      }
    };
    void loadOptions();
    return () => controller.abort();
  }, [filtersOpen, fromWarehouseId, draftFilters.category, draftFilters.brand, filterOptions, optionsKey]);

  useEffect(() => {
    if (!fromWarehouseId || !searchActive) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams({ warehouseId: fromWarehouseId, q: query.trim(), ...appliedFilters });
        const response = await fetch(`/api/stock/transfer/variants?${params}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("load failed");
        const data = (await response.json()) as { variants: TransferVariant[]; hasMore: boolean };
        if (!controller.signal.aborted) {
          setResults(data.variants);
          setHasMore(data.hasMore);
          setLoadedKey(requestKey);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setLoadedKey(requestKey);
          setLoadError("Variantet nuk u ngarkuan. Provo perseri.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 180 : 0);
    return () => { controller.abort(); window.clearTimeout(timeoutId); };
  }, [fromWarehouseId, query, appliedFilters, searchActive, requestKey]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const totalUnits = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const fromName = warehouses.find((warehouse) => String(warehouse.id) === fromWarehouseId)?.name ?? "-";
  const toName = warehouses.find((warehouse) => String(warehouse.id) === toWarehouseId)?.name ?? "-";
  const canReview = warehouses.length > 1 && fromWarehouseId !== toWarehouseId && cartItems.length > 0;
  const serializedAdjustments = JSON.stringify(cartItems.map(({ variant, quantity }) => ({ variantId: variant.id, quantity })));

  function setDraftQuantity(variant: TransferVariant, quantity: number) {
    setDraftQuantities((current) => ({ ...current, [variant.id]: Math.max(1, Math.min(variant.stock, quantity)) }));
  }

  function addToCart(variant: TransferVariant) {
    const quantity = draftQuantities[variant.id] ?? 1;
    setCart((current) => {
      if (!current[variant.id] && Object.keys(current).length >= 100) return current;
      const existing = current[variant.id]?.quantity ?? 0;
      return { ...current, [variant.id]: { variant, quantity: Math.min(variant.stock, existing + quantity) } };
    });
  }

  function updateCartQuantity(variantId: number, quantity: number) {
    setCart((current) => {
      const item = current[variantId];
      if (!item) return current;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[variantId];
        return next;
      }
      return { ...current, [variantId]: { ...item, quantity: Math.min(item.variant.stock, quantity) } };
    });
  }

  async function handleScanDetected(code: string) {
    if (!fromWarehouseId) return;
    try {
      const params = new URLSearchParams({ code, warehouseId: fromWarehouseId });
      const response = await fetch(`/api/variants/lookup?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("not found");
      const data = (await response.json()) as {
        variant: { id: number; productId: number; size: string; color: string; imagePath: string | null; sku: string | null; stock: number };
        product: { name: string; brand: string; category: string };
      };
      if (!data.variant || !data.product || data.variant.stock <= 0) throw new Error("no stock");
      if (cartItems.length >= 100 && !cart[data.variant.id]) {
        setScannerMessage("Transferi mund te kete deri ne 100 variante.");
        return;
      }
      addToCart({
        id: data.variant.id,
        productId: data.variant.productId,
        productName: data.product.name,
        brand: data.product.brand,
        category: data.product.category,
        size: data.variant.size,
        color: data.variant.color,
        imagePath: data.variant.imagePath,
        sku: data.variant.sku,
        stock: data.variant.stock,
      });
      setScannerMessage(`${data.product.name} u shtua ne transfer.`);
      setDraftFilters(emptyFilters);
      setAppliedFilters(emptyFilters);
      setQuery(code);
      setResults([]);
      setScannerOpen(false);
    } catch {
      setScannerMessage("Nuk u gjet variant me stok ne depon burim per kete kod.");
    }
  }

  return (
    <form action={action} className="mt-7">
      <input type="hidden" name="fromWarehouseId" value={fromWarehouseId} />
      <input type="hidden" name="toWarehouseId" value={toWarehouseId} />
      <input type="hidden" name="adjustments" value={serializedAdjustments} />

      <div className="rounded-[26px] border border-emerald-950/10 bg-white p-4 shadow-[0_18px_50px_rgba(8,44,31,0.05)] sm:p-6">
        <div className="grid gap-4 border-b border-slate-100 pb-6 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <label className="block min-w-0 text-sm font-semibold text-slate-800">Nga depoja
            <select value={fromWarehouseId} onChange={(event) => {
              const next = event.target.value;
              setFromWarehouseId(next);
              setToWarehouseId((current) => current === next ? String(warehouses.find((warehouse) => String(warehouse.id) !== next)?.id ?? "") : current);
              setQuery(""); setResults([]); setHasMore(false); setCart({}); setDraftQuantities({}); setScannerMessage(null);
              setDraftFilters(emptyFilters); setAppliedFilters(emptyFilters); setFiltersOpen(false);
            }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>
          <span aria-hidden="true" className="hidden pb-3 text-lg text-emerald-700 sm:block">&rarr;</span>
          <label className="block min-w-0 text-sm font-semibold text-slate-800">Te depoja
            <select value={toWarehouseId} onChange={(event) => setToWarehouseId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
              {warehouses.filter((warehouse) => String(warehouse.id) !== fromWarehouseId).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>
        </div>

        {warehouses.length < 2 ? <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Per transfer duhen dy depo aktive. <Link href="/settings" className="font-bold underline">Konfiguro depot</Link>.</p> : null}

        <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <section aria-labelledby="transfer-find-heading" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="transfer-find-heading" className="text-lg font-bold">Gjej produktet</h2>
              <div className="flex items-center gap-2">
                <button type="button" aria-expanded={filtersOpen} aria-controls="transfer-filters" onClick={() => setFiltersOpen((open) => !open)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${appliedFilterCount ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Filtrat{appliedFilterCount ? ` (${appliedFilterCount})` : ""}</button>
                <button type="button" onClick={() => setScannerOpen(true)} disabled={!fromWarehouseId} className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">Skano kodin</button>
              </div>
            </div>
            <label className="mt-4 block"><span className="sr-only">Kerko produkt, numer, SKU ose barcode</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setResults([]); setHasMore(false); }} placeholder="Kerko emer, brand, numer, SKU ose barcode..." className="w-full rounded-xl border border-slate-200 bg-[#fbfcfb] px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
            {filtersOpen ? <div id="transfer-filters" className="mt-3 rounded-2xl border border-emerald-100 bg-[#f7faf7] p-4">
              <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-900">Filtro variantet</p><span className="text-[11px] text-slate-500">Vetem me stok ne {fromName}</span></div>
              {!filterOptions && filterLoading ? <p className="mt-3 text-xs text-slate-500">Duke ngarkuar opsionet...</p> : null}
              {!filterOptions && filterError ? <p role="alert" className="mt-3 text-xs text-rose-700">{filterError}</p> : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">Kategoria
                  <select value={draftFilters.category} onChange={(event) => setDraftFilters({ category: event.target.value, brand: "", model: "", color: "" })} disabled={!categoryOptions} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 disabled:opacity-60"><option value="">Te gjitha kategorite</option>{categoryOptions?.categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                </label>
                <label className="text-xs font-semibold text-slate-700">Brandi
                  <select value={draftFilters.brand} onChange={(event) => setDraftFilters((current) => ({ ...current, brand: event.target.value, model: "", color: "" }))} disabled={!brandOptions} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 disabled:opacity-60"><option value="">Te gjitha brandet</option>{brandOptions?.brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select>
                </label>
                <label className="text-xs font-semibold text-slate-700">Modeli / emri
                  <select value={draftFilters.model} onChange={(event) => setDraftFilters((current) => ({ ...current, model: event.target.value, color: "" }))} disabled={!draftFilters.brand || !filterOptions} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 disabled:opacity-60"><option value="">{draftFilters.brand ? "Te gjitha modelet" : "Zgjidh brandin fillimisht"}</option>{filterOptions?.models.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}</select>
                </label>
                <label className="text-xs font-semibold text-slate-700">Ngjyra
                  <select value={draftFilters.color} onChange={(event) => setDraftFilters((current) => ({ ...current, color: event.target.value }))} disabled={!draftFilters.model || !filterOptions} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 disabled:opacity-60"><option value="">{draftFilters.model ? "Te gjitha ngjyrat" : "Zgjidh modelin fillimisht"}</option>{colorOptions.map((color) => <option key={color} value={color}>{color}</option>)}</select>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setDraftFilters(emptyFilters); setAppliedFilters(emptyFilters); setResults([]); setHasMore(false); }} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white">Pastro filtrat</button><button type="button" onClick={() => { setAppliedFilters({ ...draftFilters, model: draftFilters.model.trim() }); setResults([]); setHasMore(false); setFiltersOpen(false); }} className="rounded-xl bg-emerald-900 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">Apliko filtrat</button></div>
            </div> : null}
            <div className="mt-3 flex min-h-5 items-center justify-between gap-2 text-xs text-slate-500"><span>{searchActive ? (searchLoading ? "Duke kerkuar..." : `${results.length} variante me stok${hasMore ? " (kerko per me shume)" : ""}`) : "Kerko, skano ose apliko filtrat"}</span><span className="shrink-0">{fromName}</span></div>
            {scannerMessage ? <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{scannerMessage}</p> : null}
            {searchActive && !searchLoading && loadError ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{loadError}</p> : null}
            <div className="mt-3 space-y-2.5" aria-live="polite">
              {!searchActive ? <div className="rounded-2xl border border-dashed border-emerald-100 bg-[#fbfdfb] px-5 py-12 text-center"><p className="text-sm font-semibold text-slate-800">Gjej variantin qe deshiron te transferosh</p><p className="mt-1 text-xs text-slate-500">Shkruaj ne kerkim, skano kodin ose perdor filtrat.</p></div> : null}
              {searchActive && !searchLoading && results.length === 0 && !loadError ? <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">Nuk u gjet asnje variant me stok per kete kerkim.</div> : null}
              {searchActive && !searchLoading && results.map((variant) => {
                const draft = draftQuantities[variant.id] ?? 1;
                const inCart = cart[variant.id]?.quantity ?? 0;
                return <article key={variant.id} className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-emerald-300 sm:p-4">
                  <div className="flex min-w-0 items-start gap-3"><VariantImage variant={variant} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-950" title={variant.productName}>{variant.productName}</p><p className="mt-0.5 truncate text-xs text-slate-500">{variant.brand ? `${variant.brand} / ` : ""}{variant.color} / {variant.size}</p><p className="mt-1 text-[11px] font-semibold text-emerald-800">Ne dispozicion: {variant.stock}</p></div>{inCart > 0 ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">{inCart} ne transfer</span> : null}</div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pl-0 sm:pl-[60px]"><div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50"><button type="button" aria-label={`Zbrit sasine per ${variant.productName}, ${variant.size}`} onClick={() => setDraftQuantity(variant, draft - 1)} className="h-8 w-9 text-slate-700 hover:text-emerald-800">-</button><span className="w-8 text-center text-sm tabular-nums">{draft}</span><button type="button" aria-label={`Shto sasine per ${variant.productName}, ${variant.size}`} onClick={() => setDraftQuantity(variant, draft + 1)} className="h-8 w-9 text-slate-700 hover:text-emerald-800">+</button></div><button type="button" onClick={() => addToCart(variant)} disabled={inCart >= variant.stock || (cartItems.length >= 100 && !inCart)} className="rounded-full border border-emerald-800 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400">{inCart >= variant.stock ? "Stoku u zgjodh" : "Shto ne transfer"}</button></div>
                </article>;
              })}
            </div>
          </section>

          <aside aria-labelledby="transfer-summary-heading" className="min-w-0 lg:border-l lg:border-slate-100 lg:pl-8">
            <div className="flex items-center justify-between gap-3"><h2 id="transfer-summary-heading" className="text-lg font-bold">Permbledhja</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{cartItems.length} variante</span></div>
            <p className="mt-1 text-xs text-slate-500">{fromName} &rarr; {toName}</p>
            {cartItems.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center border-b border-slate-100 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-800">+</div><p className="mt-3 text-sm font-bold">Transferi eshte bosh</p><p className="mt-1 text-xs text-slate-500">Shto variante nga lista per ta pergatitur.</p></div> : <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">{cartItems.map(({ variant, quantity }) => <div key={variant.id} className="rounded-xl border border-slate-200 bg-[#fbfcfb] p-3"><div className="flex items-start gap-3"><VariantImage variant={variant} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{variant.productName}</p><p className="text-xs text-slate-500">{variant.color} / {variant.size}</p><p className="mt-1 text-[11px] text-slate-500">Stok burim: {variant.stock}</p></div><button type="button" aria-label={`Hiq ${variant.productName}, ${variant.size} nga transferi`} onClick={() => updateCartQuantity(variant.id, 0)} className="text-xs font-bold text-slate-500 hover:text-rose-600">Hiq</button></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">Sasia</span><div className="inline-flex items-center rounded-full border border-slate-200 bg-white"><button type="button" aria-label={`Zbrit ${variant.productName}, ${variant.size}`} onClick={() => updateCartQuantity(variant.id, quantity - 1)} className="h-8 w-9">-</button><span className="w-8 text-center text-sm font-bold tabular-nums">{quantity}</span><button type="button" aria-label={`Shto ${variant.productName}, ${variant.size}`} onClick={() => updateCartQuantity(variant.id, quantity + 1)} className="h-8 w-9">+</button></div></div></div>)}</div>}
            <div className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-center justify-between text-sm text-slate-600"><span>Njesi gjithsej</span><strong className="text-2xl tabular-nums text-slate-950">{totalUnits}</strong></div><button type="button" disabled={!canReview} onClick={() => reviewRef.current?.showModal()} className="mt-4 w-full rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">Kontrollo transferin <span aria-hidden="true">&rarr;</span></button><p className="mt-3 text-center text-[11px] text-slate-500">Stoku ndryshon vetem pasi ta konfirmosh.</p></div>
          </aside>
        </div>
      </div>

      <dialog ref={reviewRef} className="m-auto w-[min(94vw,620px)] max-h-[90dvh] overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-0 text-slate-950 shadow-[0_28px_90px_rgba(4,30,22,0.3)] backdrop:bg-slate-950/55" onClick={(event) => { if (event.target === event.currentTarget) reviewRef.current?.close(); }}>
        <div className="p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Hapi i fundit</p><h2 className="mt-2 text-2xl font-bold">Kontrollo transferin</h2><p className="mt-2 text-sm text-slate-600">{fromName} &rarr; {toName}</p></div><button type="button" onClick={() => reviewRef.current?.close()} aria-label="Mbyll" className="h-9 w-9 rounded-full border border-slate-200 text-lg">&times;</button></div><div className="mt-6 max-h-[45dvh] space-y-2 overflow-y-auto">{cartItems.map(({ variant, quantity }) => <div key={variant.id} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 text-sm"><div className="min-w-0"><p className="truncate font-semibold">{variant.productName}</p><p className="text-xs text-slate-500">{variant.color} / {variant.size}</p></div><strong className="shrink-0 tabular-nums">{quantity} cope</strong></div>)}</div><div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-sm"><span>Gjithsej</span><strong className="text-xl tabular-nums">{totalUnits} cope</strong></div><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => reviewRef.current?.close()} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold">Kthehu</button><SubmitTransferButton /></div></div>
      </dialog>

      <BarcodeScanDialog open={scannerOpen} title="Skano per transfer stoku" description="Varianti me stok ne depon burim shtohet ne transfer me sasi 1." onClose={() => setScannerOpen(false)} onDetected={(code) => { void handleScanDetected(code); }} />
    </form>
  );
}
