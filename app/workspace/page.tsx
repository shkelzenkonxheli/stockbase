import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { getOperationalGroups } from "@/lib/operational-navigation";
import {
  getBarcodeConfig,
  getInventoryCountConfig,
  getMultiWarehouseConfig,
  getPosConfig,
  getPurchasesConfig,
  getSocialMediaConfig,
} from "@/lib/product-taxonomy";
import { OperationalLauncher } from "./operational-launcher";

export const metadata: Metadata = { title: "Veprimet" };

export default async function WorkspacePage() {
  const user = await requireUser();
  if (!user.tenant) {
    if (isPlatformAdmin(user)) redirect("/platform/tenants");
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">Nuk ka biznes te lidhur me kete llogari.</h1>
        <p className="text-slate-600">Kontakto administratorin per qasje.</p>
        <form action={logout}><button type="submit" className="rounded-xl bg-emerald-950 px-5 py-3 font-semibold text-white">Dil</button></form>
      </main>
    );
  }

  const config = user.tenant.catalogConfig;
  const groups = getOperationalGroups({
    role: user.role,
    pos: getPosConfig(config).enabled,
    purchases: getPurchasesConfig(config).enabled,
    barcode: getBarcodeConfig(config).enabled,
    inventoryCount: getInventoryCountConfig(config).enabled,
    multiWarehouse: getMultiWarehouseConfig(config).enabled,
    socialMedia: getSocialMediaConfig(config).enabled,
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_80%_0%,#d8f4e4_0%,transparent_32%),linear-gradient(135deg,#f8faf6_0%,#eaf3f0_100%)] px-4 py-5 text-slate-950 sm:px-7 sm:py-7 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-900/10 pb-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-950 text-lg font-black text-white shadow-sm">S</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">{user.tenant.businessName || user.tenant.name}</p>
              <p className="text-xs text-slate-500">StockBase / Veprimet</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-40 truncate text-sm text-slate-600 sm:inline">{user.name}</span>
            <form action={logout}>
              <button type="submit" className="rounded-xl border border-emerald-900/15 bg-white/80 px-4 py-2.5 text-sm font-semibold transition hover:bg-white">Dil</button>
            </form>
          </div>
        </header>
        <OperationalLauncher groups={groups} />
      </div>
    </main>
  );
}
