"use client";

import { Children, type ReactNode, useMemo, useState } from "react";
import Image from "next/image";

type CategoryItem = { id: number; name: string; productCount: number; isActive: boolean; imagePath: string | null };

export function SettingsCategoryBrowser({ categories, createForm, details }: {
  categories: CategoryItem[];
  createForm: ReactNode;
  details: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const detailNodes = Children.toArray(details);
  const selected = categories.find((category) => category.id === selectedId);
  const visible = useMemo(() => categories.filter((category) =>
    category.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
    (status === "all" || (status === "active" ? category.isActive : !category.isActive)),
  ), [categories, search, status]);

  return (
    <div className="mx-auto max-w-4xl">
      {selected ? (
        <div className="mb-5 space-y-4">
          <button type="button" onClick={() => setSelectedId(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-800">
            <span aria-hidden="true">&#8592;</span> Kategorite <span className="text-slate-300">/</span> <span className="text-slate-950">{selected.name}</span>
          </button>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 text-emerald-800">
              {selected.imagePath ? <Image src={selected.imagePath} alt="" fill unoptimized sizes="64px" className="object-contain p-1" /> : <svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current stroke-[1.7]"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>}
            </span>
            <div className="min-w-0 flex-1"><h2 className="truncate text-xl font-bold tracking-tight text-slate-950">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.productCount} produkte ne kete kategori</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${selected.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{selected.isActive ? "Aktive" : "Jo aktive"}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="text-xl font-bold tracking-tight text-slate-950">Kategorite</h2><p className="mt-1 text-sm text-slate-600">Organizo kategorite dhe konfiguro fushat e seciles.</p></div>
            <button type="button" onClick={() => setShowCreate((value) => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800">+ Shto kategori</button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-emerald-500">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8] text-slate-400"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kerko kategori..." aria-label="Kerko kategori" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </label>
            <select aria-label="Filtro statusin" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500">
              <option value="all">Te gjitha</option><option value="active">Aktive</option><option value="inactive">Jo aktive</option>
            </select>
          </div>
          <div className="mt-5 space-y-2.5">
            {visible.map((category) => (
              <article key={category.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-nowrap">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 text-emerald-800" aria-hidden="true">
                  {category.imagePath ? <Image src={category.imagePath} alt="" fill unoptimized sizes="44px" className="object-contain p-1" /> : <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.7]"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>}
                </span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-950">{category.name}</p><p className="mt-0.5 text-xs text-slate-500">{category.productCount} produkte</p></div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${category.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{category.isActive ? "Aktive" : "Jo aktive"}</span>
                <button type="button" onClick={() => setSelectedId(category.id)} className="min-h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">Konfiguro variablat</button>
              </article>
            ))}
            {visible.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Nuk u gjet kategori me kete filter.</p> : null}
          </div>
        </>
      )}
      <div className={!selected && showCreate ? "mt-5 block" : "hidden"}>{createForm}</div>
      <div className={selected ? "mt-4" : "hidden"}>
        {detailNodes.map((node, index) => <div key={categories[index]?.id ?? index} className={selectedId === categories[index]?.id ? "block" : "hidden"}>{node}</div>)}
      </div>
    </div>
  );
}
