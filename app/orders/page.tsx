import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/app/generated/prisma/client";
import { hasRole, requireRole, requireUser } from "@/lib/auth";
import { getOrderListViewConfig, parseTenantCatalogConfig } from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import { OrdersFilters } from "./orders-filters";
import { OrdersManager } from "./orders-manager";

const PAGE_SIZE = 20;
const BUSINESS_TIME_ZONE = "Europe/Belgrade";

type OrdersPageProps = {
  searchParams?: Promise<{
    page?: string;
    q?: string;
    source?: string;
    date?: string;
  }>;
};

type OrderSourceValue = "INSTAGRAM" | "STORE" | "WHOLESALE";

function getDateStringInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const zonedTimeAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return zonedTimeAsUtc - date.getTime();
}

function getTimeZoneDayBounds(dateString: string, timeZone: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  const startApprox = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const endApprox = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));

  const startOffset = getTimeZoneOffsetMs(startApprox, timeZone);
  const endOffset = getTimeZoneOffsetMs(endApprox, timeZone);

  return {
    start: new Date(startApprox.getTime() - startOffset),
    end: new Date(endApprox.getTime() - endOffset),
  };
}

function buildOrdersPageHref(
  page: number,
  q: string,
  source: string,
  date: string,
) {
  const params = new URLSearchParams();
  params.set("page", String(page));

  if (q) {
    params.set("q", q);
  }
  if (source) {
    params.set("source", source);
  }
  if (date) {
    params.set("date", date);
  }

  return `/orders?${params.toString()}`;
}

const statusStyles: Record<string, string> = {
  NEW: "bg-amber-50 text-amber-700 border-amber-200",
  READY: "bg-sky-50 text-sky-700 border-sky-200",
  DONE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELED: "bg-rose-50 text-rose-700 border-rose-200",
};

const sourceStyles: Record<string, string> = {
  INSTAGRAM: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  STORE: "bg-blue-50 text-blue-700 border-blue-200",
  WHOLESALE: "bg-orange-50 text-orange-700 border-orange-200",
};

const sourceLabels: Record<string, string> = {
  INSTAGRAM: "Instagram",
  STORE: "Shitore",
  WHOLESALE: "Shumice",
};

async function deleteOrder(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const orderId = Number(formData.get("orderId"));

  if (!orderId || !tenantId) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        status: true,
        quantity: true,
        variantId: true,
        items: {
          select: {
            variantId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      return;
    }

    if (order.status !== "CANCELED") {
      if (order.items.length > 0) {
        for (const item of order.items) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      } else if (order.variantId && order.quantity) {
        await tx.variant.update({
          where: { id: order.variantId },
          data: {
            stock: {
              increment: order.quantity,
            },
          },
        });
      }
    }

    await tx.order.delete({
      where: { id: orderId },
    });
  });

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/orders");
  revalidatePath("/orders/new");
}

async function bulkDeleteOrders(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const rawOrderIds = formData.get("orderIds")?.toString();

  if (!rawOrderIds || !tenantId) {
    return;
  }

  let parsedIds: unknown;

  try {
    parsedIds = JSON.parse(rawOrderIds);
  } catch {
    return;
  }

  if (!Array.isArray(parsedIds)) {
    return;
  }

  const orderIds = parsedIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (orderIds.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where: {
        tenantId,
        id: {
          in: orderIds,
        },
      },
      select: {
        id: true,
        status: true,
        quantity: true,
        variantId: true,
        items: {
          select: {
            variantId: true,
            quantity: true,
          },
        },
      },
    });

    if (orders.length === 0) {
      return;
    }

    for (const order of orders) {
      if (order.status === "CANCELED") {
        continue;
      }

      if (order.items.length > 0) {
        for (const item of order.items) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      } else if (order.variantId && order.quantity) {
        await tx.variant.update({
          where: { id: order.variantId },
          data: {
            stock: {
              increment: order.quantity,
            },
          },
        });
      }
    }

    await tx.order.deleteMany({
      where: {
        id: {
          in: orders.map((order) => order.id),
        },
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/orders");
  revalidatePath("/orders/new");
}

async function updateOrdersLayout(formData: FormData) {
  "use server";

  const currentUser = await requireUser();
  const tenantId = currentUser.tenant?.id;
  if (!tenantId || !hasRole(currentUser, ["SUPER_ADMIN"])) {
    return;
  }

  const layout = formData.get("layout")?.toString() === "list" ? "list" : "grid";
  const density = formData.get("density")?.toString() === "compact" ? "compact" : "comfortable";
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { catalogConfig: true },
  });
  const currentConfig = parseTenantCatalogConfig(settings?.catalogConfig) ?? {};
  const currentOrderListView = getOrderListViewConfig(currentConfig);

  await prisma.tenantSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      businessName: currentUser.tenant?.businessName ?? currentUser.tenant?.name,
      primaryColor: currentUser.tenant?.primaryColor ?? null,
      currency: currentUser.tenant?.currency ?? "EUR",
      language: currentUser.tenant?.language ?? "sq",
      catalogConfig: {
        ...currentConfig,
        orderListView: {
          ...currentOrderListView,
          layout,
          density,
        },
      },
    },
    update: {
      catalogConfig: {
        ...currentConfig,
        orderListView: {
          ...currentOrderListView,
          layout,
          density,
        },
      },
    },
  });

  revalidatePath("/orders");
  revalidatePath("/settings");
  redirect("/orders");
}

