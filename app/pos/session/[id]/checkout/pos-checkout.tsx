"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarcodeScanDialog } from "@/app/components/barcode-scan-dialog";

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
  categories: Array<{ id: number; name: string }>;
  brands: string[];
};

function money(value: number) {
  return `${value.toFixed(2)} EUR`;
}

function productImage(product: Product) {
  return product.variants.find((variant) => variant.imagePath)?.imagePath ?? null;
}

export function PosCheckout({
  sessionId,
  registerName,
  warehouseName,
  categories,
  brands,
}: PosCheckoutProps) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
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

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingProducts(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        if (categoryId) params.set("categoryId", categoryId);
        if (brand) params.set("brand", brand);
        const response = await fetch(`/api/pos/sessions/${sessionId}/products?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as { products?: Product[] };
        if (response.ok) setProducts(payload.products ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setMessage({ tone: "error", text: "Nuk u ngarkuan produktet." });
        }
      } finally {
        if (!controller.signal.aborted) setIsLoadingProducts(false);
      }
    }, search ? 180 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [brand, categoryId, search, sessionId]);

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
    <main className="min-h-screen bg-[#081225] text-slate-100">
      <div className="grid min-h-screen xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 border-b border-white/10 xl:border-b-0 xl:border-r">
          <header className="flex min-h-[76px] items-center gap-3 border-b border-white/10 bg-[#0c1830] px-4 py-3 sm:px-6">
            <button type="button" onClick={() => router.push(`/pos/session/${sessionId}`)} className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 sm:inline-flex">Sessioni</button>
            <form className="flex min-w-0 flex-1 flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); void lookupBarcode(search); }}>
              <div className="flex min-w-[210px] flex-1 items-center gap-3 rounded-2xl border border-slate-600/70 bg-slate-800/80 px-4 py-3 shadow-inner">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-300">Search</span>
                <input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Skano ose kerko produkt, model, barcode / SKU..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400" />
                {isLookingUp ? <span className="text-xs font-medium text-slate-400">Duke kerkuar</span> : null}
              </div>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Filtro kategorine" className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-sm text-slate-200 outline-none focus:border-emerald-400 sm:max-w-44"><option value="">Te gjitha kategorite</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              <select value={brand} onChange={(event) => setBrand(event.target.value)} aria-label="Filtro brandin" className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-sm text-slate-200 outline-none focus:border-emerald-400 sm:max-w-44"><option value="">Te gjitha brandet</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <button type="button" onClick={() => setScannerOpen(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-bold text-emerald-300 transition hover:bg-white/10" aria-label="Hap kameran">Scan</button>
            </form>
          </header>

          <div className="p-4 sm:p-6">
            {message ? <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${message.tone === "success" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-rose-400/30 bg-rose-400/10 text-rose-200"}`}><div className="flex flex-wrap items-center justify-between gap-3"><span>{message.text}</span>{lastCompletedOrderId ? <a href={`/pos/sales/${lastCompletedOrderId}/receipt`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-300">Printo faturen</a> : null}</div></div> : null}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {isLoadingProducts ? <p className="col-span-full py-12 text-center text-sm text-slate-400">Po ngarkohet katalogu...</p> : products.length === 0 ? <p className="col-span-full rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-slate-400">Nuk u gjet produkt me kete kerkese ne stokun e {warehouseName}.</p> : products.map((product) => {
                const image = productImage(product);
                const minimumPrice = Math.min(...product.variants.map((variant) => variant.price));
                const selected = selectedProduct?.id === product.id;
                return <button key={product.id} type="button" onClick={() => setSelectedProductId(selected ? null : product.id)} className={`group overflow-hidden rounded-xl border text-left transition ${selected ? "border-emerald-400 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]" : "border-white/10 bg-[#111e36] hover:-translate-y-0.5 hover:border-slate-500 hover:bg-[#152440]"}`}>
                  <div className="relative aspect-[1.18] bg-[linear-gradient(135deg,#20314c_0%,#101b31_100%)]">{image ? <img src={image} alt="" className="h-full w-full object-cover opacity-90 transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">No image</div>}<span className="absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] truncate rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-emerald-300">{product.category}</span></div>
                  <div className="p-2.5"><p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-300">{product.brand || "Produkt"}</p><p className="mt-1 truncate text-xs font-semibold text-white">{product.name}</p><div className="mt-2 flex items-center justify-between gap-1"><span className="text-xs font-semibold text-emerald-300">{money(minimumPrice)}</span><span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">{product.variants.length}</span></div></div>
                </button>;
              })}
            </div>

          </div>
        </section>

        <aside className="flex min-h-[600px] flex-col bg-[#0b162b] p-4 sm:p-6 xl:sticky xl:top-0 xl:h-screen">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Cart</p><h2 className="mt-1 text-xl font-semibold text-white">Shitja aktuale</h2><p className="mt-1 text-xs text-slate-400">{registerName}</p></div><span className="rounded-xl bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-300">{totalUnits} artikuj</span></div>
          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-white/10 px-5 text-center text-sm text-slate-400">
                Kerko produktin ose skano barcode per ta shtuar ne shitje.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-[#14223b] px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{item.name}</p>
                      <p className="mt-0.5 text-xs text-emerald-300">
                        {[item.brand, item.color, item.size].filter(Boolean).join(" - ")}
                      </p>
                    </div>
                    <button type="button" onClick={() => updateQuantity(item.id, 0)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-300 transition hover:bg-rose-400/10 hover:text-rose-200" aria-label="Largo produktin" title="Largo produktin">
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
                        className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm font-semibold text-white outline-none focus:border-emerald-400"
                      />
                    </label>
                    <div className="flex overflow-hidden rounded-xl border border-white/10">
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-7 w-7 text-slate-300 hover:bg-white/10">-</button>
                      <span className="flex h-7 min-w-7 items-center justify-center border-x border-white/10 text-sm font-semibold">{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-7 w-7 text-slate-300 hover:bg-white/10">+</button>
                    </div>
                    <span className="text-xs text-slate-400">Stok {item.stock}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setDiscountOpen((current) => !current)} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${appliedDiscount > 0 ? "border-amber-300/40 bg-amber-300/10 text-amber-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>{appliedDiscount > 0 ? `Zbritje -${money(appliedDiscount)}` : "Zbritje"}</button>
              {appliedDiscount > 0 ? <button type="button" onClick={() => { setDiscountValue(""); setDiscountOpen(false); }} className="text-xs font-semibold text-rose-300 hover:text-rose-200">Hiq</button> : null}
            </div>
            {discountOpen ? <div className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3"><div className="flex gap-2"><button type="button" onClick={() => setDiscountType("PERCENT")} className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${discountType === "PERCENT" ? "bg-amber-300 text-slate-950" : "border border-white/10 text-slate-300"}`}>%</button><button type="button" onClick={() => setDiscountType("FIXED")} className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${discountType === "FIXED" ? "bg-amber-300 text-slate-950" : "border border-white/10 text-slate-300"}`}>EUR</button></div><input type="number" min="0" max={discountType === "PERCENT" ? "100" : undefined} step="0.01" inputMode="decimal" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder={discountType === "PERCENT" ? "p.sh. 10" : "p.sh. 5.00"} className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-amber-300" /></div> : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaymentMethod("CASH")} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-bold transition ${paymentMethod === "CASH" ? "bg-emerald-400 text-slate-950" : "border border-white/10 bg-white/5 text-slate-300"}`}><span aria-hidden="true">$</span> Cash</button>
              <button type="button" onClick={() => setPaymentMethod("CARD")} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-bold transition ${paymentMethod === "CARD" ? "bg-emerald-400 text-slate-950" : "border border-white/10 bg-white/5 text-slate-300"}`}><span aria-hidden="true">▣</span> Karta</button>
            </div>
            {paymentMethod === "CASH" ? <div className="mt-3"><div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><label htmlFor="cash-received">Cash i pranuar</label><button type="button" onClick={() => setReceivedCash(payableTotal.toFixed(2))} className="text-emerald-300">Exact</button></div><input id="cash-received" inputMode="decimal" value={receivedCash} onChange={(event) => setReceivedCash(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-right font-semibold text-white outline-none focus:border-emerald-400" /><div className="mt-1.5 flex justify-between text-xs"><span className="text-slate-400">Kthimi</span><span className="font-bold text-emerald-300">{money(change)}</span></div></div> : null}
            <div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{appliedDiscount > 0 ? `Nentotali ${money(total)} · Zbritje ${money(appliedDiscount)}` : "Totali"}</p><p className="mt-0.5 text-2xl font-bold tracking-tight text-white">{money(payableTotal)}</p></div><button type="button" disabled={!cart.length || isSubmitting} onClick={() => void submitCheckout()} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_28px_rgba(16,185,129,0.22)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">{isSubmitting ? "Duke ruajtur..." : "Perfundo"}</button></div>
          </div>
        </aside>
      </div>
      {selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={`Zgjidh numrin per ${selectedProduct.name}`}>
          <button type="button" onClick={() => setSelectedProductId(null)} className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" aria-label="Mbyll zgjedhjen e numrit" />
          <section className="relative z-10 w-full max-w-xl rounded-[24px] border border-emerald-400/30 bg-[#10233c] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-5">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Zgjidh numrin</p><h2 className="mt-1 truncate text-lg font-semibold text-white">{selectedProduct.name}</h2></div>
              <button type="button" onClick={() => setSelectedProductId(null)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-sm font-semibold text-slate-300 transition hover:bg-white/10" aria-label="Mbyll">x</button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {selectedProduct.variants.map((variant) => <button key={variant.id} type="button" onClick={() => { addVariant(selectedProduct, variant); setSelectedProductId(null); }} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center transition hover:border-emerald-400 hover:bg-emerald-400/10"><span className="block text-lg font-bold text-white">{variant.size || "-"}</span>{variant.color ? <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400">{variant.color}</span> : null}<span className="mt-1 block text-[10px] font-semibold text-emerald-300">Stok {variant.stock}</span></button>)}
            </div>
          </section>
        </div>
      ) : null}
      <BarcodeScanDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={(code) => void lookupBarcode(code)} title="Skano per POS" description="Produkti shtohet direkt ne cart-in e kesaj shitjeje." />
    </main>
  );
}
