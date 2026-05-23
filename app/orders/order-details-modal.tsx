"use client";

import { useId, useRef } from "react";
import { UploadedImage } from "@/app/components/uploaded-image";

type OrderItem = {
  id: number;
  name: string;
  brand: string;
  size: string;
  color: string;
  imagePath?: string | null;
  quantity: number;
};

type OrderDetailsModalProps = {
  orderId: number;
  customerName: string;
  phone: string;
  sourceLabel: string;
  createdAtDateLabel: string;
  createdAtTimeLabel: string;
  reference: string | null;
  notes: string | null;
  items: OrderItem[];
};

export function OrderDetailsModal({
  orderId,
  customerName,
  phone,
  sourceLabel,
  createdAtDateLabel,
  createdAtTimeLabel,
  reference,
  notes,
  items,
}: OrderDetailsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
        aria-label={`Shiko porosine ${orderId}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
        >
          <path
            d="M1.75 10C3.15 6.55 6.19 4.25 10 4.25S16.85 6.55 18.25 10C16.85 13.45 13.81 15.75 10 15.75S3.15 13.45 1.75 10Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(720px,calc(100%-2rem))] rounded-[28px] border border-slate-200 bg-white p-0 text-left shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop:bg-slate-950/45"
      >
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="mx-auto text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Porosia #{orderId}
              </p>
              <h2
                id={titleId}
                className="mt-2 text-2xl font-semibold tracking-tight text-slate-950"
              >
                {customerName}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{phone}</p>
            </div>

            <form method="dialog" className="shrink-0">
              <button
                type="submit"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Mbyll
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Burimi
              </p>
              <p className="mt-2 font-semibold text-slate-950">{sourceLabel}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Koha
              </p>
              <p className="mt-2 font-semibold text-slate-950">
                {createdAtDateLabel}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {createdAtTimeLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Referenca
              </p>
              <p className="mt-2 font-semibold text-slate-950">
                {reference || "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Artikuj
              </p>
              <p className="mt-2 font-semibold text-slate-950">
                {items.length} /{" "}
                {items.reduce((sum, item) => sum + item.quantity, 0)} cope
              </p>
            </div>
          </div>

          <div className="space-y-3 text-center">
            <p className="text-sm font-semibold text-slate-950">
              Detajet e porosise
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      {item.imagePath ? (
                        <UploadedImage
                          src={item.imagePath}
                          alt={`${item.name} ${item.color}`}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">
                        {item.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.brand}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700">
                      Nr {item.size}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700">
                      {item.color}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
                      {item.quantity} cope
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {notes ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Shenime
              </p>
              <p className="mt-2 text-sm text-slate-700">{notes}</p>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
