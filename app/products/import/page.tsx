import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantWarehouses } from "@/lib/warehouses";
import { ProductImportWizard } from "./import-wizard";

export const metadata: Metadata = {
  title: "Importo produkte",
};

export default async function ProductImportPage() {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    return null;
  }

  const [categories, warehouses] = await Promise.all([
    prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    getTenantWarehouses(tenantId, currentUser.tenant?.catalogConfig),
  ]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ecfeff_0%,transparent_20%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Produktet
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Import nga Excel / CSV
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Kthehu te produktet
            </Link>
          </div>
        </div>

        <ProductImportWizard
          categories={categories.map((category) => category.name)}
          warehouses={warehouses.map((warehouse) => warehouse.name)}
        />
      </div>
    </main>
  );
}