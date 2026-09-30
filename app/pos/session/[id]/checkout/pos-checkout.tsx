"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarcodeScanDialog } from "@/app/components/barcode-scan-dialog";
import { UploadedImage } from "@/app/components/uploaded-image";

type Variant = {
  id: number;
  size: string;
  color: string;
  barcode: string | null;
  sku: string | null;
  imagePath: string | null;
  price: number;
  stock: number;
};

type Product = {
  id: number;
  name: string;
  brand: string;
  category: string;
  variants: Variant[];
};

type CatalogCacheEntry = { products: Product[]; fetchedAt: number };
const CATALOG_CACHE_MS = 15_000;

type CartItem = Variant & {
  name: string;
  brand: string;
  quantity: number;
  unitPrice: string;
};

type DiscountType = "PERCENT" | "FIXED";

type PosCheckoutProps = {
  sessionId: number;
  registerName: string;
  warehouseName: string;
  openedByName: string;
  categories: Array<{ id: number; name: string }>;
  brands: string[];
};

function money(value: number) {
  return `${value.toFixed(2)} EUR`;
}

function productImage(product: Product) {
  return product.variants.find((variant) => variant.stock > 0 && variant.imagePath)?.imagePath
    ?? product.variants.find((variant) => variant.imagePath)?.imagePath
    ?? null;
}

function groupColors(variants: Variant[]) {
  const colors = new Map<string, { color: string; imagePath: string | null; variants: Variant[]; stock: number }>();
  for (const variant of variants) {
    const color = variant.color.trim() || "Pa ngjyre";
    const key = color.toLowerCase();
    const group = colors.get(key);
    if (group) {
      group.variants.push(variant);
      group.stock += variant.stock;
      if (!group.imagePath && variant.imagePath) group.imagePath = variant.imagePath;
    } else {
      colors.set(key, { color, imagePath: variant.imagePath, variants: [variant], stock: variant.stock });
    }
  }
  return [...colors.values()].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.color.localeCompare(b.color));
}

