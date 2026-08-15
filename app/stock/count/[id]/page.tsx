import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { BulkSelectToggle } from "./bulk-select-toggle";
import { InventoryCountFilters } from "./inventory-count-filters";
import { requireRole } from "@/lib/auth";
import {
  filterInventoryCountLines,
  formatInventoryDifference,
  normalizeInventoryCountFilter,
} from "@/lib/inventory-counts";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

type InventoryCountDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    error?: string;
    success?: string;
    q?: string;
    filter?: string;
    category?: string;
    model?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Detajet e Numerimit",
};

function getMessage(error?: string, success?: string) {
  if (error === "validation") {
    return { type: "error" as const, text: "Ploteso sasite valide per numerimin." };
  }
  if (error === "selection") {
    return { type: "error" as const, text: "Zgjedh te pakten nje rresht per veprimin masiv." };
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
  if (success === "bulk_counted") {
    return { type: "success" as const, text: "Rreshtat e zgjedhur u shenuan si te numeruar." };
  }
  if (success === "bulk_cleared") {
    return { type: "success" as const, text: "Vlerat e rreshtave te zgjedhur u pastruan." };
  }
  if (success === "bulk_noted") {
    return { type: "success" as const, text: "Shenimi u vendos te rreshtat e zgjedhur." };
  }
  return null;
}

function parseSelectedLineIds(formData: FormData) {
  return formData
    .getAll("selectedLineIds")
    .map((value) => Number(value.toString()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function buildCountReturnUrl(sessionId: number, formData: FormData, state?: { error?: string; success?: string }) {
  const params = new URLSearchParams();
  const query = formData.get("returnQuery")?.toString().trim() ?? "";
  const filter = formData.get("returnFilter")?.toString().trim() ?? "";
  const category = formData.get("returnCategory")?.toString().trim() ?? "";
  const model = formData.get("returnModel")?.toString().trim() ?? "";

  if (query) {
    params.set("q", query);
  }

  if (filter && filter !== "all") {
    params.set("filter", filter);
  }

  if (category) {
    params.set("category", category);
  }

  if (model) {
    params.set("model", model);
  }

  if (state?.error) {
    params.set("error", state.error);
  }

  if (state?.success) {
    params.set("success", state.success);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return `/stock/count/${sessionId}${suffix}#details`;
}

async function saveCountDraft(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const sessionId = Number(formData.get("sessionId"));
  const lineIdsRaw = formData.get("lineIds")?.toString();

  if (!tenantId || !sessionId || !lineIdsRaw) {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "validation" }));
  }

  const lineIds = lineIdsRaw
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (lineIds.length === 0) {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "validation" }));
  }

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { id: true, status: true },
  });

  if (!session) {
    notFound();
  }

  if (session.status === "COMPLETED") {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "completed" }));
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
        redirect(buildCountReturnUrl(sessionId, formData, { error: "validation" }));
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
  redirect(buildCountReturnUrl(sessionId, formData, { success: "saved" }));
}

async function finalizeCount(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const sessionId = Number(formData.get("sessionId"));
  const lineIdsRaw = formData.get("allLineIds")?.toString();

  if (!tenantId || !sessionId || !lineIdsRaw) {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "validation" }));
  }

  const lineIds = lineIdsRaw
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (lineIds.length === 0) {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "validation" }));
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
    redirect(buildCountReturnUrl(sessionId, formData, { error: "completed" }));
  }

  const missingCount = session.lines.some((line) => line.countedStock === null);
  if (missingCount) {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "validation" }));
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
  redirect(buildCountReturnUrl(sessionId, formData, { success: "completed" }));
}

