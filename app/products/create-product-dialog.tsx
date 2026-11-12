"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nextStockSizeRow } from "@/lib/next-stock-size-row";

type CategoryOption = { id: number; name: string; sizeLabel: string; showMaterial: boolean; showPower: boolean };
type WarehouseOption = { id: number; name: string };
type SizeRow = { id: number; size: string; stock: string };

export function CreateProductDialog({ categories, warehouses }: { categories: CategoryOption[]; warehouses: WarehouseOption[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const rowId = useRef(1);
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"product" | "variants" | "done">("product");
  const [savedProductId, setSavedProductId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? 0);
  const [color, setColor] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [material, setMaterial] = useState("");
  const [powerWatts, setPowerWatts] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rows, setRows] = useState<SizeRow[]>([{ id: 1, size: "", stock: "" }]);
  const [createdCount, setCreatedCount] = useState(0);
  const [createdStock, setCreatedStock] = useState(0);
  const [error, setError] = useState("");
  const [existingProductId, setExistingProductId] = useState<number | null>(null);
  const category = categories.find((item) => item.id === categoryId);

  useEffect(() => {
    if (isOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!isOpen && dialogRef.current?.open) dialogRef.current.close();
  }, [isOpen]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  function openDialog() {
    setStep("product");
    setSavedProductId(null);
    setName("");
    setBrand("");
    setCategoryId(categories[0]?.id ?? 0);
    setWarehouseId(warehouses[0]?.id ?? 0);
    setColor("");
    setPrice("");
    setCostPrice("");
    setLocationCode("");
    setMaterial("");
    setPowerWatts("");
    setImage(null);
    setImagePreview(null);
    setRows([{ id: 1, size: "", stock: "" }]);
    rowId.current = 1;
    setCreatedCount(0);
    setCreatedStock(0);
    setError("");
    setExistingProductId(null);
    setIsOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setIsOpen(false);
  }

  function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setExistingProductId(null);
    if (!name.trim() || !categories.some((item) => item.id === categoryId) || !warehouses.some((item) => item.id === warehouseId)) {
      setError("Ploteso emrin, kategorine dhe depon aktive.");
      return;
    }
    setStep("variants");
  }

  function updateRow(id: number, field: "size" | "stock", value: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  async function saveProduct(productOnly: boolean) {
    if (saving) return;
    if (!productOnly) {
    const parsedPrice = Number(price);
    if (!color.trim() || !price.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Ploteso ngjyren dhe cmimin e shitjes.");
      return;
    }
    if (costPrice.trim() && (!Number.isFinite(Number(costPrice)) || Number(costPrice) < 0 || Number(costPrice) > 99999999.99)) {
      setError("Kostoja blerese nuk eshte valide.");
      return;
    }
    if (rows.some((row) => !row.size.trim() || row.stock.trim() === "" || !Number.isSafeInteger(Number(row.stock)) || Number(row.stock) < 0)) {
      setError("Ploteso numrin dhe stokun per secilin rresht.");
      return;
    }
    if (new Set(rows.map((row) => row.size.trim().toLowerCase())).size !== rows.length) {
      setError("I njejti numer eshte shtuar dy here.");
      return;
    }

    }
    setError("");
    setExistingProductId(null);
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("brand", brand.trim());
      formData.set("categoryId", String(categoryId));
      formData.set("warehouseId", String(warehouseId));
      formData.set("productOnly", String(productOnly));
      if (!productOnly) {
        formData.set("color", color.trim());
        formData.set("price", price.trim());
        formData.set("costPrice", costPrice.trim());
        formData.set("locationCode", locationCode.trim());
        if (category?.showMaterial) formData.set("material", material.trim());
        if (category?.showPower) formData.set("powerWatts", powerWatts.trim());
        formData.set("rows", JSON.stringify(rows.map((row) => ({ size: row.size.trim(), stock: Number(row.stock) }))));
        if (image) formData.set("image", image);
      }
      const response = await fetch("/api/products/create-with-variants", { method: "POST", body: formData });
      const result = await response.json().catch(() => null) as { error?: string; existingProductId?: number; productId?: number; variantCount?: number; totalStock?: number } | null;
      if (!response.ok || !result?.productId) {
        setError(result?.error ?? "Produkti nuk u ruajt. Provo perseri.");
        setExistingProductId(result?.existingProductId ?? null);
        return;
      }
      setSavedProductId(result.productId);
      setCreatedCount(result.variantCount ?? 0);
      setCreatedStock(result.totalStock ?? 0);
      setStep("done");
      router.refresh();
    } catch {
      setError("Lidhja u nderpre. Kontrollo listen para se te provosh perseri.");
    } finally {
      setSaving(false);
    }
  }

  function submitVariants(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveProduct(false);
  }

  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

  return (
    <>
      <button type="button" onClick={openDialog} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#093a2d] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(9,58,45,0.14)] transition hover:bg-emerald-800">
        <span aria-hidden="true" className="text-lg leading-none">+</span> Shto produkt
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setIsOpen(false)}
        onCancel={(event) => { if (saving) event.preventDefault(); }}
        className="m-auto w-[min(94vw,680px)] max-h-[90dvh] rounded-[26px] border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/65"
        aria-labelledby="create-product-title"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Produkt i ri · Hapi {step === "product" ? "1/2" : step === "variants" ? "2/2" : "perfundoi"}</p>
            <h2 id="create-product-title" className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{step === "product" ? "Te dhenat e produktit" : step === "variants" ? "Ngjyra, numrat dhe stoku" : "Produkti u shtua"}</h2>
          </div>
          <button type="button" disabled={saving} onClick={closeDialog} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50" aria-label="Mbyll">×</button>
        </div>

        {step === "product" ? (
          <form onSubmit={submitProduct} className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-semibold">Emri / modeli *<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={200} className={inputClass} placeholder="p.sh. Air Max 270" /></label>
              <label className="space-y-1.5 text-sm font-semibold">Brandi<input value={brand} onChange={(event) => setBrand(event.target.value)} maxLength={100} className={inputClass} placeholder="p.sh. Nike" /></label>
              <label className="space-y-1.5 text-sm font-semibold">Kategoria *<select required value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))} className={inputClass}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="space-y-1.5 text-sm font-semibold">Depoja *<select required value={warehouseId} onChange={(event) => setWarehouseId(Number(event.target.value))} className={inputClass}>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            </div>
            {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error} {existingProductId ? <Link href={`/products/${existingProductId}`} className="font-semibold underline">Shiko produktin</Link> : null}</p> : null}
            {categories.length === 0 || warehouses.length === 0 ? <p role="alert" className="text-sm text-amber-700">Duhet te kete kategori dhe depo aktive para se te krijosh produkt.</p> : null}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={closeDialog} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Anulo</button><button disabled={categories.length === 0 || warehouses.length === 0} type="submit" className="rounded-xl bg-[#093a2d] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Vazhdo te variantet</button></div>
          </form>
        ) : null}

        {step === "variants" ? (
          <form onSubmit={submitVariants} className="max-h-[calc(90dvh-84px)] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">Modeli i produktit</p>
              <h3 className="mt-1 break-words text-lg font-bold text-slate-950">{brand ? `${brand} ` : ""}{name.trim()}</h3>
              <p className="mt-1 text-xs text-slate-600">{category?.name} · {warehouses.find((item) => item.id === warehouseId)?.name} · Asgje nuk eshte ruajtur ende</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[170px_minmax(0,1fr)]">
              <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/30 p-3 text-center text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
                {imagePreview ? (
                  <Image src={imagePreview} alt="Foto e ngjyres" width={150} height={116} unoptimized className="h-28 w-full rounded-xl object-contain" />
                ) : (
                  <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-10 w-10 text-emerald-700"><rect x="5" y="8" width="38" height="32" rx="6" stroke="currentColor" strokeWidth="2"/><circle cx="17" cy="19" r="3" stroke="currentColor" strokeWidth="2"/><path d="m9 34 11-10 7 6 5-5 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
                <span>{image ? "Ndrysho foton" : "Ngarko foto"}</span>
                <span className="text-xs font-normal text-slate-500">Opsionale · JPG, PNG, WebP</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && file.size > 8 * 1024 * 1024) {
                    setError("Fotoja duhet te jete deri ne 8 MB.");
                    event.target.value = "";
                    return;
                  }
                  setError("");
                  setImage(file);
                  setImagePreview(file ? URL.createObjectURL(file) : null);
                }} />
              </label>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-semibold">Ngjyra *<input required disabled={saving} value={color} onChange={(event) => setColor(event.target.value)} className={inputClass} placeholder="p.sh. Black/White" /></label>
                <label className="space-y-1.5 text-sm font-semibold">Cmimi i shitjes *<input required disabled={saving} type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} /></label>
                <label className="space-y-1.5 text-sm font-semibold">Kostoja blerese<input disabled={saving} type="number" min="0" step="0.01" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} className={inputClass} placeholder="Opsionale" /></label>
                <label className="space-y-1.5 text-sm font-semibold">Lokacioni<input disabled={saving} value={locationCode} onChange={(event) => setLocationCode(event.target.value)} maxLength={100} className={inputClass} placeholder="p.sh. A-01" /></label>
                {category?.showMaterial ? <label className="space-y-1.5 text-sm font-semibold">Materiali<input disabled={saving} value={material} onChange={(event) => setMaterial(event.target.value)} className={inputClass} /></label> : null}
                {category?.showPower ? <label className="space-y-1.5 text-sm font-semibold">Fuqia<input disabled={saving} value={powerWatts} onChange={(event) => setPowerWatts(event.target.value)} className={inputClass} /></label> : null}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><p className="text-sm font-bold">{category?.sizeLabel || "Numri / madhesia"} dhe stoku</p><button type="button" disabled={saving || rows.length >= 30} onClick={() => setRows((current) => {
                const previous = current[current.length - 1];
                const next = previous ? nextStockSizeRow(previous) : { size: "", stock: "" };
                return [...current, { id: ++rowId.current, ...next }];
              })} className="text-sm font-semibold text-emerald-800">+ Shto numer</button></div>
              {rows.map((row, index) => <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input aria-label={`${category?.sizeLabel || "Numri"} ${index + 1}`} required disabled={saving} value={row.size} onChange={(event) => updateRow(row.id, "size", event.target.value)} className={inputClass} placeholder={category?.sizeLabel || "Numri"} /><input aria-label={`Stoku ${index + 1}`} required disabled={saving} type="number" min="0" step="1" value={row.stock} onChange={(event) => updateRow(row.id, "stock", event.target.value)} className={inputClass} placeholder="Stoku" /><button type="button" disabled={saving || rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="w-9 text-rose-600 disabled:opacity-30" aria-label={`Hiq numrin ${index + 1}`}>×</button></div>)}
            </div>
            {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error} {existingProductId ? <Link href={`/products/${existingProductId}`} className="font-semibold underline">Shiko produktin</Link> : null}</p> : null}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={saving} onClick={() => { setError(""); setStep("product"); }} className="mr-auto rounded-xl px-2 py-2.5 text-sm font-semibold text-emerald-800">← Te produkti</button><button type="button" disabled={saving} onClick={closeDialog} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Anulo</button><button type="button" disabled={saving} onClick={() => void saveProduct(true)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Ruaj vetem produktin</button><button disabled={saving} type="submit" className="rounded-xl bg-[#093a2d] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Duke ruajtur..." : "Ruaj produktin dhe variantet"}</button></div>
          </form>
        ) : null}

        {step === "done" && savedProductId ? <div className="space-y-4 px-5 py-6 text-sm sm:px-6"><p>Produkti u ruajt me {createdCount} variante.</p>{createdStock === 0 ? <p className="text-amber-700">Pa stok, produkti nuk shfaqet te filtri &quot;Vetem ne stok&quot;. Mund ta shohesh te detajet e produktit.</p> : null}<div className="flex flex-wrap gap-2"><button type="button" onClick={closeDialog} className="rounded-xl bg-[#093a2d] px-5 py-2.5 font-semibold text-white">Kthehu te produktet</button><Link href={`/products/${savedProductId}`} className="rounded-xl border border-slate-200 px-5 py-2.5 font-semibold" onClick={() => setIsOpen(false)}>Shiko produktin</Link></div></div> : null}
      </dialog>
    </>
  );
}
