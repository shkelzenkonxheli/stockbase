import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { parseTenantCatalogConfig } from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import { getTenantWarehouses } from "@/lib/warehouses";

export const metadata: Metadata = {
  title: "Inventory Count",
};

type InventoryCountPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

async function createInventoryCount(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const warehouseId = Number(formData.get("warehouseId"));
  const note = formData.get("note")?.toString().trim() || null;

  if (!tenantId || !warehouseId) {
    redirect("/stock/count?error=validation");
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, tenantId },
    select: { id: true, name: true },
  });

  if (!warehouse) {
    redirect("/stock/count?error=warehouse");
  }

  const inventories = await prisma.variantInventory.findMany({
    where: {
      warehouseId,
      variant: {
        tenantId,
      },
    },
    select: {
      variantId: true,
      stock: true,
      locationCode: true,
    },
    orderBy: [{ stock: "desc" }, { variantId: "asc" }],
  });

  if (inventories.length === 0) {
    redirect("/stock/count?error=empty");
  }

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryCountSession.create({
      data: {
        tenantId,
        warehouseId,
        note,
        createdById: currentUser.id,
      },
    });

    await tx.inventoryCountLine.createMany({
      data: inventories.map((inventory) => ({
        sessionId: created.id,
        variantId: inventory.variantId,
        expectedStock: inventory.stock,
        locationCode: inventory.locationCode ?? null,
      })),
    });

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "INVENTORY_COUNT_CREATED",
      entityType: "INVENTORY_COUNT",
      entityId: created.id,
      entityLabel: `Numerim #${created.id}`,
      warehouseId,
      metadata: {
        note,
        lineCount: inventories.length,
      },
    });

    return created;
  });

  revalidatePath("/stock/count");
  redirect(`/stock/count/${session.id}`);
}

function getMessage(error?: string) {
  if (error === "validation") {
    return { type: "error" as const, text: "Zgjedh depon para se te krijosh numerimin." };
  }
  if (error === "warehouse") {
    return { type: "error" as const, text: "Depoja nuk u gjet." };
  }
  if (error === "empty") {
    return { type: "error" as const, text: "Kjo depo nuk ka asnje variant per numerim." };
  }
  return null;
}

export default async function InventoryCountPage({ searchParams }: InventoryCountPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const message = getMessage(resolvedSearchParams?.error);

  const tenantSettings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { catalogConfig: true },
  });

  const [warehouses, sessions] = await Promise.all([
    getTenantWarehouses(tenantId, parseTenantCatalogConfig(tenantSettings?.catalogConfig)),
    prisma.inventoryCountSession.findMany({
      where: { tenantId },
      include: {
        warehouse: { select: { name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Stock / Count</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Inventory Count
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Krijo nje numerim per depo, regjistro sasite reale dhe finalizo korrigjimin e stokut.
          </p>
        </section>

        {message ? <FlashMessage type={message.type} text={message.text} /> : null}

        <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form action={createInventoryCount} className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6">
            <h2 className="text-xl font-semibold text-slate-950">Numerim i ri</h2>
            <div className="mt-5 space-y-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Depoja
                <select
                  name="warehouseId"
                  required
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                >
                  <option value="">Zgjedh depon</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Shenim
                <textarea
                  name="note"
                  rows={4}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                  placeholder="p.sh. Numerim javor i Depo 1"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Krijo numerimin
              </button>
            </div>
          </form>

          <section className="rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 className="text-xl font-semibold text-slate-950">Numerimet e fundit</h2>
            </div>
            {sessions.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Ende nuk ka numerime te krijuara.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/stock/count/${session.id}`}
                    className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 sm:px-6 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-base font-semibold text-slate-950">Numerim #{session.id}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {session.warehouse.name} · {session._count.lines} variante · {session.createdBy?.name ?? "Sistem"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        session.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {session.status === "COMPLETED" ? "Perfunduar" : "Ne proces"}
                      </span>
                      <span className="text-sm text-slate-500">
                        {new Date(session.createdAt).toLocaleString("sq-AL")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
