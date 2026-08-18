"use client";

import { useId, useMemo, useRef, useState } from "react";
import { getOrderVariantSummary } from "@/lib/order-variant-display";

type ReturnableOrderItem = {
  id: number;
  name: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  material?: string | null;
  powerWatts?: string | null;
  quantity: number;
  returnedQuantity: number;
};

type OrderPartialReturnModalProps = {
  orderId: number;
  customerName: string;
  items: ReturnableOrderItem[];
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  buttonLabel?: string;
};

export function OrderPartialReturnModal({
  orderId,
  customerName,
  items,
  action,
  className,
  buttonLabel,
}: OrderPartialReturnModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  const returnableItems = useMemo(
    () =>
      items
        .map((item) => ({
          ...item,
          remainingQuantity: Math.max(0, item.quantity - item.returnedQuantity),
        }))
        .filter((item) => item.remainingQuantity > 0),
    [items],
  );

  const serializedItems = JSON.stringify(
    returnableItems
      .map((item) => {
        const nextQuantity = Number(quantities[item.id] ?? "0");
        if (!Number.isInteger(nextQuantity) || nextQuantity <= 0) {
          return null;
        }

        return {
          orderItemId: item.id,
          quantity: Math.min(nextQuantity, item.remainingQuantity),
        };
      })
      .filter((item): item is { orderItemId: number; quantity: number } => item !== null),
  );

  const hasSelection = serializedItems !== "[]";

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={
          className ??
          "inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
        }
      >
        {buttonLabel ?? "Partial return"}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(760px,calc(100%-2rem))] rounded-[28px] border border-slate-200 bg-white p-0 text-left shadow-[0_24px_80px_rgba(15,23,42,0.22)] backdrop:bg-slate-950/45"
      >
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                Partial Return
              </p>
              <h2 id={titleId} className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Porosia #{orderId} - {customerName}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Zgjidh sasine qe po kthehet per secilin artikull.
              </p>
            </div>

            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Mbyll
            </button>
          </div>
        </div>

        <form action={action} className="space-y-5 px-5 py-5 sm:px-6">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="returnItems" value={serializedItems} />

          <div className="grid gap-3">
            {returnableItems.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_120px]"
              >
                <div>
                  <p className="font-semibold text-slate-950">
                    {[item.brand, item.name].filter(Boolean).join(" ")}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{getOrderVariantSummary(item)}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                      Shitur: {item.quantity}
                    </span>
                    {item.returnedQuantity > 0 ? (
                      <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-700">
                        Kthyer: {item.returnedQuantity}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                      Mbetur: {item.remainingQuantity}
                    </span>
                  </div>
                </div>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Sasia qe kthehet
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={item.remainingQuantity}
                    inputMode="numeric"
                    value={quantities[item.id] ?? ""}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                    placeholder="0"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Artikujt pa sasi mbeten pa ndryshim.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Anulo
              </button>
              <button
                type="submit"
                disabled={!hasSelection}
                className="rounded-xl bg-indigo-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ruaj kthimin
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
