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
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="warehouse-create-name" className="block text-sm font-medium text-slate-800">
              Shto depo te re
            </label>
            <input
              id="warehouse-create-name"
              type="text"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="p.sh. Depo Qendrore"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            Shto depo
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Depot menaxhohen nga databaza. Mund t'i riemerosh ose caktivizosh pa prekur konfigurimin tjeter.
        </p>
      </section>

      {message ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            message.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <section className="space-y-3">
        {hasWarehouses ? (
          sortedWarehouses.map((warehouse) => {
            const draft = drafts[warehouse.id] ?? {
              name: warehouse.name,
              isActive: warehouse.isActive,
            };
            const hasStock = warehouse.totalStock > 0;
            const hasAssignments = warehouse.assignedProductCount > 0;
            const hasHistory =
              warehouse._count.orders > 0 ||
              warehouse._count.orderItems > 0 ||
              warehouse._count.stockMovements > 0 ||
              warehouse._count.inventoryCounts > 0 ||
              warehouse._count.auditLogs > 0;
            const canDeactivate = !warehouse.isActive || (!hasStock && activeWarehouseCount > 1);
            const canDelete = !hasStock && !hasAssignments && !hasHistory;
            const statusNotes = [
              hasStock ? "Ka stok aktiv" : null,
              hasAssignments ? "Ka produkte te lidhura" : null,
              hasHistory ? "Ka histori ne sistem" : null,
              warehouse.isActive && activeWarehouseCount <= 1 ? "Eshte depoja e fundit aktive" : null,
            ].filter(Boolean) as string[];

            return (
              <article
                key={warehouse.id}
                className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-800">Emri i depos</label>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(event) => updateDraft(warehouse.id, "name", event.target.value)}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) => updateDraft(warehouse.id, "isActive", event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                        />
                        Aktive
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Stok total</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{warehouse.totalStock}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Variante</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{warehouse.variantCount}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Produkte</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{warehouse.assignedProductCount}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Porosi</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{warehouse._count.orders + warehouse._count.orderItems}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Levizje</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{warehouse._count.stockMovements}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Numerime</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{warehouse._count.inventoryCounts}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          draft.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {draft.isActive ? "Aktive" : "Jo aktive"}
                      </span>
                      {!canDeactivate ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                          Nuk caktivizohet tani
                        </span>
                      ) : null}
                      {!canDelete ? (
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
                          Nuk fshihet tani
                        </span>
                      ) : null}
                    </div>

                    {statusNotes.length > 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                        <p className="font-semibold uppercase tracking-[0.14em] text-slate-500">Kufizime</p>
                        <p className="mt-1">{statusNotes.join(" · ")}.</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-800">
                        Kjo depo mund te caktivizohet ose fshihet nese nuk lidhet me te dhena te reja.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => void handleSave(warehouse.id)}
                      disabled={isPending}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Ruaj
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(warehouse.id)}
                      disabled={isPending || !canDelete}
                      className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60"
                    >
                      Fshi
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
            Nuk ka ende depo. Shto nje depo dhe sistemi do ta perdore ne produktet, stokun, porosite dhe transferet.
          </div>
        )}
      </section>
    </div>
  );
}
