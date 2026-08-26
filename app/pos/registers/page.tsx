import type { Metadata } from "next";
import Link from "next/link";
import { getTenantPosLocations, getTenantPosRegisters, requirePosAdmin } from "@/lib/pos";
import { PosRegistersManager } from "./pos-registers-manager";

export const metadata: Metadata = {
  title: "POS Registers",
};

export default async function PosRegistersPage() {
  const currentUser = await requirePosAdmin();
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    return null;
  }

  const [locations, registers] = await Promise.all([
    getTenantPosLocations(tenantId),
    getTenantPosRegisters(tenantId),
  ]);

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white/96 px-5 py-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                POS Management
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Locations & Registers
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Riperdor depot/lokacionet ekzistuese si store POS dhe krijo register-at pa duplikuar arkitekturen e StockBase.
              </p>
            </div>
            <Link
              href="/pos/open"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Open Register
            </Link>
          </div>
        </section>

        <PosRegistersManager locations={locations} registers={registers} />
      </div>
    </main>
  );
}
