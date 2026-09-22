"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { UploadedImage } from "@/app/components/uploaded-image";

type Analysis = {
  brand: string | null;
  model: string | null;
  category: string | null;
  color: string | null;
  material: string | null;
  attributes: string[];
  confidence: number;
};
type ExistingProduct = {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  color: string | null;
  imagePath: string | null;
  matchedOn: string[];
};
type CandidateVariant = {
  id: number;
  color: string;
  size: string;
  stock: number;
  price: string;
  imagePath: string | null;
};
type CandidateDetails = {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  totalVariants: number;
  variants: CandidateVariant[];
};
type Category = { id: number; name: string; sizeLabel: string; isFootwear: boolean };
type Warehouse = { id: number; name: string };
type ProductDraft = {
  name: string;
  brand: string;
  categoryId: string;
  warehouseId: string;
  color: string;
  costPrice: string;
  price: string;
  material: string;
  attributes: string;
};
type SizeRow = { id: number; size: string; stock: string };

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function matchCategory(suggestion: string | null, categories: Category[]) {
  if (!suggestion) return "";
  const value = normalized(suggestion);
  const exact = categories.find((category) => normalized(category.name) === value);
  if (exact) return String(exact.id);
  const partial = categories.find((category) => value.includes(normalized(category.name)) || normalized(category.name).includes(value));
  if (partial) return String(partial.id);
  const footwear = ["sneaker", "trainer", "patika", "atlete"];
  if (footwear.some((word) => value.includes(word))) {
    const match = categories.find((category) => normalized(category.name).includes("patika"));
    if (match) return String(match.id);
  }
  return "";
}

function groupCandidateVariants(variants: CandidateVariant[]) {
  const groups = new Map<string, { color: string; imagePath: string | null; variants: CandidateVariant[] }>();
  for (const variant of variants) {
    const key = normalized(variant.color);
    const group = groups.get(key);
    if (group) {
      group.imagePath ||= variant.imagePath;
      group.variants.push(variant);
    } else {
      groups.set(key, { color: variant.color, imagePath: variant.imagePath, variants: [variant] });
    }
  }
  return [...groups.values()];
}

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

