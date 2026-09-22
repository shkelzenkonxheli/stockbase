"use client";

export function CatalogPreviewActions({ catalogName, publicUrl }: { catalogName: string; publicUrl?: string | null }) {

  function emailCatalog() {
    const link = new URL(publicUrl || window.location.href, window.location.origin).toString();
    window.location.href = `mailto:?subject=${encodeURIComponent(catalogName)}&body=${encodeURIComponent(`Shiko katalogun: ${link}`)}`;
  }

  return <div className="flex items-center gap-2 print:hidden"><button type="button" title="Printo" onClick={() => window.print()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"><svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1-2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z" /></svg></button><button type="button" title="Ruaj si PDF" onClick={() => window.print()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"><svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]"><path d="M12 3v12M8 11l4 4 4-4M5 21h14" /></svg></button><button type="button" title="Dergo me email" onClick={emailCatalog} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white transition hover:bg-emerald-700"><svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg></button></div>;
}