async function markSelectedAsCounted(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const sessionId = Number(formData.get("sessionId"));
  const selectedLineIds = parseSelectedLineIds(formData);

  if (!tenantId || !sessionId || selectedLineIds.length === 0) {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "selection" }));
  }

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { id: true, status: true },
  });

  if (!session) {
    notFound();
  }

  if (session.status === "COMPLETED") {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "completed" }));
  }

  const selectedLines = await prisma.inventoryCountLine.findMany({
    where: {
      sessionId,
      id: { in: selectedLineIds },
    },
    select: {
      id: true,
      expectedStock: true,
    },
  });

  await prisma.$transaction(async (tx) => {
    for (const line of selectedLines) {
      await tx.inventoryCountLine.update({
        where: { id: line.id },
        data: {
          countedStock: line.expectedStock,
          difference: 0,
          countedAt: new Date(),
        },
      });
    }
  });

  revalidatePath(`/stock/count/${sessionId}`);
  redirect(buildCountReturnUrl(sessionId, formData, { success: "bulk_counted" }));
}

async function clearSelectedCounted(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const sessionId = Number(formData.get("sessionId"));
  const selectedLineIds = parseSelectedLineIds(formData);

  if (!tenantId || !sessionId || selectedLineIds.length === 0) {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "selection" }));
  }

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { id: true, status: true },
  });

  if (!session) {
    notFound();
  }

  if (session.status === "COMPLETED") {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "completed" }));
  }

  await prisma.inventoryCountLine.updateMany({
    where: {
      sessionId,
      id: { in: selectedLineIds },
    },
    data: {
      countedStock: null,
      difference: null,
      countedAt: null,
    },
  });

  revalidatePath(`/stock/count/${sessionId}`);
  redirect(buildCountReturnUrl(sessionId, formData, { success: "bulk_cleared" }));
}

