"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Warehouse = { id: number; name: string };
type SourceVariant = { id: number; size: string; color: string; stock: number };
type Target = { color?: string; variantId?: number };
type Adjustment = { variantId: number; quantity: number };

export function QuickStockTransferModal({
  productId,
  productName,
  target,
  warehouses,
  preferredWarehouseId,
  onClose,
  onSuccess,
}: {
  productId: number;
  productName: string;
  target: Target;
  warehouses: Warehouse[];
  preferredWarehouseId?: number | null;
  onClose: () => void;
  onSuccess: (input: { fromWarehouseId: number; toWarehouseId: number; adjustments: Adjustment[] }) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fromWarehouseId, setFromWarehouseId] = useState(
    warehouses.find((warehouse) => warehouse.id === preferredWarehouseId)?.id ?? warehouses[0]?.id ?? 0,
  );
  const [toWarehouseId, setToWarehouseId] = useState(
    warehouses.find((warehouse) => warehouse.id !== fromWarehouseId)?.id ?? 0,
  );
  const [variants, setVariants] = useState<SourceVariant[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setVariants([]);
    setQuantities({});
    setError(null);
    fetch(`/api/products/${productId}/inventory-variants?warehouseId=${fromWarehouseId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Nuk u ngarkua stoku i depos.");
        return response.json() as Promise<SourceVariant[]>;
      })
      .then((items) => {
        setVariants(items.filter((item) =>
          item.stock > 0 && (target.variantId
            ? item.id === target.variantId
            : item.color.trim().toLocaleLowerCase() === target.color?.trim().toLocaleLowerCase()),
        ));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Nuk u ngarkua stoku.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fromWarehouseId, productId, target.color, target.variantId]);

  const adjustments = useMemo(() => variants.flatMap((variant) => {
    const quantity = Number(quantities[variant.id] ?? "0");
    return Number.isSafeInteger(quantity) && quantity > 0
      ? [{ variantId: variant.id, quantity }]
      : [];
  }), [quantities, variants]);
  const total = adjustments.reduce((sum, item) => sum + item.quantity, 0);

  async function submit() {
    setError(null);
    const invalidQuantity = variants.some((variant) => {
      const raw = quantities[variant.id];
      if (!raw) return false;
      const value = Number(raw);
      return !Number.isSafeInteger(value) || value < 0 || value > variant.stock;
    });
    if (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId || adjustments.length === 0 ||
        adjustments.length > 100 || invalidQuantity) {
      setError("Zgjedh dy depo te ndryshme dhe sasi qe nuk tejkalojne stokun.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/stock/transfer/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromWarehouseId, toWarehouseId, adjustments }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Transferi deshtoi.");
      onSuccess({ fromWarehouseId, toWarehouseId, adjustments });
      dialogRef.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Transferi deshtoi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(event) => { if (saving) event.preventDefault(); }}
      className="m-auto w-[min(94vw,620px)] max-h-[90dvh] overflow-y-auto rounded-[28px] border border-emerald-100 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60"
      aria-labelledby="quick-transfer-title"
    >
      <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Transfer i shpejte</p>
            <h2 id="quick-transfer-title" className="mt-1 text-xl font-bold">Transfero stokun</h2>
            <p className="mt-1 text-sm text-slate-500">{productName}{target.color ? ` / ${target.color}` : ""}</p>
          </div>
          <button type="button" onClick={() => dialogRef.current?.close()} disabled={saving} aria-label="Mbyll" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600">X</button>
        </div>
      </div>
      <div className="space-y-5 px-5 py-5 sm:px-7">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold">Nga depoja
            <select value={fromWarehouseId} onChange={(event) => {
              const next = Number(event.target.value);
              setFromWarehouseId(next);
              if (next === toWarehouseId) setToWarehouseId(warehouses.find((item) => item.id !== next)?.id ?? 0);
            }} disabled={saving} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal">
              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">Ne depon
            <select value={toWarehouseId} onChange={(event) => setToWarehouseId(Number(event.target.value))} disabled={saving} className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal">
              {warehouses.filter((item) => item.id !== fromWarehouseId).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>Numrat dhe sasia</span><span className="text-slate-500">{total} cope</span></div>
          {loading ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Duke ngarkuar stokun...</p> : variants.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Nuk ka stok te disponueshem per kete {target.color ? "ngjyre" : "variant"} ne depon burim.</p>
          ) : <div className="max-h-64 space-y-2 overflow-y-auto">
            {variants.map((variant) => <label key={variant.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <span><strong>{variant.size || variant.color || "Variant"}</strong><span className="ml-2 text-slate-500">{variant.stock} ne stok</span></span>
              <input type="number" min="0" max={variant.stock} step="1" inputMode="numeric" value={quantities[variant.id] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [variant.id]: event.target.value }))} disabled={saving} aria-label={`Sasia per ${variant.size || variant.color}`} placeholder="0" className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-right" />
            </label>)}
          </div>}
        </div>
        {error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-7">
        <button type="button" onClick={() => dialogRef.current?.close()} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Anulo</button>
        <button type="button" onClick={() => void submit()} disabled={saving || loading || total === 0} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Duke transferuar..." : "Konfirmo transferin"}</button>
      </div>
    </dialog>
  );
}
