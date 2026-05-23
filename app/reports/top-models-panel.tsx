"use client";

import { useState } from "react";

type TopModel = {
  brand: string;
  name: string;
  quantity: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
};

function statusBadge(status: TopModel["status"]) {
  switch (status) {
    case "LOW_STOCK":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    case "OUT_OF_STOCK":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    default:
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }
}

function statusLabel(status: TopModel["status"]) {
  switch (status) {
    case "LOW_STOCK":
      return "Stok i ulet";
    case "OUT_OF_STOCK":
      return "Pa stok";
    default:
      return "Ne stok";
  }
}

export function TopModelsPanel({ models }: { models: TopModel[] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleModels = showAll ? models : models.slice(0, 6);

  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.07)] print:break-inside-avoid print:shadow-none">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-[24px] font-semibold tracking-tight text-slate-950">
          Top modelet
        </h2>
      </div>
      {models.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-slate-500">
          Nuk ka shitje per kete muaj.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/90 text-left">
                <tr className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <th className="px-6 py-4">Kategoria</th>
                  <th className="px-6 py-4">Produkti</th>
                  <th className="px-6 py-4">Statusi</th>
                  <th className="px-6 py-4 text-right">Sasia e shitur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleModels.map((item) => (
                  <tr key={`${item.brand}-${item.name}`} className="hover:bg-slate-50/70">
                    <td className="px-6 py-5 font-medium text-slate-950">{item.brand}</td>
                    <td className="px-6 py-5 text-slate-700">{item.name}</td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusBadge(
                          item.status,
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right text-xl font-semibold tracking-tight text-slate-950">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {models.length > 6 ? (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="w-full border-t border-slate-200 bg-slate-50 px-6 py-5 text-center text-sm font-medium text-slate-700 transition hover:text-slate-950"
            >
              {showAll ? "Shfaq me pak" : `Shfaq te gjitha ${models.length} produktet kryesore`}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