async function applyNoteToSelected(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const sessionId = Number(formData.get("sessionId"));
  const selectedLineIds = parseSelectedLineIds(formData);
  const bulkNote = formData.get("bulkNote")?.toString().trim() ?? "";

  if (!tenantId || !sessionId || selectedLineIds.length === 0) {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "selection" }));
  }

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId },
    select: { id: true, status: true },
  });

  if (!session) {
    notFound();
  }

  if (session.status === "COMPLETED") {
    redirect(buildCountReturnUrl(sessionId, formData, { error: "completed" }));
  }

  await prisma.inventoryCountLine.updateMany({
    where: {
      sessionId,
      id: { in: selectedLineIds },
    },
    data: {
      note: bulkNote || null,
    },
  });

  revalidatePath(`/stock/count/${sessionId}`);
  redirect(buildCountReturnUrl(sessionId, formData, { success: "bulk_noted" }));
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
  const searchQuery = resolvedSearchParams?.q?.trim() ?? "";
  const filter = normalizeInventoryCountFilter(resolvedSearchParams?.filter);
  const selectedCategory = resolvedSearchParams?.category?.trim() ?? "";
  const selectedModel = resolvedSearchParams?.model?.trim() ?? "";

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

  const shouldShowLines = Boolean(
    selectedCategory || selectedModel || searchQuery || filter !== "all",
  );
  const filteredLines = shouldShowLines
    ? filterInventoryCountLines(
        session.lines,
        searchQuery,
        filter,
        selectedCategory,
        selectedModel,
      )
    : [];
  const visibleLineIds = filteredLines.map((line) => line.id).join(",");
  const allLineIds = session.lines.map((line) => line.id).join(",");
  const countedLines = session.lines.filter((line) => line.countedStock !== null).length;
  const changedLines = session.lines.filter((line) => (line.difference ?? 0) !== 0).length;
  const exportParams = new URLSearchParams();
  const categoryOptions = [...new Set(session.lines.map((line) => line.variant.product.category.name))];
  const modelOptionsByCategory = Object.fromEntries(
    categoryOptions.map((categoryOption) => [
      categoryOption,
      [
        ...new Set(
          session.lines
            .filter((line) => line.variant.product.category.name === categoryOption)
            .map((line) => line.variant.product.name),
        ),
      ],
    ]),
  );

  if (searchQuery) {
    exportParams.set("q", searchQuery);
  }

  if (filter !== "all") {
    exportParams.set("filter", filter);
  }

  if (selectedCategory) {
    exportParams.set("category", selectedCategory);
  }

  if (selectedModel) {
    exportParams.set("model", selectedModel);
  }

  const exportSuffix = exportParams.toString() ? `?${exportParams.toString()}` : "";

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-emerald-100 bg-[linear-gradient(135deg,#f7fffb_0%,#ffffff_52%,#edf9f2_100%)] px-5 py-6 shadow-[0_20px_55px_rgba(16,185,129,0.10)] sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Inventory Count</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Numerim #{session.id}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {session.warehouse.name} · {session.createdBy?.name ?? "Sistem"} · {" "}
                {new Date(session.createdAt).toLocaleString("sq-AL")}
              </p>
            </div>
            <Link
              href="/stock/count"
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Kthehu te numerimet
            </Link>
          </div>
        </section>

        {message ? <FlashMessage type={message.type} text={message.text} /> : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[24px] border border-emerald-100 bg-white px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Rreshta</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{session.lines.length}</p>
          </div>
          <div className="rounded-[24px] border border-emerald-100 bg-white px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Te numeruara</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{countedLines}</p>
          </div>
          <div className="rounded-[24px] border border-emerald-100 bg-white px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Me diference</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{changedLines}</p>
          </div>
        </section>

        <section className="rounded-[30px] border border-emerald-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="border-b border-emerald-100 bg-[linear-gradient(180deg,#fcfffd_0%,#f3fbf6_100%)] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Rreshtat e numerimit</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {shouldShowLines
                    ? `${filteredLines.length} nga ${session.lines.length} rreshta te shfaqur`
                    : "Zgjedh kategori, model, search ose status per te shfaqur listen."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/stock/count/${session.id}/export.csv${exportSuffix}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  Export CSV
                </Link>
                <Link
                  href={`/stock/count/${session.id}/export.pdf${exportSuffix}`}
                  target="_blank"
                  className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  Print / PDF
                </Link>
              </div>
            </div>
          </div>

          <InventoryCountFilters
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            selectedModel={selectedModel}
            selectedFilter={filter}
            categoryOptions={categoryOptions}
            modelOptionsByCategory={modelOptionsByCategory}
            warehouseId={session.warehouseId}
          />
        </section>

        <form action={saveCountDraft} className="space-y-6">
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="lineIds" value={visibleLineIds} />
          <input type="hidden" name="allLineIds" value={allLineIds} />
          <input type="hidden" name="returnQuery" value={searchQuery} />
          <input type="hidden" name="returnFilter" value={filter} />
          <input type="hidden" name="returnCategory" value={selectedCategory} />
          <input type="hidden" name="returnModel" value={selectedModel} />

          <section
            id="details"
            className="rounded-[30px] border border-emerald-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
          >
            <div className="border-b border-emerald-100 bg-[linear-gradient(180deg,#fcfffd_0%,#f3fbf6_100%)] px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <h3 className="text-lg font-semibold text-slate-950">Detajet</h3>
                  {session.status === "OPEN" && shouldShowLines ? (
                    <BulkSelectToggle label="Zgjedh te gjitha te dukshmet" />
                  ) : null}
                </div>

                {session.status === "OPEN" && shouldShowLines ? (
                  <div className="grid gap-3 rounded-[24px] border border-emerald-100 bg-emerald-50/55 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                    <input
                      type="text"
                      name="bulkNote"
                      placeholder="Shenim per rreshtat e zgjedhur"
                      className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                    <button
                      type="submit"
                      formAction={applyNoteToSelected}
                      className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      Vendos shenim
                    </button>
                    <button
                      type="submit"
                      formAction={markSelectedAsCounted}
                      className="inline-flex items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Mark as counted
                    </button>
                    <button
                      type="submit"
                      formAction={clearSelectedCounted}
                      className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Clear selected
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {shouldShowLines ? <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-[linear-gradient(180deg,#f6fdf8_0%,#eef8f1_100%)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  <tr>
                    <th className="px-5 py-4">Zgjedh</th>
                    <th className="px-5 py-4">Produkti</th>
                    <th className="px-5 py-4">Varianti</th>
                    <th className="px-5 py-4">Lokacioni</th>
                    <th className="px-5 py-4">Stoku sistem</th>
                    <th className="px-5 py-4">Stoku real</th>
                    <th className="px-5 py-4">Diferenca</th>
                    <th className="px-5 py-4">Shenim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50 bg-white">
                  {filteredLines.map((line) => {
                    const countedStock = line.countedStock ?? "";
                    const difference = line.countedStock === null ? null : line.countedStock - line.expectedStock;

                    return (
                      <tr key={line.id} className="align-top">
                        <td className="px-5 py-4">
                          {session.status === "OPEN" ? (
                            <input
                              type="checkbox"
                              name="selectedLineIds"
                              value={line.id}
                              className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-200"
                            />
                          ) : null}
                        </td>
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
                            className="w-24 rounded-xl border border-emerald-100 px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                          />
                        </td>
                        <td
                          className={`px-5 py-4 font-semibold ${
                            difference === null
                              ? "text-slate-400"
                              : difference === 0
                                ? "text-slate-600"
                                : difference > 0
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                          }`}
                        >
                          {formatInventoryDifference(difference)}
                        </td>
                        <td className="px-5 py-4">
                          <input
                            type="text"
                            name={`note_${line.id}`}
                            defaultValue={line.note ?? ""}
                            disabled={session.status === "COMPLETED"}
                            className="w-full rounded-xl border border-emerald-100 px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div> : null}

            {shouldShowLines ? <div className="grid gap-4 px-4 py-4 lg:hidden">
              {filteredLines.map((line) => {
                const countedStock = line.countedStock ?? "";
                const difference = line.countedStock === null ? null : line.countedStock - line.expectedStock;

                return (
                  <article key={line.id} className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#fbfefc_100%)] p-4">
                    {session.status === "OPEN" ? (
                      <label className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          name="selectedLineIds"
                          value={line.id}
                          className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-200"
                        />
                        Zgjedh kete rresht
                      </label>
                    ) : null}
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
                          className="rounded-xl border border-emerald-100 px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700">
                        Shenim
                        <input
                          type="text"
                          name={`note_${line.id}`}
                          defaultValue={line.note ?? ""}
                          disabled={session.status === "COMPLETED"}
                          className="rounded-xl border border-emerald-100 px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50"
                        />
                      </label>
                    </div>

                    <p
                      className={`mt-4 text-sm font-semibold ${
                        difference === null
                          ? "text-slate-400"
                          : difference === 0
                            ? "text-slate-600"
                            : difference > 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                      }`}
                    >
                      Diferenca: {formatInventoryDifference(difference)}
                    </p>
                  </article>
                );
              })}
            </div> : null}

            {!shouldShowLines ? (
              <div className="border-t border-slate-100 px-6 py-12 text-center text-sm text-slate-500">
                Fillimisht zgjedh nje kategori, model, search ose status, pastaj lista do shfaqet sipas filtrimit.
              </div>
            ) : filteredLines.length === 0 ? (
              <div className="border-t border-slate-100 px-6 py-12 text-center text-sm text-slate-500">
                Nuk u gjet asnje rresht me filtrat aktuale.
              </div>
            ) : null}
          </section>

          {session.status === "OPEN" && shouldShowLines ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                Ruaj draftin
              </button>
              <button
                formAction={finalizeCount}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Perfundo numerimin
              </button>
            </div>
          ) : null}

          {session.status === "COMPLETED" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Ky numerim eshte perfunduar nga {session.completedBy?.name ?? "Sistem"} me{" "}
              {session.completedAt ? new Date(session.completedAt).toLocaleString("sq-AL") : "-"}.
            </div>
          ) : null}
        </form>
      </div>
    </main>
  );
}

