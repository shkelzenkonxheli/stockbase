import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requirePurchasesAccess } from "@/lib/purchases-access";
import { calculatePurchaseOrderMetrics } from "@/lib/purchase-order-metrics";
import { prisma } from "@/lib/prisma";
import { SuppliersManager } from "./suppliers-manager";

export const metadata: Metadata = {
  title: "Suppliers",
};

type SuppliersPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    edit?: string;
    add?: string;
  }>;
};

async function createSupplier(formData: FormData) {
  "use server";

  const currentUser = await requirePurchasesAccess();
  const tenantId = currentUser.tenant?.id;

  const name = formData.get("name")?.toString().trim() ?? "";
  const phone = formData.get("phone")?.toString().trim() || null;
  const email = formData.get("email")?.toString().trim().toLowerCase() || null;
  const address = formData.get("address")?.toString().trim() || null;
  const notes = formData.get("notes")?.toString().trim() || null;

  if (!tenantId || !name) {
    redirect("/suppliers?error=validation&add=1");
  }

  const existing = await prisma.supplier.findFirst({
    where: {
      tenantId,
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existing) {
    redirect("/suppliers?error=duplicate&add=1");
  }

  await prisma.supplier.create({
    data: {
      tenantId,
      name,
      phone,
      email,
      address,
      notes,
    },
  });

  revalidatePath("/suppliers");
  redirect("/suppliers?success=created");
}

async function updateSupplier(formData: FormData) {
  "use server";

  const currentUser = await requirePurchasesAccess();
  const tenantId = currentUser.tenant?.id;
  const supplierId = Number(formData.get("supplierId"));

  const name = formData.get("name")?.toString().trim() ?? "";
  const phone = formData.get("phone")?.toString().trim() || null;
  const email = formData.get("email")?.toString().trim().toLowerCase() || null;
  const address = formData.get("address")?.toString().trim() || null;
  const notes = formData.get("notes")?.toString().trim() || null;
  const isActive = formData.get("isActive")?.toString() === "on";

  if (!tenantId || !supplierId || !name) {
    redirect(`/suppliers?error=validation&edit=${supplierId || ""}`);
  }

  const existing = await prisma.supplier.findFirst({
    where: {
      tenantId,
      id: { not: supplierId },
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existing) {
    redirect(`/suppliers?error=duplicate&edit=${supplierId}`);
  }

  await prisma.supplier.updateMany({
    where: { id: supplierId, tenantId },
    data: {
      name,
      phone,
      email,
      address,
      notes,
      isActive,
    },
  });

  revalidatePath("/suppliers");
  redirect("/suppliers?success=updated");
}

async function toggleSupplierStatus(formData: FormData) {
  "use server";

  const currentUser = await requirePurchasesAccess();
  const tenantId = currentUser.tenant?.id;
  const supplierId = Number(formData.get("supplierId"));
  const nextActive = formData.get("nextActive")?.toString() === "true";

  if (!tenantId || !supplierId) {
    redirect("/suppliers?error=validation");
  }

  await prisma.supplier.updateMany({
    where: { id: supplierId, tenantId },
    data: { isActive: nextActive },
  });

  revalidatePath("/suppliers");
  redirect(`/suppliers?success=${nextActive ? "restored" : "archived"}`);
}

function getMessage(error?: string, success?: string) {
  if (error === "validation") {
    return { type: "error" as const, text: "Ploteso te pakten emrin e furnitorit." };
  }
  if (error === "duplicate") {
    return { type: "error" as const, text: "Ky furnitor ekziston tashme me kete emer." };
  }
  if (success === "created") {
    return { type: "success" as const, text: "Furnitori u krijua me sukses." };
  }
  if (success === "updated") {
    return { type: "success" as const, text: "Furnitori u perditesua me sukses." };
  }
  if (success === "archived") {
    return { type: "success" as const, text: "Furnitori u caktivizua." };
  }
  if (success === "restored") {
    return { type: "success" as const, text: "Furnitori u aktivizua perseri." };
  }
  return null;
}

function formatMoney(value: number) {
  return `${value.toFixed(2)} EUR`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const currentUser = await requirePurchasesAccess();
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const message = getMessage(resolvedSearchParams?.error, resolvedSearchParams?.success);
  const editingId = Number(resolvedSearchParams?.edit ?? "");
  const addOpen = resolvedSearchParams?.add === "1";

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      purchaseOrders: {
        orderBy: [{ createdAt: "desc" }],
        include: {
          items: {
            select: {
              orderedQuantity: true,
              receivedQuantity: true,
              returnedQuantity: true,
              unitCost: true,
            },
          },
        },
      },
    },
  });

  const activeCount = suppliers.filter((supplier) => supplier.isActive).length;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-emerald-100 bg-[linear-gradient(135deg,#f7fffb_0%,#ffffff_52%,#edf9f2_100%)] px-5 py-6 shadow-[0_20px_55px_rgba(16,185,129,0.10)] sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Purchasing / Suppliers
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
                Furnitoret
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Ketu i regjistron furnitoret qe me vone do lidhen me purchase orders,
                receiving stock dhe kostot blerese.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-slate-600 shadow-sm">
                  {suppliers.length} furnitore total
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700 shadow-sm">
                  {activeCount} aktive
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white/92 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                Ballina
              </Link>
            </div>
          </div>
        </section>

        {message ? (
          <FlashMessage
            type={message.type}
            text={message.text}
            className="rounded-2xl px-4 py-3 text-sm shadow-sm"
          />
        ) : null}

        <SuppliersManager
          createAction={createSupplier}
          updateAction={updateSupplier}
          toggleAction={toggleSupplierStatus}
          suppliers={suppliers.map((supplier) => ({
            ...(function () {
              const metricsPerOrder = supplier.purchaseOrders.map((order) =>
                calculatePurchaseOrderMetrics(
                  order.items.map((item) => ({
                    orderedQuantity: item.orderedQuantity,
                    receivedQuantity: item.receivedQuantity,
                    returnedQuantity: item.returnedQuantity,
                    unitCost: Number(item.unitCost),
                  })),
                ),
              );
              const totalOrders = supplier.purchaseOrders.length;
              const totalOrderedValue = metricsPerOrder.reduce(
                (sum, order) => sum + order.totalOrderedValue,
                0,
              );
              const totalReceivedValue = metricsPerOrder.reduce(
                (sum, order) => sum + order.totalReceivedValue,
                0,
              );
              const totalReturnedValue = metricsPerOrder.reduce(
                (sum, order) => sum + order.totalReturnedValue,
                0,
              );
              const openOrders = supplier.purchaseOrders.filter((order) =>
                ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED", "PARTIALLY_RETURNED"].includes(order.status),
              ).length;
              return {
                totalOrders,
                totalOrderedValue,
                totalReceivedValue,
                totalReturnedValue,
                openOrders,
                averageOrderValue: totalOrders > 0 ? totalOrderedValue / totalOrders : 0,
                lastOrderLabel: supplier.purchaseOrders[0]?.orderedAt
                  ? formatDate(supplier.purchaseOrders[0].orderedAt)
                  : null,
              };
            })(),
            id: supplier.id,
            name: supplier.name,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            notes: supplier.notes,
            isActive: supplier.isActive,
            totalValue: formatMoney(
              supplier.purchaseOrders.reduce(
                (sum, order) =>
                  sum +
                  order.items.reduce(
                    (orderSum, item) => orderSum + Number(item.unitCost) * item.orderedQuantity,
                    0,
                  ),
                0,
              ),
            ),
            recentOrders: supplier.purchaseOrders.slice(0, 5).map((order) => ({
              id: order.id,
              status: order.status,
              orderedAtLabel: formatDate(order.orderedAt),
              totalLabel: formatMoney(
                order.items.reduce(
                  (sum, item) => sum + Number(item.unitCost) * item.orderedQuantity,
                  0,
                ),
              ),
              itemCount: order.items.length,
            })),
          }))}
          addOpen={addOpen}
          editingId={Number.isInteger(editingId) && editingId > 0 ? editingId : null}
          message={message}
        />
      </div>
    </main>
  );
}
