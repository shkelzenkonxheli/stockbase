"use client";

import { Children, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import Image from "next/image";

type CategoryItem = { id: number; name: string; productCount: number; isActive: boolean; imagePath: string | null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="min-h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-emerald-950 disabled:cursor-wait disabled:opacity-60">
      {pending ? "Duke ruajtur..." : "Ruaj ndryshimet"}
    </button>
  );
}

export function SettingsCategoryBrowser({ categories, createForm, details, saveAction }: {
  categories: CategoryItem[];
  createForm: ReactNode;
  details: ReactNode;
  saveAction: (formData: FormData) => void | Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const detailNodes = Children.toArray(details);
  const selectedIndex = categories.findIndex((category) => category.id === selectedId);
  const selected = selectedIndex >= 0 ? categories[selectedIndex] : null;
  const visible = useMemo(() => categories.filter((category) =>
    category.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
    (status === "all" || (status === "active" ? category.isActive : !category.isActive)),
  ), [categories, search, status]);

  useEffect(() => {
    if (selectedId === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [selectedId]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-950">Kategorite</h2>
          <p className="mt-1 text-sm text-slate-600">Organizo kategorite dhe konfiguro fushat e seciles.</p>
        </div>
        <button type="button" aria-expanded={showCreate} onClick={() => setShowCreate((value) => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800">{showCreate ? "Mbyll" : "+ Shto kategori"}</button>
      </div>
      {showCreate ? <div className="mt-5">{createForm}</div> : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-emerald-500">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8] text-slate-400"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Kerko kategori..." aria-label="Kerko kategori" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
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
            <button type="button" onClick={(event) => { triggerRef.current = event.currentTarget; setSelectedId(category.id); }} className="min-h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">Konfiguro / Edito</button>
          </article>
        ))}
        {visible.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Nuk u gjet kategori me kete filter.</p> : null}
      </div>
      {selected ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
          <button type="button" aria-label="Mbyll modalin" onClick={() => setSelectedId(null)} className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />
          <div role="dialog" aria-modal="true" aria-labelledby="category-modal-title" className="relative flex max-h-[min(92vh,960px)] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-slate-50 shadow-[0_30px_100px_rgba(15,23,42,0.30)]">
            <form action={saveAction} className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-700">Konfigurimi i kategorise</p>
                  <h2 id="category-modal-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950">Variablat</h2>
                  <p className="mt-1 text-xs text-slate-500">{selected.name} / Ndryshimet ruhen vetem per kete kategori.</p>
                </div>
                <button ref={closeRef} type="button" onClick={() => setSelectedId(null)} aria-label="Mbyll" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-600 hover:bg-slate-50">x</button>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
                {detailNodes[selectedIndex]}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
                <button type="button" onClick={() => setSelectedId(null)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Anulo</button>
                <SaveButton />
              </div>
            </form>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
