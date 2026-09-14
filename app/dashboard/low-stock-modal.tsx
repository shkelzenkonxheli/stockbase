"use client";

import Link from "next/link";
import { useRef } from "react";

type LowStockItem = {
  id: number;
  productId: number;
  productName: string;
  brand: string | null;
  categoryName: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  stock: number;
  reorderLevel: number;
  missingUnits: number;
};

export function LowStockModal({ items }: { items: LowStockItem[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
      >
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white">
          {items.length}
        </span>
        Low stock
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-[26px] border border-slate-200 bg-white p-0 text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.28)] backdrop:bg-slate-950/45"
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            dialogRef.current.close();
          }
        }}
      >
        <div className="flex max-h-[82vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600">Reorder alert</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Produktet me stok te ulet</h2>
              <p className="mt-1 text-sm text-slate-500">Variantet ne ose nen pragun e furnizimit.</p>
            </div>
            <button
              type="button"
              aria-label="Mbyll modalin"
              onClick={() => dialogRef.current?.close()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
            >
              x
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-10 text-center text-sm text-emerald-800">
                Nuk ka variante me stok te ulet per momentin.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Produkti</th>
                      <th className="px-4 py-3">Varianti</th>
                      <th className="hidden px-4 py-3 md:table-cell">SKU</th>
                      <th className="px-4 py-3 text-right">Stok</th>
                      <th className="hidden px-4 py-3 text-right sm:table-cell">Reorder</th>
                      <th className="px-4 py-3 text-right">Mungojne</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link href={`/products/${item.productId}`} onClick={() => dialogRef.current?.close()} className="font-semibold text-slate-900 hover:text-emerald-700">
                            {item.brand ? `${item.brand} ${item.productName}` : item.productName}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-500">{item.categoryName}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.color ?? "-"} / {item.size ?? "-"}</td>
                        <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{item.sku ?? "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-700">{item.stock}</td>
                        <td className="hidden px-4 py-3 text-right text-slate-600 sm:table-cell">{item.reorderLevel}</td>
                        <td className="px-4 py-3 text-right font-semibold text-rose-700">{item.missingUnits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
            <Link href="/products?stock=low" onClick={() => dialogRef.current?.close()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Shiko te gjitha</Link>
            <Link href="/stock/incoming" onClick={() => dialogRef.current?.close()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">Shto hyrje stoku</Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
