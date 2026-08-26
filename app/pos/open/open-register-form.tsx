"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RegisterOption = {
  id: number;
  name: string;
  warehouseId: number;
  warehouseName: string;
  isActive: boolean;
};

type OpenRegisterFormProps = {
  cashierName: string;
  locations: Array<{
    id: number;
    name: string;
  }>;
  registers: RegisterOption[];
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function OpenRegisterForm({
  cashierName,
  locations,
  registers,
}: OpenRegisterFormProps) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(String(locations[0]?.id ?? ""));
  const [registerId, setRegisterId] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [openingNote, setOpeningNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredRegisters = useMemo(() => {
    const activeLocationId = Number(locationId);
    return registers.filter((register) => register.warehouseId === activeLocationId && register.isActive);
  }, [locationId, registers]);

  const selectedRegister = filteredRegisters.find((register) => String(register.id) === registerId) ?? null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/pos-admin/sessions/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerId: Number(registerId),
          openingCash: Number(openingCash),
          openingNote,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; redirectTo?: string }
        | null;

      if (!response.ok || !data?.redirectTo) {
        throw new Error(data?.error || "Hapja e register-it deshtoi.");
      }

      router.push(data.redirectTo);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Hapja e register-it deshtoi.");
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-emerald-100 bg-white/96 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.12)] sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            POS Session
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Open Register
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Zgjidh lokacionin, register-in dhe vendos cash-in fillestar para se te hysh ne ekranin e shitjes.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tani</p>
          <p className="mt-1 font-semibold text-slate-950">{formatDateTime(new Date())}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#fbfffd_0%,#f5fbf8_100%)] p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Store / Lokacion
              <select
                value={locationId}
                onChange={(event) => {
                  setLocationId(event.target.value);
                  setRegisterId("");
                }}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Register
              <select
                value={registerId}
                onChange={(event) => setRegisterId(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Zgjidh register-in</option>
                {filteredRegisters.map((register) => (
                  <option key={register.id} value={register.id}>
                    {register.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Cashier
              <input
                value={cashierName}
                disabled
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Opening cash
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={openingCash}
                onChange={(event) => setOpeningCash(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
              Shenim hapjeje (opsionale)
              <textarea
                rows={2}
                value={openingNote}
                onChange={(event) => setOpeningNote(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                placeholder="p.sh. hapja e mengjesit"
              />
            </label>
          </div>
        </section>

        <aside className="rounded-[24px] border border-slate-200 bg-slate-950 p-4 text-white shadow-[0_20px_50px_rgba(15,23,42,0.22)] sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            Gati per shitje
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Lokacioni</p>
              <p className="mt-1 font-semibold text-white">
                {locations.find((location) => String(location.id) === locationId)?.name ?? "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Register</p>
              <p className="mt-1 font-semibold text-white">{selectedRegister?.name ?? "-"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Cashier</p>
              <p className="mt-1 font-semibold text-white">{cashierName}</p>
            </div>
          </div>

          {message ? (
            <div className="mt-4 rounded-2xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || !registerId}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#10b981_0%,#059669_100%)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(16,185,129,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Duke hapur..." : "Open Register"}
          </button>
        </aside>
      </div>
    </form>
  );
}
