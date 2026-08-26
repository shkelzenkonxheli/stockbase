"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type PosLocationSummary = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  supportsPos: boolean;
  _count: {
    posRegisters: number;
  };
};

type PosRegisterSummary = {
  id: number;
  warehouseId: number;
  name: string;
  slug: string;
  isActive: boolean;
  warehouse: {
    id: number;
    name: string;
    slug: string;
    isActive: boolean;
    supportsPos: boolean;
  };
  sessions: Array<{
    id: number;
    openedAt: Date;
    openedBy: {
      id: number;
      name: string;
    };
  }>;
  _count: {
    sessions: number;
  };
};

type PosRegistersManagerProps = {
  locations: PosLocationSummary[];
  registers: PosRegisterSummary[];
};

export function PosRegistersManager({
  locations,
  registers,
}: PosRegistersManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [createName, setCreateName] = useState("");
  const [createWarehouseId, setCreateWarehouseId] = useState("");
  const [drafts, setDrafts] = useState<Record<number, { name: string; warehouseId: string; isActive: boolean }>>(
    () =>
      Object.fromEntries(
        registers.map((register) => [
          register.id,
          {
            name: register.name,
            warehouseId: String(register.warehouseId),
            isActive: register.isActive,
          },
        ]),
      ),
  );

  const posLocations = useMemo(
    () => locations.filter((location) => location.isActive),
    [locations],
  );

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => setMessage(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        registers.map((register) => [
          register.id,
          {
            name: register.name,
            warehouseId: String(register.warehouseId),
            isActive: register.isActive,
          },
        ]),
      ),
    );
  }, [registers]);

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

  async function handleLocationToggle(locationId: number, supportsPos: boolean) {
    try {
      await runRequest(
        `/api/pos-admin/locations/${locationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supportsPos }),
        },
        "Lokacioni POS u perditesua.",
      );
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Perditesimi i lokacionit deshtoi.",
      });
    }
  }

  async function handleCreateRegister() {
    if (!createWarehouseId || !createName.trim()) {
      setMessage({ type: "error", text: "Zgjidh lokacionin dhe shkruaj emrin e register-it." });
      return;
    }

    try {
      await runRequest(
        "/api/pos-admin/registers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            warehouseId: Number(createWarehouseId),
            name: createName,
          }),
        },
        "Register-i u krijua me sukses.",
      );
      setCreateName("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Krijimi i register-it deshtoi.",
      });
    }
  }

  async function handleSaveRegister(registerId: number) {
    const draft = drafts[registerId];
    if (!draft) {
      return;
    }

    try {
      await runRequest(
        `/api/pos-admin/registers/${registerId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            warehouseId: Number(draft.warehouseId),
            name: draft.name,
            isActive: draft.isActive,
          }),
        },
        "Register-i u perditesua me sukses.",
      );
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Perditesimi i register-it deshtoi.",
      });
    }
  }

  return (
    <div className="space-y-5">
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

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-slate-950">POS Locations</p>
            <p className="mt-1 text-sm text-slate-600">
              Perdore depo/lokacion ekzistues si store POS pa krijuar sistem te dyfishte.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {locations.map((location) => (
            <article
              key={location.id}
              className="rounded-[22px] border border-slate-200 bg-slate-50/60 px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{location.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {location.supportsPos
                      ? `${location._count.posRegisters} register-a te lidhur`
                      : "Jo aktiv per POS"}
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={location.supportsPos}
                    disabled={isPending || !location.isActive}
                    onChange={(event) => void handleLocationToggle(location.id, event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                  />
                  Aktivizo si POS location
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Lokacioni
            <select
              value={createWarehouseId}
              onChange={(event) => setCreateWarehouseId(event.target.value)}
              className="w-full min-w-[220px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
            >
              <option value="">Zgjidh lokacionin</option>
              {posLocations
                .filter((location) => location.supportsPos)
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Emri i register-it
            <input
              type="text"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="p.sh. Register 1"
              className="w-full min-w-[240px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
            />
          </label>

          <button
            type="button"
            onClick={() => void handleCreateRegister()}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            Krijo register
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {registers.length > 0 ? (
          registers.map((register) => {
            const draft = drafts[register.id] ?? {
              name: register.name,
              warehouseId: String(register.warehouseId),
              isActive: register.isActive,
            };
            const openSession = register.sessions[0] ?? null;
            const warehouseSupportsPos = locations.find((location) => location.id === Number(draft.warehouseId))?.supportsPos ?? false;

            return (
              <article
                key={register.id}
                className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
                      <label className="grid gap-2 text-sm font-medium text-slate-800">
                        Emri i register-it
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [register.id]: {
                                ...draft,
                                name: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                        />
                      </label>

                      <label className="grid gap-2 text-sm font-medium text-slate-800">
                        Lokacioni
                        <select
                          value={draft.warehouseId}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [register.id]: {
                                ...draft,
                                warehouseId: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                        >
                          {locations
                            .filter((location) => location.supportsPos)
                            .map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                        {register.warehouse.name}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 font-medium ${
                          draft.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {draft.isActive ? "Aktiv" : "Jo aktiv"}
                      </span>
                      {openSession ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
                          Hapur nga {openSession.openedBy.name}
                        </span>
                      ) : null}
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        disabled={isPending || Boolean(openSession) || !warehouseSupportsPos}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [register.id]: {
                              ...draft,
                              isActive: event.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                      />
                      Register aktiv
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => void handleSaveRegister(register.id)}
                      disabled={isPending}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Ruaj
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-[22px] border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
            Nuk ka ende register-a POS. Aktivizo nje lokacion dhe krijo register-in e pare.
          </div>
        )}
      </section>
    </div>
  );
}