export function PosCheckout({
  sessionId,
  registerName,
  warehouseName,
  openedByName,
  categories,
  brands,
}: PosCheckoutProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const catalogCacheRef = useRef(new Map<string, CatalogCacheEntry>());
  const catalogRequestsRef = useRef(new Map<string, Promise<Product[]>>());
  const catalogGenerationRef = useRef(0);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD">("CASH");
  const [receivedCash, setReceivedCash] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [lastCompletedOrderId, setLastCompletedOrderId] = useState<number | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("PERCENT");
  const [discountValue, setDiscountValue] = useState("");

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const selectedColorGroups = useMemo(() => groupColors(selectedProduct?.variants ?? []), [selectedProduct]);
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * item.quantity, 0),
    [cart],
  );
  const totalUnits = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const discountNumeric = Number(discountValue.replace(",", "."));
  const appliedDiscount = Number.isFinite(discountNumeric) && discountNumeric > 0
    ? Math.min(total, discountType === "PERCENT" ? total * Math.min(discountNumeric, 100) / 100 : discountNumeric)
    : 0;
  const payableTotal = Math.max(0, Number((total - appliedDiscount).toFixed(2)));
  const cashValue = Number(receivedCash.replace(",", "."));
  const change = Number.isFinite(cashValue) ? Math.max(0, cashValue - payableTotal) : 0;

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (paymentMethod !== "CASH") return;
    setReceivedCash(payableTotal.toFixed(2));
  }, [paymentMethod, payableTotal]);

  const fetchCatalog = useCallback((params: URLSearchParams) => {
    const key = params.toString();
    const pending = catalogRequestsRef.current.get(key);
    if (pending) return pending;

    const generation = catalogGenerationRef.current;
    const request = fetch(`/api/pos/sessions/${sessionId}/products?${key}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Nuk u ngarkuan produktet.");
        const payload = await response.json() as { products?: Product[] };
        const nextProducts = payload.products ?? [];
        if (catalogGenerationRef.current === generation && !params.has("q")) {
          catalogCacheRef.current.set(key, { products: nextProducts, fetchedAt: Date.now() });
          if (catalogCacheRef.current.size > 24) {
            const oldestKey = catalogCacheRef.current.keys().next().value;
            if (oldestKey !== undefined) catalogCacheRef.current.delete(oldestKey);
          }
        }
        return nextProducts;
      });
    catalogRequestsRef.current.set(key, request);
    void request.finally(() => {
      if (catalogRequestsRef.current.get(key) === request) catalogRequestsRef.current.delete(key);
    }).catch(() => {});
    return request;
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (brand) params.set("brand", brand);
      const cached = catalogCacheRef.current.get(params.toString());
      if (cached) {
        setProducts(cached.products);
        setIsLoadingProducts(false);
        if (Date.now() - cached.fetchedAt < CATALOG_CACHE_MS) return;
      } else {
        setIsLoadingProducts(true);
      }
      try {
        const nextProducts = await fetchCatalog(params);
        if (active) setProducts(nextProducts);
      } catch {
        if (active) setMessage({ tone: "error", text: "Nuk u ngarkuan produktet." });
      } finally {
        if (active) setIsLoadingProducts(false);
      }
    }, search ? 180 : 0);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [brand, categoryId, search, fetchCatalog, catalogRevision]);

  useEffect(() => {
    if (search.trim() || isLoadingProducts) return;
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      const warmBrands = brands.filter((item) => item !== brand).slice(0, 8);
      for (let index = 0; index < warmBrands.length && !cancelled; index += 2) {
        await Promise.all(warmBrands.slice(index, index + 2).map(async (item) => {
          const params = new URLSearchParams();
          if (categoryId) params.set("categoryId", categoryId);
          params.set("brand", item);
          const cached = catalogCacheRef.current.get(params.toString());
          if (cached && Date.now() - cached.fetchedAt < CATALOG_CACHE_MS) return;
          try { await fetchCatalog(params); } catch { /* The selected filter will report errors. */ }
        }));
      }
    }, 600);
    return () => { cancelled = true; window.clearTimeout(timeoutId); };
  }, [brand, brands, categoryId, fetchCatalog, isLoadingProducts, search]);

  const prefetchBrand = useCallback((nextBrand: string) => {
    if (search.trim()) return;
    const params = new URLSearchParams();
    if (categoryId) params.set("categoryId", categoryId);
    params.set("brand", nextBrand);
    const cached = catalogCacheRef.current.get(params.toString());
    if (cached && Date.now() - cached.fetchedAt < CATALOG_CACHE_MS) return;
    void fetchCatalog(params).catch(() => {});
  }, [categoryId, fetchCatalog, search]);

  const addVariant = useCallback((product: Pick<Product, "name" | "brand">, variant: Variant) => {
    if (variant.stock <= 0) {
      setMessage({ tone: "error", text: "Ky produkt nuk ka stok ne kete lokacion." });
      return;
    }
    const existing = cart.find((item) => item.id === variant.id);
    if (existing && existing.quantity >= variant.stock) {
      setMessage({ tone: "error", text: "Nuk mund te shtosh me shume se stoku aktual." });
      return;
    }
    setCart((current) => {
      const currentItem = current.find((item) => item.id === variant.id);
      if (!currentItem) {
        return [
          ...current,
          {
            ...variant,
            name: product.name,
            brand: product.brand,
            quantity: 1,
            unitPrice: variant.price.toFixed(2),
          },
        ];
      }
      return current.map((item) => item.id === variant.id ? { ...item, quantity: item.quantity + 1 } : item);
    });
    setMessage(null);
  }, [cart]);

  const lookupBarcode = useCallback(async (value: string) => {
    const code = value.trim().toUpperCase();
    if (!code || isLookingUp) return;
    setIsLookingUp(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/pos/sessions/${sessionId}/lookup?code=${encodeURIComponent(code)}`);
      const payload = (await response.json()) as { error?: string; variant?: Variant & { name: string; brand: string } };
      if (!response.ok || !payload.variant) {
        setMessage({ tone: "error", text: payload.error ?? "Produkti nuk u gjet." });
        return;
      }
      addVariant({ name: payload.variant.name, brand: payload.variant.brand }, payload.variant);
      setSearch("");
    } catch {
      setMessage({ tone: "error", text: "Lookup deshtoi. Provo perseri." });
    } finally {
      setIsLookingUp(false);
      window.setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [addVariant, isLookingUp, sessionId]);

  function updateQuantity(id: number, nextQuantity: number) {
    const item = cart.find((candidate) => candidate.id === id);
    if (item && nextQuantity > item.stock) {
      setMessage({ tone: "error", text: "Sasia kalon stokun e disponueshem." });
      return;
    }
    setCart((current) => current.flatMap((item) => item.id !== id ? [item] : nextQuantity <= 0 ? [] : [{ ...item, quantity: nextQuantity }]));
  }

  function updateUnitPrice(id: number, value: string) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, unitPrice: value } : item));
  }

  async function submitCheckout() {
    if (cart.length === 0 || isSubmitting) return;
    const appliedCash = receivedCash.trim() ? cashValue : payableTotal;
    if (paymentMethod === "CASH" && (!Number.isFinite(appliedCash) || appliedCash < payableTotal)) {
      setMessage({ tone: "error", text: "Vendos cash-in e pranuar ose shtyp Exact." });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/pos/sessions/${sessionId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            variantId: item.id,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          })),
          paymentMethod,
          receivedCash: paymentMethod === "CASH" ? appliedCash : payableTotal,
          discountType: discountValue ? discountType : null,
          discountValue: discountValue ? discountNumeric : 0,
        }),
      });
      const payload = (await response.json()) as { error?: string; orderId?: number; total?: number };
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Checkout deshtoi." });
        return;
      }
      setCart([]);
      catalogGenerationRef.current += 1;
      catalogCacheRef.current.clear();
      catalogRequestsRef.current.clear();
      setCatalogRevision((current) => current + 1);
      setReceivedCash("0.00");
      setDiscountValue("");
      setDiscountOpen(false);
      setLastCompletedOrderId(payload.orderId ?? null);
      setMessage({ tone: "success", text: `Shitja #${payload.orderId ?? ""} u perfundua: ${money(payload.total ?? payableTotal)}.` });
      router.refresh();
      window.setTimeout(() => searchInputRef.current?.focus(), 80);
    } catch {
      setMessage({ tone: "error", text: "Checkout deshtoi. Provo perseri." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f2f4f0] font-sans text-[#18312d]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0 border-b border-[#dce5dd] lg:border-b-0 lg:border-r">
          <header className="border-b border-[#dce5dd] bg-white px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-[#12342c]">{warehouseName}</h1>
                <p className="mt-0.5 text-xs text-[#61766c]">Hapur nga {openedByName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setScannerOpen(true)} className="inline-flex min-h-10 items-center rounded-xl border border-[#c9ded1] bg-[#edfaf2] px-3 text-sm font-semibold text-[#006e52] transition hover:bg-[#dbf3e4]">Skano kodin</button>
                <button type="button" onClick={() => router.push(`/pos/session/${sessionId}`)} className="inline-flex min-h-10 items-center rounded-xl border border-[#dce5dd] bg-white px-3 text-sm font-semibold text-[#425b51] transition hover:bg-[#f3f6f3]">Sessioni</button>
              </div>
            </div>
            <form className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" onSubmit={(event) => { event.preventDefault(); void lookupBarcode(search); }}>
              <div className="flex min-w-0 w-full max-w-[620px] items-center gap-3 rounded-2xl border border-[#cbdcd0] bg-[#f7faf7] px-4 py-2.5 focus-within:border-[#00a578] focus-within:ring-2 focus-within:ring-[#00a578]/10">
                <span aria-hidden="true" className="text-lg text-[#678176]">⌕</span>
                <input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kerko produkt, model, barcode ose SKU" className="min-w-0 flex-1 bg-transparent text-sm text-[#18312d] outline-none placeholder:text-[#82948a]" />
                {isLookingUp ? <span className="text-xs font-medium text-[#678176]">Duke kerkuar...</span> : null}
              </div>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Filtro kategorine" className="min-h-11 w-full min-w-0 rounded-2xl border border-[#cbdcd0] bg-white px-3 text-sm font-medium text-[#28493d] outline-none focus:border-[#00a578] sm:w-52 sm:shrink-0"><option value="">Te gjitha kategorite</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            </form>
            <div className="mt-3 flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto whitespace-nowrap pb-1 touch-pan-x" aria-label="Filtro sipas brandit">
              <button type="button" onClick={() => setBrand("")} aria-pressed={!brand} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${!brand ? "bg-[#123b31] text-white" : "border border-[#dce5dd] bg-white text-[#526c60] hover:bg-[#f2f7f2]"}`}>Te gjitha</button>
              {brands.map((item) => <button key={item} type="button" onPointerEnter={() => prefetchBrand(item)} onFocus={() => prefetchBrand(item)} onClick={() => setBrand(item)} aria-pressed={brand === item} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${brand === item ? "bg-[#123b31] text-white" : "border border-[#dce5dd] bg-white text-[#526c60] hover:bg-[#f2f7f2]"}`}>{item}</button>)}
            </div>
          </header>

          <div className="p-4 sm:p-6 lg:p-8">
            {message ? <div role="status" className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-medium ${message.tone === "success" ? "border-[#afe2c2] bg-[#eaf9ee] text-[#006d4e]" : "border-rose-200 bg-rose-50 text-rose-800"}`}><div className="flex flex-wrap items-center justify-between gap-3"><span>{message.text}</span>{message.tone === "success" && lastCompletedOrderId ? <a href={`/pos/sales/${lastCompletedOrderId}/receipt`} target="_blank" rel="noreferrer" className="rounded-xl bg-[#123b31] px-3 py-2 text-xs font-bold text-white">Printo faturen</a> : null}</div></div> : null}
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-[#173b30]">Katalogu</h2><p className="mt-0.5 text-xs text-[#73877b]">Prek produktin per te zgjedhur numrin dhe ngjyren</p></div><span className="rounded-full border border-[#d5e5d9] bg-white px-3 py-1 text-xs font-semibold text-[#557466]">{products.length} produkte</span></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {isLoadingProducts ? Array.from({ length: 6 }, (_, index) => <div key={`loading-${index}`} aria-hidden="true" className="overflow-hidden rounded-[20px] border border-[#dce6dc] bg-white"><div className="aspect-[1.22] animate-pulse bg-[#eaf0e9]" /><div className="space-y-2 p-3"><div className="h-3 w-1/3 animate-pulse rounded bg-[#eaf0e9]" /><div className="h-4 w-4/5 animate-pulse rounded bg-[#eaf0e9]" /><div className="h-4 w-1/2 animate-pulse rounded bg-[#eaf0e9]" /></div></div>) : products.length === 0 ? <p className="col-span-full rounded-2xl border border-dashed border-[#c8dcd0] bg-white px-4 py-12 text-center text-sm text-[#71867a]">Nuk u gjet produkt me kete kerkese ne stokun e {warehouseName}.</p> : products.map((product) => {
                const image = productImage(product);
                const availableVariants = product.variants.filter((variant) => variant.stock > 0);
                const minimumPrice = availableVariants.length ? Math.min(...availableVariants.map((variant) => variant.price)) : 0;
                const colorGroups = groupColors(product.variants);
                const selected = selectedProduct?.id === product.id;
                return <button key={product.id} type="button" onClick={() => setSelectedProductId(selected ? null : product.id)} className={`group min-w-0 overflow-hidden rounded-[20px] border bg-white text-left shadow-[0_8px_24px_rgba(25,54,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(25,54,40,0.1)] ${selected ? "border-[#00a578] ring-2 ring-[#00a578]/20" : "border-[#dce6dc] hover:border-[#9bcab2]"}`}>
                  <div className="relative aspect-[1.22] overflow-hidden bg-[linear-gradient(145deg,#f7f9f4_0%,#e9f0e9_100%)]">{image ? <UploadedImage src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-[1.04]" /> : <div className="flex h-full items-center justify-center text-3xl font-bold uppercase tracking-tight text-[#9bb7a6]">{product.name.slice(0, 2)}</div>}<span className="absolute left-2 top-2 max-w-[calc(100%-16px)] truncate rounded-full border border-white/70 bg-white/90 px-2 py-1 text-[10px] font-bold text-[#3d6250] shadow-sm">{product.category}</span></div>
                  <div className="p-3"><p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-[#008368]">{product.brand || "Produkt"}</p><p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-[#17372d]">{product.name}</p>
                    <div className="mt-2 flex min-h-10 items-center gap-1.5 overflow-hidden" aria-label={`${colorGroups.length} ngjyra`}>
                      {colorGroups.slice(0, 4).map((group) => <span key={group.color} title={`${group.color}${group.stock <= 0 ? " - pa stok ne kete depo" : ""}`} className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[#f2f5ef] ${group.stock > 0 ? "border-[#cadbce]" : "border-[#e2e5df] opacity-55"}`}>{group.imagePath ? <UploadedImage src={group.imagePath} alt={group.color} loading="lazy" decoding="async" className="h-full w-full object-contain" /> : <span className="px-1 text-[8px] font-semibold text-[#63786a]">{group.color.slice(0, 3)}</span>}</span>)}
                      {colorGroups.length > 4 ? <span className="text-[10px] font-semibold text-[#61766c]">+{colorGroups.length - 4}</span> : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-1 border-t border-[#e8eee7] pt-2.5"><span className="text-sm font-bold text-[#17372d]">{money(minimumPrice)}</span><span className="rounded-lg bg-[#edf5ed] px-2 py-1 text-[10px] font-semibold text-[#4a7158]">{colorGroups.length} ngjyra</span></div>
                  </div>
                </button>;
              })}
            </div>

          </div>
        </section>

        <aside className="flex min-h-[520px] min-w-0 flex-col bg-white p-4 shadow-[-10px_0_32px_rgba(23,56,42,0.04)] sm:p-6 lg:sticky lg:top-0 lg:h-screen">
          <div className="flex items-start justify-between gap-3 border-b border-[#e4ebe3] pb-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#00866b]">Shporta</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-[#17372d]">Shitja aktuale</h2><p className="mt-1 text-xs text-[#75877b]">{registerName}</p></div><span className="rounded-xl bg-[#e8f6ec] px-3 py-1.5 text-xs font-bold text-[#007e5e]">{totalUnits} artikuj</span></div>
          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-[#cbded1] bg-[#f8fbf8] px-5 text-center">
                <span aria-hidden="true" className="mb-2 text-3xl text-[#b5cabc]">+</span>
                <p className="text-sm font-semibold text-[#3e6653]">Shporta eshte bosh</p>
                <p className="mt-1 text-xs text-[#81968a]">Zgjidh produkt ose skano barcode.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[#e0e9df] bg-[#fafcf9] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#17372d]">{item.name}</p>
                      <p className="mt-0.5 text-xs text-[#648578]">
                        {[item.brand, item.color, item.size].filter(Boolean).join(" - ")}
                      </p>
                    </div>
                    <button type="button" onClick={() => updateQuantity(item.id, 0)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50" aria-label="Largo produktin" title="Largo produktin">
                      x
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <label className="min-w-0">
                      <span className="sr-only">Cmimi i shitjes</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={item.unitPrice}
                        onChange={(event) => updateUnitPrice(item.id, event.target.value)}
                        className="w-24 rounded-lg border border-[#cbded1] bg-white px-2 py-1.5 text-sm font-semibold text-[#17372d] outline-none focus:border-[#00a578]"
                      />
                    </label>
                    <div className="flex overflow-hidden rounded-xl border border-[#cbded1] bg-white">
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-8 w-8 text-[#416452] hover:bg-[#edf6ee]">-</button>
                      <span className="flex h-8 min-w-8 items-center justify-center border-x border-[#cbded1] text-sm font-semibold text-[#17372d]">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-8 w-8 text-[#416452] hover:bg-[#edf6ee]">+</button>
                    </div>
                    <span className="text-xs text-[#82968a]">Stok {item.stock}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 border-t border-[#e4ebe3] pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setDiscountOpen((current) => !current)} className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${appliedDiscount > 0 ? "border-amber-300 bg-amber-50 text-amber-800" : "border-[#dce5dd] bg-white text-[#557164] hover:bg-[#f3f7f3]"}`}>{appliedDiscount > 0 ? `Zbritje -${money(appliedDiscount)}` : "+ Zbritje"}</button>
              {appliedDiscount > 0 ? <button type="button" onClick={() => { setDiscountValue(""); setDiscountOpen(false); }} className="text-xs font-semibold text-rose-600 hover:text-rose-700">Hiq</button> : null}
            </div>
            {discountOpen ? <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"><div className="flex gap-2"><button type="button" onClick={() => setDiscountType("PERCENT")} className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${discountType === "PERCENT" ? "bg-amber-300 text-[#3d3219]" : "border border-amber-200 bg-white text-amber-800"}`}>%</button><button type="button" onClick={() => setDiscountType("FIXED")} className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${discountType === "FIXED" ? "bg-amber-300 text-[#3d3219]" : "border border-amber-200 bg-white text-amber-800"}`}>EUR</button></div><input type="number" min="0" max={discountType === "PERCENT" ? "100" : undefined} step="0.01" inputMode="decimal" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder={discountType === "PERCENT" ? "p.sh. 10" : "p.sh. 5.00"} className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-[#17372d] outline-none focus:border-amber-400" /></div> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaymentMethod("CASH")} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition ${paymentMethod === "CASH" ? "border border-[#0a765b] bg-[#e5f6e9] text-[#006e52]" : "border border-[#dce5dd] bg-white text-[#667d6f]"}`}>Cash</button>
              <button type="button" onClick={() => setPaymentMethod("CARD")} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition ${paymentMethod === "CARD" ? "border border-[#0a765b] bg-[#e5f6e9] text-[#006e52]" : "border border-[#dce5dd] bg-white text-[#667d6f]"}`}>Karta</button>
            </div>
            {paymentMethod === "CASH" ? <div className="mt-3"><div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-[#6d8376]"><label htmlFor="cash-received">Cash i pranuar</label><button type="button" onClick={() => setReceivedCash(payableTotal.toFixed(2))} className="text-[#00866b]">Exact</button></div><input id="cash-received" inputMode="decimal" value={receivedCash} onChange={(event) => setReceivedCash(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#cbded1] bg-white px-3 py-2.5 text-right font-semibold text-[#17372d] outline-none focus:border-[#00a578]" /><div className="mt-1.5 flex justify-between text-xs"><span className="text-[#6d8376]">Kthimi</span><span className="font-bold text-[#00866b]">{money(change)}</span></div></div> : null}
            <div className="mt-4 rounded-2xl bg-[#11392f] p-4 text-white">
              {appliedDiscount > 0 ? <div className="mb-2 flex justify-between text-xs text-[#b7d8c8]"><span>Nentotali</span><span>{money(total)}</span></div> : null}
              {appliedDiscount > 0 ? <div className="mb-2 flex justify-between text-xs text-[#b7d8c8]"><span>Zbritje</span><span>-{money(appliedDiscount)}</span></div> : null}
              <div className="flex items-end justify-between gap-3"><span className="text-sm font-medium text-[#cbe7d8]">Totali</span><strong className="text-2xl font-bold tracking-tight">{money(payableTotal)}</strong></div>
              <button type="button" disabled={!cart.length || isSubmitting} onClick={() => void submitCheckout()} className="mt-4 min-h-12 w-full rounded-xl bg-[#b8f475] px-4 py-3 text-sm font-bold text-[#183c29] transition hover:bg-[#c8ff8c] disabled:cursor-not-allowed disabled:opacity-40">{isSubmitting ? "Duke ruajtur..." : "Perfundo shitjen"}</button>
            </div>
          </div>
        </aside>
      </div>
      {selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={`Zgjidh ngjyren dhe numrin per ${selectedProduct.name}`}>
          <button type="button" onClick={() => setSelectedProductId(null)} className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" aria-label="Mbyll zgjedhjen e numrit" />
          <section className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[26px] border border-[#dce9de] bg-white p-4 shadow-[0_28px_90px_rgba(0,0,0,0.24)] sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-[#e5ede5] pb-4">
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#00866b]">Zgjidh ngjyren dhe numrin</p><h2 className="mt-1 truncate text-xl font-semibold text-[#17372d]">{selectedProduct.name}</h2><p className="mt-1 text-xs text-[#71877a]">Shfaqen te gjitha ngjyrat; shiten vetem ato me stok ne {warehouseName}.</p></div>
              <button type="button" onClick={() => setSelectedProductId(null)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dce9de] text-sm font-semibold text-[#557164] transition hover:bg-[#f3f7f3]" aria-label="Mbyll">x</button>
            </div>
            <div className="mt-4 space-y-3">
              {selectedColorGroups.map((group) => <div key={group.color} className="rounded-2xl border border-[#dce9de] bg-[#fbfdfb] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#edf3ec]">{group.imagePath ? <UploadedImage src={group.imagePath} alt={group.color} loading="lazy" decoding="async" className="h-full w-full object-contain" /> : <span className="px-1 text-center text-xs font-semibold text-[#65806d]">{group.color}</span>}</div>
                  <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[#17372d]">{group.color}</h3><p className={`mt-1 text-xs font-medium ${group.stock > 0 ? "text-[#00866b]" : "text-[#8c9c91]"}`}>{group.stock > 0 ? `${group.stock} cope ne kete depo` : "Pa stok ne kete depo"}</p></div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {group.variants.map((variant) => <button key={variant.id} type="button" disabled={variant.stock <= 0} onClick={() => { addVariant(selectedProduct, variant); setSelectedProductId(null); }} className="min-h-16 rounded-xl border border-[#d2e2d4] bg-white px-2 py-2 text-center transition hover:border-[#00a578] hover:bg-[#ecf8ef] disabled:cursor-not-allowed disabled:border-[#e5ebe5] disabled:bg-[#f5f7f4] disabled:opacity-55"><span className="block text-base font-bold text-[#17372d]">{variant.size || "Standard"}</span><span className="mt-0.5 block text-[10px] font-semibold text-[#00866b]">Stok {variant.stock}</span></button>)}
                </div>
              </div>)}
            </div>
          </section>
        </div>
      ) : null}
      <BarcodeScanDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={(code) => void lookupBarcode(code)} title="Skano per POS" description="Produkti shtohet direkt ne cart-in e kesaj shitjeje." />
    </main>
  );
}
