import type { Metadata } from "next";
import Link from "next/link";
import { getOpenPosSessionForUser, getTenantPosLocations, getTenantPosRegisters, requirePosRole } from "@/lib/pos";
import { redirect } from "next/navigation";
import { OpenRegisterForm } from "./open-register-form";

export const metadata: Metadata = {
  title: "Open Register",
};

export default async function PosOpenPage() {
  const currentUser = await requirePosRole(["SUPER_ADMIN", "SELLER"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/");
  }

  const openSession = await getOpenPosSessionForUser(tenantId, currentUser.id);
  if (openSession) {
    redirect(`/pos/session/${openSession.id}`);
  }

  const [locations, registers] = await Promise.all([
    getTenantPosLocations(tenantId),
    getTenantPosRegisters(tenantId),
  ]);

  const posLocations = locations.filter((location) => location.supportsPos);
  const registerOptions = registers
    .filter((register) => register.warehouse.supportsPos)
    .map((register) => ({
      id: register.id,
      name: register.name,
      warehouseId: register.warehouseId,
      warehouseName: register.warehouse.name,
      isActive: register.isActive,
    }));

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {posLocations.length === 0 || registerOptions.length === 0 ? (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              POS Setup
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">POS nuk eshte gati ende</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
              Duhet te aktivizosh te pakten nje lokacion POS dhe nje register aktiv para se te hapesh nje session.
            </p>
            {currentUser.role === "SUPER_ADMIN" ? (
              <Link
                href="/pos/registers"
                className="mt-4 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Menaxho POS setup
              </Link>
            ) : null}
          </section>
        ) : (
          <OpenRegisterForm
            cashierName={currentUser.name}
            locations={posLocations.map((location) => ({ id: location.id, name: location.name }))}
            registers={registerOptions}
          />
        )}
      </div>
    </main>
  );
}
