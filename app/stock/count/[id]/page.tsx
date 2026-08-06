import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

type InventoryCountDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Detajet e Numerimit",
};

function getMessage(error?: string, success?: string) {
  if (error === "validation") {
    return { type: "error" as const, text: "Ploteso sasite valide per numerimin." };
  }
  if (error === "completed") {
    return { type: "error" as const, text: "Ky numerim eshte perfunduar dhe nuk mund te ndryshohet." };
  }
  if (success === "saved") {
    return { type: "success" as const, text: "Numerimi u ruajt si draft." };
  }
  if (success === "completed") {
    return { type: "success" as const, text: "Numerimi u perfundua dhe stoku u perditesua." };
  }
  return null;
}

async function saveCountDraft(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const sessionId = Number(formData.get("sessionId"));
  const lineIdsRaw = formData.get("lineIds")?.toString();

  if (!tenantId || !sessionId || !lineIdsRaw) {
    redirect(`/stock/count/${sessionId}?error=validation`);
  }

  const lineIds = lineIdsRaw
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (lineIds.length === 0) {
    redirect(`/stock/count/${sessionId}?error=validation`);
  }

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { id: true, status: true },
  });

  if (!session) {
    notFound();
  }

  if (session.status === "COMPLETED") {
    redirect(`/stock/count/${sessionId}?error=completed`);
  }

  await prisma.$transaction(async (tx) => {
    for (const lineId of lineIds) {
      const countedValue = formData.get(`counted_${lineId}`)?.toString().trim();
      const noteValue = formData.get(`note_${lineId}`)?.toString().trim() || null;

      if (countedValue === undefined || countedValue === "") {
        await tx.inventoryCountLine.update({
          where: { id: lineId },
          data: {
            countedStock: null,
            difference: null,
            note: noteValue,
            countedAt: null,
          },
        });
        continue;
      }

      const countedStock = Number(countedValue);

      if (!Number.isInteger(countedStock) || countedStock < 0) {
        redirect(`/stock/count/${sessionId}?error=validation`);
      }

      const line = await tx.inventoryCountLine.findUnique({
        where: { id: lineId },
        select: { expectedStock: true },
      });

      if (!line) {
        continue;
      }

      await tx.inventoryCountLine.update({
        where: { id: lineId },
        data: {
          countedStock,
          difference: countedStock - line.expectedStock,
          note: noteValue,
          countedAt: new Date(),
        },
      });
    }
  });

  revalidatePath(`/stock/count/${sessionId}`);
  redirect(`/stock/count/${sessionId}?success=saved`);
}

async function finalizeCount(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const sessionId = Number(formData.get("sessionId"));
  const lineIdsRaw = formData.get("lineIds")?.toString();

  if (!tenantId || !sessionId || !lineIdsRaw) {
    redirect(`/stock/count/${sessionId}?error=validation`);
  }

  const lineIds = lineIdsRaw
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (lineIds.length === 0) {
    redirect(`/stock/count/${sessionId}?error=validation`);
  }

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId },
    select: {
      id: true,
      status: true,
      warehouseId: true,
      warehouse: { select: { name: true } },
      lines: {
        where: { id: { in: lineIds } },
        select: {
          id: true,
          variantId: true,
          expectedStock: true,
          countedStock: true,
          difference: true,
          locationCode: true,
          variant: {
            select: {
              id: true,
              stock: true,
              size: true,
              color: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    notFound();
  }

  if (session.status === "COMPLETED") {
    redirect(`/stock/count/${sessionId}?error=completed`);
  }

  const missingCount = session.lines.some((line) => line.countedStock === null);
  if (missingCount) {
    redirect(`/stock/count/${sessionId}?error=validation`);
  }

  await prisma.$transaction(async (tx) => {
    const summary: Array<{
      variantId: number;
      size: string;
      color: string;
      expectedStock: number;
      countedStock: number;
      difference: number;
    }> = [];

    for (const line of session.lines) {
      const countedStock = line.countedStock ?? 0;
      const difference = countedStock - line.expectedStock;

      await tx.inventoryCountLine.update({
        where: { id: line.id },
        data: {
          countedStock,
          difference,
          countedAt: new Date(),
        },
      });

      await tx.variantInventory.updateMany({
        where: {
          variantId: line.variantId,
          warehouseId: session.warehouseId,
        },
        data: {
          stock: countedStock,
        },
      });

      if (difference !== 0) {
        await tx.variant.update({
          where: { id: line.variantId },
          data: {
            stock: {
              increment: difference,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            variantId: line.variantId,
            warehouseId: session.warehouseId,
            quantity: difference,
            reason: "INVENTORY_COUNT",
          },
        });
      }

      summary.push({
        variantId: line.variantId,
        size: line.variant.size,
        color: line.variant.color,
        expectedStock: line.expectedStock,
        countedStock,
        difference,
      });
    }

    await tx.inventoryCountSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedById: currentUser.id,
      },
    });

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "INVENTORY_COUNT_COMPLETED",
      entityType: "INVENTORY_COUNT",
      entityId: session.id,
      entityLabel: `Numerim #${session.id}`,
      warehouseId: session.warehouseId,
      metadata: {
        warehouseName: session.warehouse.name,
        lines: summary.length,
        changes: summary.filter((item) => item.difference !== 0),
      },
    });
  });

  revalidatePath("/stock/count");
  revalidatePath(`/stock/count/${sessionId}`);
  revalidatePath("/products");
  redirect(`/stock/count/${sessionId}?success=completed`);
}

