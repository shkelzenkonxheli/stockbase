"use client";

export function ReceiptActions() {
  return (
    <div className="mb-5 flex flex-wrap justify-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
      >
        Printo / Ruaj PDF
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Mbyll
      </button>
    </div>
  );
}