export function ProductAiAssistant({ categories, warehouses }: { categories: Category[]; warehouses: Warehouse[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const candidateDialogRef = useRef<HTMLDialogElement>(null);
  const candidateAbortRef = useRef<AbortController | null>(null);
  const nextSizeId = useRef(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [existingProducts, setExistingProducts] = useState<ExistingProduct[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ExistingProduct | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<CandidateDetails | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [matchCheckFailed, setMatchCheckFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existingProductId, setExistingProductId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProductDraft>({ name: "", brand: "", categoryId: "", warehouseId: "", color: "", costPrice: "", price: "", material: "", attributes: "" });
  const [sizes, setSizes] = useState<SizeRow[]>([{ id: 0, size: "", stock: "" }]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    setAnalysis(null);
    setExistingProducts([]);
    setMatchCheckFailed(false);
    setError("");
    setExistingProductId(null);
    if (!nextFile) setPreviewUrl("");
  }

  async function analyze() {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Zgjidh foto JPG, PNG ose WebP deri ne 8 MB.");
      return;
    }
    setLoading(true);
    setError("");
    setAnalysis(null);
    setExistingProducts([]);
    setMatchCheckFailed(false);
    try {
      const data = new FormData();
      data.set("image", file);
      const response = await fetch("/api/ai/product-analysis", { method: "POST", body: data });
      const body = await response.json() as { analysis?: Analysis; existingProducts?: ExistingProduct[]; matchCheckFailed?: boolean; error?: string };
      if (!response.ok || !body.analysis) throw new Error(body.error ?? "Analiza deshtoi.");
      setAnalysis(body.analysis);
      setExistingProducts(body.existingProducts ?? []);
      setMatchCheckFailed(Boolean(body.matchCheckFailed));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analiza deshtoi.");
    } finally {
      setLoading(false);
    }
  }

  function continueWithProduct() {
    if (!analysis || !file) return;
    const categoryId = matchCategory(analysis.category, categories);
    const isFootwear = categories.find((category) => String(category.id) === categoryId)?.isFootwear;
    setDraft({
      name: analysis.model ?? "",
      brand: analysis.brand ?? "",
      categoryId,
      warehouseId: warehouses.length === 1 ? String(warehouses[0].id) : "",
      color: analysis.color ?? "",
      costPrice: "",
      price: "",
      material: isFootwear ? "" : analysis.material ?? "",
      attributes: isFootwear ? "" : analysis.attributes.join(", "),
    });
    nextSizeId.current = 1;
    setSizes([{ id: 0, size: "", stock: "" }]);
    setError("");
    dialogRef.current?.showModal();
  }

  async function showCandidate(product: ExistingProduct) {
    candidateAbortRef.current?.abort();
    const controller = new AbortController();
    candidateAbortRef.current = controller;
    setSelectedCandidate(product);
    setCandidateDetails(null);
    setCandidateError("");
    setCandidateLoading(true);
    candidateDialogRef.current?.showModal();
    try {
      const response = await fetch(`/api/ai/product-candidate?id=${product.id}`, { signal: controller.signal });
      const body = await response.json() as { product?: CandidateDetails; error?: string };
      if (!response.ok || !body.product) throw new Error(body.error ?? "Detajet nuk u ngarkuan.");
      setCandidateDetails(body.product);
    } catch (cause) {
      if (!controller.signal.aborted) setCandidateError(cause instanceof Error ? cause.message : "Detajet nuk u ngarkuan.");
    } finally {
      if (!controller.signal.aborted) setCandidateLoading(false);
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setSaving(true);
    setError("");
    setExistingProductId(null);
    try {
      const data = new FormData();
      for (const [key, value] of Object.entries(draft)) data.set(key, value);
      data.set("variants", JSON.stringify(sizes.map(({ size, stock }) => ({ size: size.trim(), stock: stock.trim() }))));
      data.set("image", file);
      const response = await fetch("/api/ai/create-product", { method: "POST", body: data });
      const body = await response.json() as { productId?: number; existingProductId?: number; error?: string };
      if (!response.ok || !body.productId) {
        if (body.existingProductId) setExistingProductId(body.existingProductId);
        throw new Error(body.error ?? "Produkti nuk u ruajt.");
      }
      dialogRef.current?.close();
      router.push(`/products/${body.productId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Produkti nuk u ruajt.");
    } finally {
      setSaving(false);
    }
  }

  function field(key: keyof ProductDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateSize(id: number, key: "size" | "stock", value: string) {
    setSizes((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
  }

  function addSize() {
    if (sizes.length >= 30) return;
    const id = nextSizeId.current;
    nextSizeId.current += 1;
    setSizes((current) => [...current, { id, size: "", stock: "" }]);
  }

  const selectedCategory = categories.find((category) => String(category.id) === draft.categoryId);
  const candidateGroups = candidateDetails ? groupCandidateVariants(candidateDetails.variants) : [];
  const candidateImage = candidateGroups.find((group) => group.imagePath)?.imagePath ?? selectedCandidate?.imagePath;

  return <>
    <section className="mb-5 rounded-[24px] border border-violet-100 bg-violet-50/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">AI Product Assistant</p>
      <p className="mt-2 text-sm text-slate-600">Ngarko foton; AI propozon te dhenat e produktit.</p>
      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-white px-4 py-6 text-center transition hover:border-violet-400 hover:bg-violet-50">
        <span className="text-sm font-semibold text-violet-800">Ngarko foton e produktit</span>
        <span className="mt-1 text-xs text-slate-500">Kliko ketu per te zgjedhur JPG, PNG ose WebP, deri ne 8 MB.</span>
        <span className="mt-3 rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700">Zgjidh foto</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className="sr-only" />
      </label>
      {previewUrl ? <div className="mt-3 flex items-center gap-3"><UploadedImage src={previewUrl} alt="Fotoja e produktit" className="h-20 w-20 rounded-xl border border-violet-100 object-cover" /><p className="min-w-0 truncate text-xs text-slate-600">{file?.name}</p></div> : null}
      <button type="button" disabled={!file || loading} onClick={analyze} className="mt-4 w-full rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">{loading ? "Duke analizuar..." : "Analizo me AI"}</button>
      {analysis ? <div className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-700">
        <p><b>Brand:</b> {analysis.brand ?? "Ploteso vete"}</p>
        <p><b>Model:</b> {analysis.model ?? "Ploteso vete"}</p>
        <p><b>Kategori:</b> {analysis.category ?? "Ploteso vete"}</p>
        <p><b>Ngjyra:</b> {analysis.color ?? "Ploteso vete"}</p>
        <p className="mt-1 text-xs text-slate-500">Besueshmeria: {Math.round(analysis.confidence * 100)}%</p>
        {existingProducts.length > 0 ? <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="font-semibold text-slate-950">A eshte ky produkt tashme ne stok?</p>
          <p className="mt-1 text-xs text-slate-500">Sugjerime sipas brandit/modelit, jo krahasim automatik i fotove. Kontrolloji para se te vendosesh.</p>
          <div className="mt-3 space-y-2">{existingProducts.map((product) => <div key={product.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xs text-slate-400">{product.imagePath ? <UploadedImage src={product.imagePath} alt={product.name} className="h-full w-full object-cover" /> : "Pa foto"}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-950">{product.name}</p>
              <p className="text-xs text-slate-600">{[product.brand, product.category, product.color].filter(Boolean).join(" / ")}</p>
              <p className="mt-0.5 text-xs text-violet-700">Perputhje: {product.matchedOn.join(", ")}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-1 text-xs font-semibold">
              <button type="button" onClick={() => void showCandidate(product)} className="rounded-lg border border-slate-300 px-2 py-1 text-center text-slate-700 hover:bg-slate-50">Shiko</button>
              <Link href={`/products/${product.id}/variants/new`} className="rounded-lg bg-violet-700 px-2 py-1 text-center text-white hover:bg-violet-800">Shto variant</Link>
            </div>
          </div>)}</div>
        </div> : matchCheckFailed ? <p className="mt-4 text-xs text-amber-700">Kontrolli ne stok nuk u krye. Verifiko produktet ekzistuese para krijimit.</p> : analysis.brand || analysis.model ? <p className="mt-4 text-xs text-slate-500">Nuk u gjet kandidat i ngjashem ne stok.</p> : <p className="mt-4 text-xs text-slate-500">Pa brand ose model te lexueshem, nuk mund te kerkohet me besueshmeri ne stok.</p>}
        <button type="button" onClick={continueWithProduct} className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">{existingProducts.length > 0 ? "Nuk eshte ky: krijo produkt te ri" : "Vazhdo me produktin"}</button>
      </div> : null}
      {error && !dialogRef.current?.open ? <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{error}</p> : null}
    </section>

    <dialog ref={candidateDialogRef} aria-labelledby="candidate-dialog-title" onClose={() => { candidateAbortRef.current?.abort(); setSelectedCandidate(null); setCandidateDetails(null); setCandidateError(""); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-0 text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.3)] backdrop:bg-slate-950/55">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Kontrollo produktin ekzistues</p><h2 id="candidate-dialog-title" className="mt-1 text-lg font-semibold">{selectedCandidate?.name ?? "Produkti"}</h2></div>
        <button type="button" aria-label="Mbyll detajet" onClick={() => candidateDialogRef.current?.close()} className="rounded-full border border-slate-200 px-3 py-1.5 text-lg text-slate-500 hover:bg-slate-50">x</button>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        {candidateLoading ? <p className="text-sm text-slate-500">Duke ngarkuar detajet...</p> : null}
        {candidateError ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{candidateError}</p> : null}
        {candidateDetails ? <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><p className="mb-2 text-xs font-semibold text-slate-600">Fotoja qe analizove</p><div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-violet-200 bg-violet-50">{previewUrl ? <UploadedImage src={previewUrl} alt="Fotoja e ngarkuar" className="h-full w-full object-contain" /> : null}</div></div>
            <div><p className="mb-2 text-xs font-semibold text-slate-600">Fotoja ne stok</p><div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">{candidateImage ? <UploadedImage src={candidateImage} alt={candidateDetails.name} className="h-full w-full object-contain" /> : <span className="text-sm text-slate-400">Nuk ka foto</span>}</div></div>
          </div>
          <dl className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Emri / modeli</dt><dd className="mt-1 font-semibold">{candidateDetails.name}</dd></div>
            <div><dt className="text-xs text-slate-500">Brandi</dt><dd className="mt-1 font-semibold">{candidateDetails.brand ?? "Pa brand"}</dd></div>
            <div><dt className="text-xs text-slate-500">Kategoria</dt><dd className="mt-1 font-semibold">{candidateDetails.category}</dd></div>
          </dl>
          <div><h3 className="text-sm font-semibold">Ngjyrat, numrat dhe stoku</h3><div className="mt-3 space-y-3">{candidateGroups.map((group) => <div key={normalized(group.color)} className="rounded-2xl border border-slate-200 p-3">
            <div className="flex items-center gap-3">{group.imagePath ? <UploadedImage src={group.imagePath} alt={`Ngjyra ${group.color}`} className="h-16 w-16 rounded-lg border border-slate-100 object-contain" /> : <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">Pa foto</div>}<div><p className="font-semibold">{group.color}</p><p className="text-xs text-slate-500">{group.variants.length} numra / variante</p></div></div>
            <div className="mt-3 flex flex-wrap gap-2">{group.variants.map((variant) => <div key={variant.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"><b>Nr. {variant.size}</b><span className="ml-2">Stok: {variant.stock}</span><span className="ml-2">Cmim: {variant.price}</span></div>)}</div>
          </div>)}</div>{candidateDetails.totalVariants > candidateDetails.variants.length ? <p className="mt-2 text-xs text-amber-700">Shfaqen {candidateDetails.variants.length} nga {candidateDetails.totalVariants} variante. Hap produktin per listen e plote.</p> : null}{candidateDetails.totalVariants === 0 ? <p className="mt-2 text-sm text-slate-500">Ky produkt nuk ka ende variante.</p> : null}</div>
        </> : null}
      </div>
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
        <button type="button" onClick={() => candidateDialogRef.current?.close()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Nuk eshte i njejti</button>
        {selectedCandidate ? <Link href={`/products/${selectedCandidate.id}/variants/new`} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Eshte i njejti: shto variant</Link> : null}
      </div>
    </dialog>

    <dialog ref={dialogRef} onClose={() => { setError(""); setExistingProductId(null); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-0 text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.3)] backdrop:bg-slate-950/55">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
        <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-700">AI Product Assistant</p><h2 className="mt-1 text-xl font-semibold">Konfirmo produktin dhe numrat</h2><p className="mt-1 text-xs text-slate-500">Korrigjo sugjerimet dhe ploteso stokun per secilin numer.</p></div>
        <button type="button" aria-label="Mbyll" onClick={() => dialogRef.current?.close()} className="rounded-full border border-slate-200 px-3 py-1.5 text-lg text-slate-500 hover:bg-slate-50">x</button>
      </div>
      <form onSubmit={createProduct} className="p-5 sm:p-7">
        <div className="grid gap-6 md:grid-cols-[230px_minmax(0,1fr)]">
          <div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">{previewUrl ? <UploadedImage src={previewUrl} alt="Fotoja qe do te lidhet me variantet" className="aspect-square w-full object-contain" /> : null}</div>
            <p className="mt-2 text-xs text-slate-500">Kjo foto perdoret per te gjithe numrat e kesaj ngjyre.</p>
            <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/50 p-3">
              <p className="text-sm font-semibold text-slate-950">Numrat dhe stoku</p>
              <p className="mt-1 text-xs text-slate-500">{selectedCategory?.sizeLabel ?? "Numri / madhesia"} dhe sasia per secilin.</p>
              <div className="mt-3 space-y-2">{sizes.map((row, index) => <div key={row.id} className="flex items-end gap-1.5">
                <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">Numri {index + 1}<input required value={row.size} onChange={(event) => updateSize(row.id, "size", event.target.value)} placeholder="41" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-950 outline-none focus:border-violet-500" /></label>
                <label className="w-16 shrink-0 text-xs font-medium text-slate-600">Stoku<input required type="number" min="0" step="1" value={row.stock} onChange={(event) => updateSize(row.id, "stock", event.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-950 outline-none focus:border-violet-500" /></label>
                <button type="button" aria-label={`Hiq numrin ${index + 1}`} disabled={sizes.length === 1} onClick={() => setSizes((current) => current.filter((item) => item.id !== row.id))} className="mb-1 rounded-lg px-1 text-lg text-slate-400 hover:text-rose-600 disabled:opacity-30">x</button>
              </div>)}</div>
              <button type="button" onClick={addSize} disabled={sizes.length >= 30} className="mt-3 w-full rounded-lg border border-dashed border-violet-300 py-2 text-xs font-semibold text-violet-700 disabled:opacity-40">+ Shto numer tjeter</button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Emri / modeli<input required value={draft.name} onChange={(event) => field("name", event.target.value)} placeholder="Ploteso modelin nese nuk lexohet" className={inputClass} /></label>
            <label className="text-sm font-medium">Brandi<input value={draft.brand} onChange={(event) => field("brand", event.target.value)} placeholder="p.sh. Nike" className={inputClass} /></label>
            <label className="text-sm font-medium">Kategoria<select required value={draft.categoryId} onChange={(event) => field("categoryId", event.target.value)} className={inputClass}><option value="">Zgjidh kategorine</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="text-sm font-medium">Depoja<select required value={draft.warehouseId} onChange={(event) => field("warehouseId", event.target.value)} className={inputClass}><option value="">Zgjidh depon</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
            <label className="text-sm font-medium">Ngjyra<input required value={draft.color} onChange={(event) => field("color", event.target.value)} placeholder="p.sh. White" className={inputClass} /></label>
            <label className="text-sm font-medium">Kostoja<input required type="number" min="0" step="0.01" value={draft.costPrice} onChange={(event) => field("costPrice", event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-medium">Cmimi i shitjes<input required type="number" min="0" step="0.01" value={draft.price} onChange={(event) => field("price", event.target.value)} className={inputClass} /></label>
            {!selectedCategory?.isFootwear ? <>
              <label className="text-sm font-medium">Materiali<input value={draft.material} onChange={(event) => field("material", event.target.value)} className={inputClass} /></label>
              <label className="text-sm font-medium sm:col-span-2">Atributet<input value={draft.attributes} onChange={(event) => field("attributes", event.target.value)} placeholder="p.sh. low-top, leather" className={inputClass} /></label>
            </> : null}
          </div>
        </div>
        {warehouses.length === 0 ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Nuk ka depo aktive. Krijo nje depo te Settings para se te shtosh stok.</p> : null}
        {error ? <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}{existingProductId ? <Link href={`/products/${existingProductId}/variants/new`} className="mt-2 block font-semibold underline">Hap produktin ekzistues dhe shto variant</Link> : null}</div> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={() => dialogRef.current?.close()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">Anulo</button><button type="submit" disabled={saving || warehouses.length === 0} className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">{saving ? "Duke ruajtur..." : "Shto produktin"}</button></div>
      </form>
    </dialog>
  </>;
}