export default async function OrdersPage({
  searchParams,
}: OrdersPageProps) {
  const currentUser = await requireUser();
  const tenant = currentUser.tenant;
  if (!tenant) {
    return null;
  }
  const tenantId = tenant.id;
  const orderListView = getOrderListViewConfig(tenant.catalogConfig);
  const canCreateOrders = hasRole(currentUser, ["SUPER_ADMIN", "SELLER"]);
  const canDeleteOrders = hasRole(currentUser, ["SUPER_ADMIN"]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const searchQuery = resolvedSearchParams?.q?.trim() || "";
  const rawSource = resolvedSearchParams?.source?.trim() || "";
  const defaultDate = getDateStringInTimeZone(
    new Date(),
    BUSINESS_TIME_ZONE,
  );
  const rawDate = resolvedSearchParams?.date?.trim() || defaultDate;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : defaultDate;
  const { start: dateFrom, end: dateTo } = getTimeZoneDayBounds(
    selectedDate,
    BUSINESS_TIME_ZONE,
  );
  const selectedSource: OrderSourceValue | "" = [
    "INSTAGRAM",
    "STORE",
    "WHOLESALE",
  ].includes(rawSource)
    ? (rawSource as OrderSourceValue)
    : "";
  const currentPage = Math.max(1, Number(resolvedSearchParams?.page) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;
  const where: Prisma.OrderWhereInput = {
    tenantId,
    ...(searchQuery
      ? {
          OR: [
            {
              customerName: {
                contains: searchQuery,
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: searchQuery,
                mode: "insensitive",
              },
            },
            {
              instagram: {
                contains: searchQuery,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
    ...(selectedSource
      ? {
          source: selectedSource,
        }
      : {}),
    createdAt: {
      gte: dateFrom,
      lt: dateTo,
    },
  };

  const [orders, totalOrders] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        customerName: true,
        phone: true,
        instagram: true,
        source: true,
        notes: true,
        status: true,
        quantity: true,
        createdAt: true,
        variant: {
          select: {
            size: true,
            color: true,
            material: true,
            powerWatts: true,
            imagePath: true,
            product: {
              select: {
                name: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            variant: {
              select: {
                size: true,
                color: true,
                material: true,
                powerWatts: true,
                imagePath: true,
                product: {
                  select: {
                    name: true,
                    category: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));
  const previousPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  const dateFormatter = new Intl.DateTimeFormat("sq-AL", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("sq-AL", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const normalizedOrders = orders.map((order) => {
    const items =
      order.items.length > 0
        ? order.items.map((item) => ({
            id: item.id,
            name: item.variant.product.name,
            brand: item.variant.product.category.name,
            category: item.variant.product.category.name,
            size: item.variant.size,
            color: item.variant.color,
            material: item.variant.material,
            powerWatts: item.variant.powerWatts,
            imagePath: item.variant.imagePath,
            quantity: item.quantity,
          }))
        : order.variant
          ? [
              {
                id: order.id,
                name: order.variant.product.name,
                brand: order.variant.product.category.name,
                category: order.variant.product.category.name,
                size: order.variant.size,
                color: order.variant.color,
                material: order.variant.material,
                powerWatts: order.variant.powerWatts,
                imagePath: order.variant.imagePath,
                quantity: order.quantity ?? 0,
              },
            ]
          : [];

    return {
      id: order.id,
      customerName: order.customerName,
      phone: order.phone,
      instagram: order.instagram,
      source: order.source,
      notes: order.notes,
      status: order.status,
      createdAtDateLabel: dateFormatter.format(order.createdAt),
      createdAtTimeLabel: timeFormatter.format(order.createdAt),
      itemsCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      deletable: true,
      items,
    };
  });

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="space-y-5 rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-end gap-3">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                  Te gjitha porosite
                </h1>
                <span className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600">
                  {totalOrders} porosi
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {canDeleteOrders ? (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-1">
                  <form action={updateOrdersLayout}>
                    <input type="hidden" name="layout" value="grid" />
                    <input type="hidden" name="density" value={orderListView.density} />
                    <button
                      type="submit"
                      className={`rounded-[14px] px-4 py-2 text-sm font-medium transition ${
                        orderListView.layout === "grid"
                          ? "bg-slate-950 text-white"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      Grid
                    </button>
                  </form>
                  <form action={updateOrdersLayout}>
                    <input type="hidden" name="layout" value="list" />
                    <input type="hidden" name="density" value={orderListView.density} />
                    <button
                      type="submit"
                      className={`rounded-[14px] px-4 py-2 text-sm font-medium transition ${
                        orderListView.layout === "list"
                          ? "bg-slate-950 text-white"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      Liste
                    </button>
                  </form>
                </div>
              ) : null}
              {canDeleteOrders && orderListView.layout === "list" ? (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-1">
                  <form action={updateOrdersLayout}>
                    <input type="hidden" name="layout" value={orderListView.layout} />
                    <input type="hidden" name="density" value="comfortable" />
                    <button
                      type="submit"
                      className={`rounded-[14px] px-4 py-2 text-sm font-medium transition ${
                        orderListView.density === "comfortable"
                          ? "bg-slate-950 text-white"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      Comfortable
                    </button>
                  </form>
                  <form action={updateOrdersLayout}>
                    <input type="hidden" name="layout" value={orderListView.layout} />
                    <input type="hidden" name="density" value="compact" />
                    <button
                      type="submit"
                      className={`rounded-[14px] px-4 py-2 text-sm font-medium transition ${
                        orderListView.density === "compact"
                          ? "bg-slate-950 text-white"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      Compact
                    </button>
                  </form>
                </div>
              ) : null}
              {canCreateOrders ? (
                <>
                  <Link
                    href="/orders/quick"
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white"
                  >
                    Porosi te shpejta
                  </Link>
                  <Link
                    href="/orders/new"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
                  >
                    + Krijo Porosi
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.07)]">
          <div className="border-b border-slate-200/80 px-4 py-4 sm:px-5">
            <OrdersFilters
              searchQuery={searchQuery}
              selectedSource={selectedSource}
              selectedDate={selectedDate}
            />
          </div>
          {orders.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-base font-medium text-slate-900">
                {searchQuery || selectedSource || selectedDate
                  ? "Nuk u gjet asnje porosi me keto filtra"
                  : "Nuk ka ende porosi te regjistruara"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {searchQuery || selectedSource || selectedDate
                  ? "Ndrysho filtrat ose bej reset per t'i pare te gjitha."
                  : "Shto porosine e pare per te filluar ndjekjen e shitjeve."}
              </p>
            </div>
          ) : (
            <>
              <OrdersManager
                orders={normalizedOrders}
                viewConfig={orderListView}
                canDeleteOrders={canDeleteOrders}
                sourceLabels={sourceLabels}
                sourceStyles={sourceStyles}
                statusStyles={statusStyles}
                deleteOrderAction={deleteOrder}
                bulkDeleteOrdersAction={bulkDeleteOrders}
              />
            </>
          )}
        </section>

        {totalOrders > PAGE_SIZE ? (
          <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200/80 bg-white px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Faqja <span className="font-semibold text-slate-950">{currentPage}</span> nga{" "}
              <span className="font-semibold text-slate-950">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              {previousPage ? (
                <Link
                  href={buildOrdersPageHref(
                    previousPage,
                    searchQuery,
                    selectedSource,
                    selectedDate,
                  )}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Mbrapa
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400">
                  Mbrapa
                </span>
              )}
              {nextPage ? (
                <Link
                  href={buildOrdersPageHref(
                    nextPage,
                    searchQuery,
                    selectedSource,
                    selectedDate,
                  )}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Para
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400">
                  Para
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
