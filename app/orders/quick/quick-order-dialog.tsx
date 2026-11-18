"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UploadedImage } from "@/app/components/uploaded-image";
import { createQuickOrders } from "./create-quick-orders";

type Warehouse = { id: number; name: string };
type Product = { id: number; name: string; brand: string; category: string; imagePath: string | null; warehouseIds: number[] };
type Variant = { id: number; productId: number; size: string; color: string; imagePath: string | null; stock: number; price: number };
type Catalog = { warehouses: Warehouse[]; products: Product[] };
type OrderRow = { variant: Variant; product: Product; quantity: number; unitPrice: number };
type OrderSource = "INSTAGRAM" | "STORE" | "WHOLESALE";

const inputClass = "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} className="min-h-11 rounded-xl bg-[#093a2d] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Duke ruajtur..." : "Krijo porosine"}</button>;
}

export function QuickOrderDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const variantRequestId = useRef(0);
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warehouseId, setWarehouseId] = useState(0);
  const [source, setSource] = useState<OrderSource>("INSTAGRAM");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [color, setColor] = useState("");
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [showCustomer, setShowCustomer] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!open && dialogRef.current?.open) dialogRef.current.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/orders/quick/catalog", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Katalogu nuk u ngarkua.");
        return response.json() as Promise<Catalog>;
      })
      .then((data) => {
        setCatalog(data);
        setWarehouseId((current) => data.warehouses.some((item) => item.id === current) ? current : data.warehouses[0]?.id ?? 0);
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Katalogu nuk u ngarkua."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open]);

  const warehouseProducts = useMemo(() => catalog?.products.filter((item) => item.warehouseIds.includes(warehouseId)) ?? [], [catalog, warehouseId]);
  const categories = useMemo(() => [...new Set(warehouseProducts.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "sq")), [warehouseProducts]);
  const categoryProducts = useMemo(() => warehouseProducts.filter((item) => item.category === category), [warehouseProducts, category]);
  const brands = useMemo(() => [...new Set(categoryProducts.map((item) => item.brand || "Pa brand"))].sort((a, b) => a.localeCompare(b, "sq")), [categoryProducts]);
  const visibleProducts = useMemo(() => categoryProducts.filter((item) => (item.brand || "Pa brand") === brand), [categoryProducts, brand]);
  const colors = useMemo(() => {
    const groups = new Map<string, { name: string; imagePath: string | null; stock: number }>();
    for (const variant of variants) {
      const key = variant.color.trim().toLocaleLowerCase();
      const previous = groups.get(key);
      groups.set(key, { name: variant.color, imagePath: previous?.imagePath ?? variant.imagePath, stock: (previous?.stock ?? 0) + variant.stock });
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "sq"));
  }, [variants]);
  const selectedSizes = useMemo(() => variants.filter((item) => item.color.trim().toLocaleLowerCase() === color.trim().toLocaleLowerCase()).sort((a, b) => a.size.localeCompare(b.size, "sq", { numeric: true })), [variants, color]);
  const total = rows.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);

  function resetSelection() {
    variantRequestId.current += 1;
    setCategory(""); setBrand(""); setProduct(null); setVariants([]); setVariantsLoading(false); setColor(""); setRows([]); setError("");
  }

  async function chooseProduct(nextProduct: Product) {
    const requestId = ++variantRequestId.current;
    setProduct(nextProduct);
    setColor("");
    setVariants([]);
    setVariantsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/products/${nextProduct.id}/variants?warehouseId=${warehouseId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Variantet nuk u ngarkuan.");
      const data = await response.json() as Variant[];
      if (requestId === variantRequestId.current) setVariants(data.filter((item) => item.stock > 0));
    } catch (cause) {
      if (requestId === variantRequestId.current) setError(cause instanceof Error ? cause.message : "Variantet nuk u ngarkuan.");
    } finally {
      if (requestId === variantRequestId.current) setVariantsLoading(false);
    }
  }

  function addVariant(variant: Variant) {
    if (!product) return;
    const existing = rows.find((row) => row.variant.id === variant.id);
    if (existing && existing.quantity >= variant.stock) {
      setError("Nuk ka stok te mjaftueshem per kete numer.");
      return;
    }
    setRows((current) => existing
      ? current.map((row) => row.variant.id === variant.id ? { ...row, quantity: row.quantity + 1 } : row)
      : [...current, { variant, product, quantity: 1, unitPrice: variant.price }]);
    setError("");
  }

  function changeQuantity(variantId: number, delta: number) {
    setRows((current) => current.map((row) => row.variant.id === variantId
      ? { ...row, quantity: Math.min(row.variant.stock, Math.max(1, row.quantity + delta)) }
      : row));
  }

  return <>
    <button type="button" onClick={() => { resetSelection(); setSource("INSTAGRAM"); setShowCustomer(false); setCustomerName(""); setPhone(""); setInstagram(""); setOpen(true); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#093a2d] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(9,58,45,0.16)] transition hover:bg-emerald-800"><span aria-hidden="true" className="text-lg leading-none">+</span>Shto porosi</button>
    <dialog ref={dialogRef} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === dialogRef.current) setOpen(false); }} aria-labelledby="quick-order-title" className="m-auto w-[min(96vw,1120px)] max-h-[94dvh] overflow-hidden rounded-[26px] border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55">
      <form action={createQuickOrders} className="flex max-h-[94dvh] flex-col">
        <input type="hidden" name="quickModal" value="1" />
        <input type="hidden" name="warehouseId" value={warehouseId} />
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="rows" value={JSON.stringify(rows.map((row) => ({ variantId: row.variant.id, quantity: row.quantity, unitPrice: row.unitPrice })))} />
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">StockBase / Porosite</p><h2 id="quick-order-title" className="mt-1 text-xl font-bold sm:text-2xl">Porosi e shpejte</h2></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Mbyll" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xl text-slate-600">×</button>
        </header>
        <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden">
          <div className="min-w-0 space-y-4 px-4 py-4 lg:overflow-y-auto sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-slate-600">Depoja<select className={inputClass} value={warehouseId} disabled={loading} onChange={(event) => { setWarehouseId(Number(event.target.value)); resetSelection(); }}>{catalog?.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-slate-600">Burimi<select className={inputClass} value={source} onChange={(event) => setSource(event.target.value as OrderSource)}><option value="INSTAGRAM">Instagram</option><option value="STORE">Shitore</option><option value="WHOLESALE">Shumice</option></select></label>
              <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-slate-600">Kategoria<select className={inputClass} value={category} disabled={!warehouseId || loading} onChange={(event) => { variantRequestId.current += 1; setCategory(event.target.value); setBrand(""); setProduct(null); setVariants([]); setColor(""); setVariantsLoading(false); }}><option value="">Zgjidh kategorine</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-slate-600">Brandi<select className={inputClass} value={brand} disabled={!category} onChange={(event) => { variantRequestId.current += 1; setBrand(event.target.value); setProduct(null); setVariants([]); setColor(""); setVariantsLoading(false); }}><option value="">Zgjidh brandin</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
            {loading ? <p className="py-6 text-sm text-slate-500">Duke ngarkuar katalogun...</p> : null}
            {brand ? <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Modelet</h3><span className="text-xs text-slate-500">{visibleProducts.length} modele</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">{visibleProducts.map((item) => <button type="button" key={item.id} onClick={() => void chooseProduct(item)} className={`overflow-hidden rounded-xl border text-left transition hover:border-emerald-400 ${product?.id === item.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white"}`}><div className="aspect-[4/3] bg-slate-50">{item.imagePath ? <UploadedImage src={item.imagePath} alt={item.name} className="h-full w-full object-contain" /> : <span className="flex h-full items-center justify-center text-xs text-slate-400">Pa foto</span>}</div><div className="p-2.5"><p className="line-clamp-2 text-sm font-semibold">{item.name}</p><p className="mt-1 truncate text-xs text-slate-500">{item.brand || "Pa brand"}</p></div></button>)}</div></section> : null}
            {product ? <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4"><h3 className="text-sm font-bold">{product.name} <span className="font-normal text-slate-500">/ Zgjidh ngjyren</span></h3>{variantsLoading ? <p className="py-5 text-sm text-slate-500">Duke ngarkuar ngjyrat...</p> : colors.length === 0 ? <p className="py-5 text-sm text-slate-500">Nuk ka variante me stok ne kete depo.</p> : <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{colors.map((item) => <button type="button" key={item.name} onClick={() => setColor(item.name)} className={`flex min-w-28 max-w-40 shrink-0 items-center gap-2 rounded-xl border p-2 text-left text-xs ${color === item.name ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white"}`}><span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">{item.imagePath ? <UploadedImage src={item.imagePath} alt={item.name} className="h-full w-full object-cover" /> : null}</span><span className="min-w-0"><span className="block truncate font-semibold">{item.name}</span><span className="text-slate-500">{item.stock} ne stok</span></span></button>)}</div>}{color ? <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">Numrat / madhesite</p><div className="flex flex-wrap gap-2">{selectedSizes.map((item) => { const selected = rows.find((row) => row.variant.id === item.id)?.quantity ?? 0; return <button type="button" key={item.id} disabled={selected >= item.stock} onClick={() => addVariant(item)} className="min-w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-emerald-400 disabled:opacity-50"><span className="block font-bold">{item.size}</span><span className="text-xs text-slate-500">{item.stock - selected} lire</span></button>; })}</div></div> : null}</section> : null}
            {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          </div>
          <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-[#f7faf8] lg:border-l lg:border-t-0 lg:overflow-y-auto"><div className="space-y-4 p-4 sm:p-5"><div className="flex items-center justify-between"><h3 className="text-base font-bold">Porosia</h3><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">{totalQuantity} cope</span></div>{rows.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-sm text-slate-500">Zgjidh modelin, ngjyren dhe numrin.</p> : <div className="space-y-2">{rows.map((row) => <div key={row.variant.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{row.product.name}</p><p className="text-xs text-slate-500">{row.variant.color} / {row.variant.size}</p></div><button type="button" onClick={() => setRows((current) => current.filter((item) => item.variant.id !== row.variant.id))} aria-label="Hiq variantin" className="text-lg text-rose-500">×</button></div><div className="mt-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><button type="button" onClick={() => changeQuantity(row.variant.id, -1)} className="h-7 w-7 rounded-full border border-slate-200">−</button><span className="min-w-4 text-center text-sm font-semibold">{row.quantity}</span><button type="button" onClick={() => changeQuantity(row.variant.id, 1)} disabled={row.quantity >= row.variant.stock} className="h-7 w-7 rounded-full border border-slate-200 disabled:opacity-40">+</button></div><span className="text-sm font-semibold">{(row.quantity * row.unitPrice).toFixed(2)} €</span></div></div>)}</div>}
            <button type="button" onClick={() => setShowCustomer((current) => !current)} aria-expanded={showCustomer} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-semibold"><span>Te dhenat e klientit <span className="font-normal text-slate-500">(opsionale)</span></span><span aria-hidden="true">{showCustomer ? "−" : "+"}</span></button>
            {showCustomer ? <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3"><label className="block text-xs font-semibold text-slate-600">Emri<input name="customerName" value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={200} className={`${inputClass} mt-1`} /></label><label className="block text-xs font-semibold text-slate-600">Telefoni<input name="phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={60} className={`${inputClass} mt-1`} /></label><label className="block text-xs font-semibold text-slate-600">Instagram<input name="instagram" value={instagram} onChange={(event) => setInstagram(event.target.value)} maxLength={100} className={`${inputClass} mt-1`} /></label></div> : null}
          </div></aside>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6"><div><p className="text-xs text-slate-500">Totali i porosise</p><p className="text-lg font-bold">{total.toFixed(2)} €</p></div><div className="flex gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 text-sm font-semibold">Anulo</button><SubmitButton disabled={!warehouseId || rows.length === 0 || loading} /></div></footer>
      </form>
    </dialog>
  </>;
}
