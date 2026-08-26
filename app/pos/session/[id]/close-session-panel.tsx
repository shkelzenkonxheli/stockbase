"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type CloseSessionPanelProps = {
  sessionId: number;
  openingCash: number;
  expectedCash: number;
  canClose: boolean;
};

export function CloseSessionPanel({
  sessionId,
  openingCash,
  expectedCash,
  canClose,
}: CloseSessionPanelProps) {
  const router = useRouter();
  const [countedCash, setCountedCash] = useState(String(expectedCash.toFixed(2)));
  const [closingNote, setClosingNote] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const difference = useMemo(() => {
    const counted = Number(countedCash);
    if (!Number.isFinite(counted)) {
      return 0;
    }
    return counted - expectedCash;
  }, [countedCash, expectedCash]);

  async function handleClose() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/pos-admin/sessions/${sessionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countedCash: Number(countedCash),
          closingNote,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; redirectTo?: string }
        | null;

      if (!response.ok || !data?.redirectTo) {
        throw new Error(data?.error || "Mbyllja e register-it deshtoi.");
      }

      setMessage({ type: "success", text: "Register-i u mbyll me sukses." });
      router.push(data.redirectTo);
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Mbyllja e register-it deshtoi.",
      });
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/96 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.08)] sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Close Register
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Mbyll session-in aktiv</h2>
          <p className="mt-2 text-sm text-slate-600">
            Vendos cash-in e numeruar dhe ruaj mbylljen e register-it.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Opening cash</p>
          <p className="mt-1 font-semibold text-slate-950">{openingCash.toFixed(2)} EUR</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#fbfffd_0%,#f5fbf8_100%)] p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Expected cash
              <input
                value={`${expectedCash.toFixed(2)} EUR`}
                disabled
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-800">
              Counted cash
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={countedCash}
                onChange={(event) => setCountedCash(event.target.value)}
                disabled={!canClose || isSubmitting}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
              Closing note (opsionale)
              <textarea
                rows={3}
                value={closingNote}
                onChange={(event) => setClosingNote(event.target.value)}
                disabled={!canClose || isSubmitting}
                placeholder="p.sh. turni i mbyllur pa dallim"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
              />
            </label>
          </div>
        </div>

        <aside className="rounded-[24px] border border-slate-200 bg-slate-950 p-4 text-white shadow-[0_20px_50px_rgba(15,23,42,0.22)] sm:p-5">
          <div className="space-y-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Expected</p>
              <p className="mt-1 font-semibold text-white">{expectedCash.toFixed(2)} EUR</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Counted</p>
              <p className="mt-1 font-semibold text-white">
                {Number.isFinite(Number(countedCash)) ? `${Number(countedCash).toFixed(2)} EUR` : "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Difference</p>
              <p
                className={`mt-1 font-semibold ${
                  difference === 0 ? "text-white" : difference > 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {difference > 0 ? "+" : ""}
                {difference.toFixed(2)} EUR
              </p>
            </div>
          </div>

          {message ? (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                message.type === "success"
                  ? "border border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                  : "border border-rose-300/30 bg-rose-500/10 text-rose-100"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={!canClose || isSubmitting}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#10b981_0%,#059669_100%)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(16,185,129,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Duke mbyllur..." : "Close Register"}
          </button>
        </aside>
      </div>
    </section>
  );
}
