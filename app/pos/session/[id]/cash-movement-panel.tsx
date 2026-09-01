"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CashMovementPanelProps = {
  sessionId: number;
  canManage: boolean;
};

export function CashMovementPanel({ sessionId, canManage }: CashMovementPanelProps) {
  const router = useRouter();
  const [type, setType] = useState<"CASH_IN" | "CASH_OUT">("CASH_IN");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitMovement() {
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/pos-admin/sessions/${sessionId}/cash-movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: Number(amount), note }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Levizja e cash-it deshtoi.");

      setAmount("");
      setNote("");
      setMessage({ type: "success", text: type === "CASH_IN" ? "Cash in u ruajt." : "Cash out u ruajt." });
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Levizja e cash-it deshtoi.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(135deg,#f5fffa_0%,#ffffff_65%)] p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Cash control</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Cash In / Cash Out</h2>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          Vetem session aktiv
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[auto_130px_minmax(0,1fr)_auto]">
        <div className="inline-flex rounded-xl border border-emerald-100 bg-white p-1">
          <button
            type="button"
            onClick={() => setType("CASH_IN")}
            disabled={!canManage || isSubmitting}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${type === "CASH_IN" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50"}`}
          >
            + Cash In
          </button>
          <button
            type="button"
            onClick={() => setType("CASH_OUT")}
            disabled={!canManage || isSubmitting}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${type === "CASH_OUT" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 hover:bg-amber-50"}`}
          >
            - Cash Out
          </button>
        </div>
        <input
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={!canManage || isSubmitting}
          placeholder="Shuma"
          className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={!canManage || isSubmitting}
          maxLength={300}
          placeholder="Arsye / shenim (opsionale)"
          className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
        />
        <button
          type="button"
          onClick={() => void submitMovement()}
          disabled={!canManage || isSubmitting || !amount}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Duke ruajtur..." : "Ruaj"}
        </button>
      </div>

      {message ? (
        <p className={`mt-3 text-sm font-medium ${message.type === "success" ? "text-emerald-700" : "text-rose-600"}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
