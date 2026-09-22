"use client";

import Link from "next/link";
import { useRef } from "react";

type RecentMovement = {
  id: number;
  productName: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  reason: string;
  createdAtLabel: string;
};

function getReasonLabel(reason: string) {
  if (reason === "CUSTOMER_RETURN") return "Kthim klienti";
  if (reason === "SUPPLIER_RETURN") return "Kthim furnitori";
  if (reason === "TRANSFER") return "Transfer";
  if (reason === "INVENTORY_COUNT") return "Inventory count";
  if (reason === "POS_SALE") return "Shitje POS";
  return "Hyrje stoku";
}

export function RecentMovementsModal({ movements }: { movements: RecentMovement[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
      >
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-600 px-1 text-xs font-bold text-white">
          {movements.length}
        </span>
        Levizjet e fundit
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-[26px] border border-slate-200 bg-white p-0 text-slate-900 shadow-[0_28px_80px_rgba(15,23,42,0.28)] backdrop:bg-slate-950/45"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <div className="flex max-h-[82vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Aktivitet i stokut</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Levizjet e fundit</h2>
              <p className="mt-1 text-sm text-slate-500">Tetë hyrjet, kthimet ose levizjet me te fundit.</p>
            </div>
            <button type="button" aria-label="Mbyll modalin" onClick={() => dialogRef.current?.close()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-500 transition hover:bg-slate-50 hover:text-slate-950">x</button>
          </div>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {movements.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">Nuk ka ende levizje stoku te regjistruara.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <tr><th className="px-4 py-3">Produkti</th><th className="px-4 py-3">Varianti</th><th className="hidden px-4 py-3 sm:table-cell">Data</th><th className="px-4 py-3 text-right">Sasia</th><th className="hidden px-4 py-3 md:table-cell">Arsyeja</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((movement) => (
                      <tr key={movement.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3"><p className="font-semibold text-slate-900">{movement.productName}</p><p className="mt-0.5 text-xs text-slate-500">SKU {movement.sku ?? "-"}</p></td>
                        <td className="px-4 py-3 text-slate-600">{movement.size ?? "-"} / {movement.color ?? "-"}</td>
                        <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{movement.createdAtLabel}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${movement.quantity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{movement.quantity >= 0 ? "+" : ""}{movement.quantity}</td>
                        <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{getReasonLabel(movement.reason)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6"><Link href="/stock/incoming" onClick={() => dialogRef.current?.close()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">Shto hyrje stoku</Link></div>
        </div>
      </dialog>
    </>
  );
}