export default async function InventoryCountDetailPage({
  params,
  searchParams,
}: InventoryCountDetailPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const { id } = await params;
  const sessionId = Number(id);

  if (!tenantId || Number.isNaN(sessionId)) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const message = getMessage(resolvedSearchParams?.error, resolvedSearchParams?.success);

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId },
    include: {
      warehouse: { select: { name: true } },
      createdBy: { select: { name: true } },
      completedBy: { select: { name: true } },
      lines: {
        include: {
          variant: {
            select: {
              id: true,
              size: true,
              color: true,
              imagePath: true,
              sku: true,
              product: {
                select: {
                  name: true,
                  brand: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { variant: { product: { name: "asc" } } },
          { variant: { color: "asc" } },
          { variant: { size: "asc" } },
        ],
      },
    },
  });

  if (!session) {
    notFound();
  }

  const lineIds = session.lines.map((line) => line.id).join(",");
  const countedLines = session.lines.filter((line) => line.countedStock !== null).length;
  const changedLines = session.lines.filter((line) => (line.difference ?? 0) !== 0).length;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Inventory Count</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Numerim #{session.id}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {session.warehouse.name} · {session.createdBy?.name ?? "Sistem"} ·{" "}
                {new Date(session.createdAt).toLocaleString("sq-AL")}
              </p>
            </div>
            <Link
              href="/stock/count"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Kthehu te numerimet
            </Link>
          </div>
        </section>

        {message ? <FlashMessage type={message.type} text={message.text} /> : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Rreshta</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{session.lines.length}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Te numeruara</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{countedLines}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Me diference</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{changedLines}</p>
          </div>
        </section>

        <form action={saveCountDraft} className="space-y-6">
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="lineIds" value={lineIds} />

          <section className="rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 className="text-xl font-semibold text-slate-950">Rreshtat e numerimit</h2>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Produkti</th>
                    <th className="px-5 py-4">Varianti</th>
                    <th className="px-5 py-4">Lokacioni</th>
                    <th className="px-5 py-4">Stoku sistem</th>
                    <th className="px-5 py-4">Stoku real</th>
                    <th className="px-5 py-4">Diferenca</th>
                    <th className="px-5 py-4">Shenim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {session.lines.map((line) => {
                    const countedStock = line.countedStock ?? "";
                    const difference =
                      typeof line.countedStock === "number" ? line.countedStock - line.expectedStock : null;

                    return (
                      <tr key={line.id} className="align-top">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                              {line.variant.imagePath ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={line.variant.imagePath} alt={line.variant.product.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">IMG</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-950">
                                {line.variant.product.brand
                                  ? `${line.variant.product.brand} ${line.variant.product.name}`
                                  : line.variant.product.name}
                              </p>
                              <p className="truncate text-xs text-slate-500">{line.variant.product.category.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {line.variant.color} / {line.variant.size}
                        </td>
                        <td className="px-5 py-4 text-slate-700">{line.locationCode ?? "-"}</td>
                        <td className="px-5 py-4 font-semibold text-slate-900">{line.expectedStock}</td>
                        <td className="px-5 py-4">
                          <input
                            type="number"
                            min={0}
                            name={`counted_${line.id}`}
                            defaultValue={countedStock}
                            disabled={session.status === "COMPLETED"}
                            className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300 disabled:bg-slate-50"
                          />
                        </td>
                        <td className={`px-5 py-4 font-semibold ${
                          difference === null ? "text-slate-400" : difference === 0 ? "text-slate-600" : difference > 0 ? "text-emerald-700" : "text-rose-700"
                        }`}>
                          {difference === null ? "-" : difference > 0 ? `+${difference}` : difference}
                        </td>
                        <td className="px-5 py-4">
                          <input
                            type="text"
                            name={`note_${line.id}`}
                            defaultValue={line.note ?? ""}
                            disabled={session.status === "COMPLETED"}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300 disabled:bg-slate-50"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 px-4 py-4 lg:hidden">
              {session.lines.map((line) => {
                const countedStock = line.countedStock ?? "";
                const difference =
                  typeof line.countedStock === "number" ? line.countedStock - line.expectedStock : null;

                return (
                  <article key={line.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        {line.variant.imagePath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={line.variant.imagePath} alt={line.variant.product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">IMG</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">
                          {line.variant.product.brand
                            ? `${line.variant.product.brand} ${line.variant.product.name}`
                            : line.variant.product.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{line.variant.product.category.name}</p>
                        <p className="mt-2 text-sm font-medium text-slate-700">
                          {line.variant.color} / {line.variant.size}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Stoku sistem</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{line.expectedStock}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Lokacioni</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{line.locationCode ?? "-"}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Stoku real
                        <input
                          type="number"
                          min={0}
                          name={`counted_${line.id}`}
                          defaultValue={countedStock}
                          disabled={session.status === "COMPLETED"}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300 disabled:bg-slate-50"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Shenim
                        <input
                          type="text"
                          name={`note_${line.id}`}
                          defaultValue={line.note ?? ""}
                          disabled={session.status === "COMPLETED"}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300 disabled:bg-slate-50"
                        />
                      </label>
                    </div>

                    <p className={`mt-4 text-sm font-semibold ${
                      difference === null ? "text-slate-400" : difference === 0 ? "text-slate-600" : difference > 0 ? "text-emerald-700" : "text-rose-700"
                    }`}>
                      Diferenca: {difference === null ? "-" : difference > 0 ? `+${difference}` : difference}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          {session.status === "OPEN" ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Ruaj draftin
              </button>
              <button
                formAction={finalizeCount}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Perfundo numerimin
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Ky numerim eshte perfunduar nga {session.completedBy?.name ?? "Sistem"} me{" "}
              {session.completedAt ? new Date(session.completedAt).toLocaleString("sq-AL") : "-"}.
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
