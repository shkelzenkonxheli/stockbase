"use client";

import { useActionState, useState } from "react";
import { UploadedImage } from "@/app/components/uploaded-image";
import { saveOnlineStore } from "./actions";

type Option = { id: number; name: string };
type Props = {
  categories: Option[];
  warehouses: Option[];
  products: (Option & { categoryId: number; imagePath: string | null })[];
  initial: {
    name: string;
    logoUrl: string;
    whatsappNumber: string;
    warehouseId?: number | null;
    categoryIds: number[];
    productIds: number[];
  };
};

const panel = "space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const secondary = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold disabled:opacity-50";

const sections = [
  { id: "general", label: "Të përgjithshme" },
  { id: "categories", label: "Kategoritë" },
  { id: "products", label: "Produktet" },
  { id: "appearance", label: "Pamja e web-it" },
  { id: "orders", label: "Porositë dhe dërgesat" },
] as const;

export function OnlineStoreForm({ categories, products, warehouses, initial }: Props) {
  const [result, save, pending] = useActionState(saveOnlineStore, { message: "", error: false });
  const [settings, setSettings] = useState({
    name: initial.name,
    logoUrl: initial.logoUrl,
    whatsappNumber: initial.whatsappNumber,
    warehouseId: initial.warehouseId?.toString() ?? "",
  });
  const [categoryIds, setCategoryIds] = useState(initial.categoryIds);
  const [productIds, setProductIds] = useState(initial.productIds);
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("general");
  const [onlySelected, setOnlySelected] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const selectedCategories = new Set(categoryIds);
  const selectedProducts = new Set(productIds);
  const categoryNames = new Map(categories.map(({ id, name }) => [id, name]));
  const shown = products.filter((product) =>
    (!onlySelected || selectedProducts.has(product.id)) &&
    (!filter || product.categoryId === Number(filter)) &&
    product.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const visibleProducts = products.filter(({ id, categoryId }) => selectedProducts.has(id) && selectedCategories.has(categoryId));
  const previewLogo = settings.logoUrl.trim().startsWith("https://") ? settings.logoUrl.trim() : "";

  function moveCategory(index: number, offset: number) {
    setCategoryIds((previous) => {
      const next = [...previous];
      const target = index + offset;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggleProduct(id: number, checked: boolean) {
    setProductIds((previous) => checked ? [...previous, id] : previous.filter((item) => item !== id));
  }

  function selectShown(checked: boolean) {
    const shownIds = new Set(shown.map(({ id }) => id));
    setProductIds((previous) =>
      checked ? [...new Set([...previous, ...shownIds])] : previous.filter((id) => !shownIds.has(id)),
    );
  }

  return (
    <form action={save} noValidate className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Cilësimet e dyqanit" className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {sections.map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={activeSection === id}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeSection === id ? "bg-emerald-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}
              onClick={() => setActiveSection(id)}>
              {label}
            </button>
          ))}
        </nav>
        <button disabled={pending} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Duke ruajtur…" : "Ruaj ndryshimet"}
        </button>
      </div>
      <p role={result.error ? "alert" : "status"} className={result.error ? "text-sm text-rose-700" : "text-sm text-emerald-700"}>
        {result.message}
      </p>
      <input type="hidden" name="categoryIds" value={JSON.stringify(categoryIds)} />
      <input type="hidden" name="productIds" value={JSON.stringify(productIds)} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <section hidden={activeSection !== "general"} className={panel}>
            <h2 className="text-lg font-semibold">Të dhënat e dyqanit</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">Emri i dyqanit
                <input className={input} name="name" maxLength={100} required value={settings.name}
                  onChange={(event) => setSettings({ ...settings, name: event.target.value })} />
              </label>
              <label className="grid gap-1 text-sm">Depoja për shitje online
                <select className={input} name="warehouseId" value={settings.warehouseId}
                  onChange={(event) => setSettings({ ...settings, warehouseId: event.target.value })}>
                  <option value="">Zgjidh depon</option>
                  {warehouses.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section hidden={activeSection !== "categories"} className={panel}>
            <h2 className="text-lg font-semibold">Kategoritë</h2>
            <p className="text-sm text-slate-600">Zgjidh kategoritë që shfaqen në dyqan dhe cakto rendin e tyre.</p>
            {categories.length === 0 && <p className="text-sm text-slate-600">Nuk ka kategori aktive.</p>}
            <div className="flex flex-wrap gap-2">
              {categories.map(({ id, name }) => (
                <label key={id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <input type="checkbox" checked={selectedCategories.has(id)} onChange={(event) => {
                    const checked = event.target.checked;
                    setCategoryIds((previous) => checked ? [...previous, id] : previous.filter((item) => item !== id));
                  }} />
                  {name}
                </label>
              ))}
            </div>
            {categoryIds.length > 1 && (
              <ol className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {categoryIds.map((id, index) => (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
                    <span>{categoryNames.get(id)}</span>
                    <div className="flex gap-2">
                      <button type="button" className={secondary} disabled={index === 0}
                        aria-label={`Zhvendos lart: ${categoryNames.get(id)}`} onClick={() => moveCategory(index, -1)}>Lart</button>
                      <button type="button" className={secondary} disabled={index === categoryIds.length - 1}
                        aria-label={`Zhvendos poshtë: ${categoryNames.get(id)}`} onClick={() => moveCategory(index, 1)}>Poshtë</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section hidden={activeSection !== "products"} className={panel}>
            <h2 className="text-lg font-semibold">Produktet në dyqan</h2>
            <p className="text-sm text-slate-600">
              {productIds.length} të përzgjedhura · {visibleProducts.length} në kategoritë aktive për dyqanin
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">Kërko produkt
                <input type="search" className={input} value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">Filtro sipas kategorisë
                <select className={input} value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="">Të gjitha kategoritë</option>
                  {categories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={onlySelected} onChange={(event) => setOnlySelected(event.target.checked)} />
              Vetëm të përzgjedhurat
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondary} disabled={!shown.length} onClick={() => selectShown(true)}>Përzgjidh rezultatet</button>
              <button type="button" className={secondary} disabled={!shown.length} onClick={() => selectShown(false)}>Hiq përzgjedhjen e rezultateve</button>
            </div>
            {shown.length === 0 ? (
              <p className="text-sm text-slate-600">Nuk u gjet asnjë produkt.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {shown.map(({ id, name, categoryId, imagePath }) => {
                  const selected = selectedProducts.has(id);
                  const visible = selected && selectedCategories.has(categoryId);
                  return (
                    <li key={id} className="min-w-0">
                      <label className={`relative block h-full cursor-pointer overflow-hidden rounded-xl border p-2 transition-colors focus-within:ring-2 focus-within:ring-emerald-600 ${selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-400"}`}>
                        <input type="checkbox" checked={selected} aria-label={name}
                          className="absolute right-3 top-3 z-10 size-4 accent-emerald-700"
                          onChange={(event) => toggleProduct(id, event.target.checked)} />
                        <ProductImage imagePath={imagePath} />
                        <span title={name} className="mt-2 block truncate text-sm font-semibold">{name}</span>
                        <span className="block truncate text-xs text-slate-600">{categoryNames.get(categoryId) ?? "Kategori joaktive"}</span>
                        {selected && (
                          <span className={`mt-1 block text-xs font-medium ${visible ? "text-emerald-700" : "text-amber-800"}`}>
                            {visible ? "Në dyqan" : "Kategoria e fshehur"}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section hidden={activeSection !== "appearance"} className={panel}>
            <h2 className="text-lg font-semibold">Pamja e web-it</h2>
              <label className="grid gap-1 text-sm">URL-ja e logos
                <input className={input} name="logoUrl" type="url" maxLength={512} placeholder="https://"
                  value={settings.logoUrl} onChange={(event) => setSettings({ ...settings, logoUrl: event.target.value })} />
              </label>
          </section>
          <section hidden={activeSection !== "orders"} className={panel}>
            <h2 className="text-lg font-semibold">Porositë dhe dërgesat</h2>
              <label className="grid gap-1 text-sm">WhatsApp
                <input className={input} name="whatsappNumber" type="tel" maxLength={30} placeholder="+383"
                  value={settings.whatsappNumber} onChange={(event) => setSettings({ ...settings, whatsappNumber: event.target.value })} />
              </label>
          </section>
        </div>

        <aside className={panel} aria-label="Pamje paraprake">
          <h2 className="text-lg font-semibold">Pamje paraprake</h2>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              {previewLogo && <UploadedImage src={previewLogo} alt="" className="size-8 rounded object-contain" />}
              <p className="min-w-0 break-words text-sm font-semibold">{settings.name.trim() || "Dyqani online"}</p>
            </div>
            {categoryIds.length > 0 && (
              <ul className="flex flex-wrap gap-1">
                {categoryIds.map((id) => <li key={id} className="rounded bg-white px-2 py-1 text-xs text-slate-600">{categoryNames.get(id)}</li>)}
              </ul>
            )}
            {visibleProducts.length > 0 ? (
              <ul className="grid grid-cols-2 gap-2">
                {visibleProducts.slice(0, 4).map(({ id, name, imagePath }) => (
                  <li key={id} className="min-w-0 rounded-lg bg-white p-1.5">
                    <ProductImage imagePath={imagePath} />
                    <p title={name} className="mt-1 truncate text-xs font-medium">{name}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-600">Zgjidh një kategori dhe një produkt për ta parë këtu.</p>}
            {visibleProducts.length > 4 && <p className="text-xs text-slate-600">+{visibleProducts.length - 4} produkte të tjera</p>}
          </div>
        </aside>
      </div>
    </form>
  );
}

function ProductImage({ imagePath }: { imagePath: string | null }) {
  const className = "h-20 w-full rounded-md bg-slate-100 sm:h-24";
  return imagePath
    ? <UploadedImage src={imagePath} alt="" loading="lazy" decoding="async" className={className + " object-contain"} />
    : <span className={className + " grid place-items-center text-xs text-slate-500"}>Pa foto</span>;
}
