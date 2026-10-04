"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type WarehouseSummary = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  totalStock: number;
  variantCount: number;
  assignedProductCount: number;
  _count: {
    inventories: number;
    orders: number;
    orderItems: number;
    stockMovements: number;
    inventoryCounts: number;
    auditLogs: number;
  };
};

type WarehouseManagerProps = {
  warehouses: WarehouseSummary[];
};

export function WarehouseManager({ warehouses }: WarehouseManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createName, setCreateName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { name: string; isActive: boolean }>>(() =>
    Object.fromEntries(
      warehouses.map((warehouse) => [warehouse.id, { name: warehouse.name, isActive: warehouse.isActive }]),
    ),
  );

  const hasWarehouses = warehouses.length > 0;

  const sortedWarehouses = useMemo(
    () => [...warehouses].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
    [warehouses],
  );
  const activeWarehouseCount = useMemo(
    () => warehouses.filter((warehouse) => warehouse.isActive).length,
    [warehouses],
  );

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  function updateDraft(id: number, field: "name" | "isActive", value: string | boolean) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        name: current[id]?.name ?? "",
        isActive: current[id]?.isActive ?? true,
        [field]: value,
      },
    }));
  }

  async function runRequest(input: RequestInfo, init: RequestInit, successText: string) {
    setMessage(null);

    const response = await fetch(input, init);
    const data = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      throw new Error(data?.error || "Veprimi deshtoi.");
    }

    setMessage({ type: "success", text: successText });
    startTransition(() => router.refresh());
  }

  async function handleCreate() {
    const name = createName.trim();
    if (!name) {
      setMessage({ type: "error", text: "Shkruaj emrin e depos." });
      return;
    }

    try {
      await runRequest(
        "/api/settings/warehouses",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
        "Depoja u krijua me sukses.",
      );
      setCreateName("");
      setShowCreate(false);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Krijimi i depos deshtoi.",
      });
    }
  }

  async function handleSave(id: number) {
    const draft = drafts[id];
    if (!draft) {
      return;
    }

    try {
      await runRequest(
        `/api/settings/warehouses/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: draft.name, isActive: draft.isActive }),
        },
        "Depoja u perditesua me sukses.",
      );
      setEditingId(null);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Perditesimi i depos deshtoi.",
      });
    }
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm(
      "A je i sigurt qe don ta fshish kete depo? Fshirja lejohet vetem kur depoja eshte bosh dhe pa histori.",
    );
    if (!confirmed) {
      return;
    }

    try {
      await runRequest(
        `/api/settings/warehouses/${id}`,
        { method: "DELETE" },
        "Depoja u fshi me sukses.",
      );
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Fshirja e depos deshtoi.",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="text-xl font-bold tracking-tight text-slate-950">Depot</h2><p className="mt-1 text-sm text-slate-600">Shiko stokun dhe menaxho depot e biznesit.</p></div>
        <button type="button" onClick={() => setShowCreate((value) => !value)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800">+ Shto depo</button>
      </div>
      {showCreate ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
        <label htmlFor="warehouse-create-name" className="block text-sm font-semibold text-slate-800">Emri i depos se re</label>
        <div className="mt-3 flex flex-wrap gap-2"><input id="warehouse-create-name" type="text" value={createName} onChange={(event) => setCreateName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (!isPending) void handleCreate(); } }} placeholder="p.sh. Depo Qendrore" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-emerald-600" /><button type="button" onClick={() => void handleCreate()} disabled={isPending} className="rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-60">Krijo depon</button></div>
      </section> : null}
      {message ? <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.text}</div> : null}
      {hasWarehouses ? sortedWarehouses.map((warehouse) => {
        const draft = drafts[warehouse.id] ?? { name: warehouse.name, isActive: warehouse.isActive };
        const hasStock = warehouse.totalStock > 0;
        const hasAssignments = warehouse.assignedProductCount > 0;
        const hasHistory = warehouse._count.orders > 0 || warehouse._count.orderItems > 0 || warehouse._count.stockMovements > 0 || warehouse._count.inventoryCounts > 0 || warehouse._count.auditLogs > 0;
        const canDeactivate = !warehouse.isActive || (!hasStock && activeWarehouseCount > 1);
        const canDelete = !hasStock && !hasAssignments && !hasHistory;
        const notes = [hasStock ? "Ka stok aktiv" : null, hasAssignments ? "Ka produkte te lidhura" : null, hasHistory ? "Ka histori ne sistem" : null, warehouse.isActive && activeWarehouseCount <= 1 ? "Depoja e fundit aktive" : null].filter(Boolean);
        return <article key={warehouse.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-emerald-900" aria-hidden="true"><svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.7]"><path d="M3 20V8l9-5 9 5v12H3ZM8 20v-7h8v7M3 10h18" /></svg></span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold text-slate-950">{warehouse.name}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${warehouse.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{warehouse.isActive ? "Aktive" : "Jo aktive"}</span></div><p className="mt-1 text-xs text-slate-500">{warehouse.slug}</p></div>
            <div className="flex gap-2"><button type="button" onClick={() => setEditingId(editingId === warehouse.id ? null : warehouse.id)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Ndrysho</button><button type="button" onClick={() => void handleDelete(warehouse.id)} disabled={isPending || !canDelete} title={!canDelete ? notes.join(", ") : "Fshi depon"} className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40">Fshi</button></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">{[
            ["Stok total", warehouse.totalStock], ["Variante", warehouse.variantCount], ["Produkte", warehouse.assignedProductCount],
            ["Porosi", warehouse._count.orders + warehouse._count.orderItems], ["Levizje", warehouse._count.stockMovements], ["Numerime", warehouse._count.inventoryCounts],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-950">{value}</p></div>)}</div>
          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600"><span className="font-semibold text-slate-700">Gjendja: </span>{notes.length ? notes.join(" / ") : "Pa kufizime. Depoja mund te ndryshohet ose fshihet."}</div>
          {editingId === warehouse.id ? <div className="mt-4 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="text-xs font-semibold text-slate-700">Emri i depos<input type="text" value={draft.name} onChange={(event) => updateDraft(warehouse.id, "name", event.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600" /></label>
            <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft.isActive} disabled={!canDeactivate && warehouse.isActive} onChange={(event) => updateDraft(warehouse.id, "isActive", event.target.checked)} /> Aktive</label>
            <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="button" onClick={() => void handleSave(warehouse.id)} disabled={isPending} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Ruaj depon</button><button type="button" onClick={() => { setDrafts((current) => ({ ...current, [warehouse.id]: { name: warehouse.name, isActive: warehouse.isActive } })); setEditingId(null); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Anulo</button></div>
          </div> : null}
        </article>;
      }) : <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Nuk ka ende depo. Shto depon e pare per te filluar.</div>}
    </div>
  );
}
