import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireRole } from "@/lib/auth";
import { parseTenantCatalogConfig } from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import { getTenantWarehouses } from "@/lib/warehouses";
import { QuickOrdersForm } from "./quick-orders-form";
import { createQuickOrders } from "./create-quick-orders";

export const metadata: Metadata = {
  title: "Porosi te Shpejta",
};

type QuickOrdersPageProps = {
  searchParams?: Promise<{
    error?: string;
    posSessionId?: string;
    source?: string;
    warehouseId?: string;
  }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "stock":
      return "Nuk ka stok te mjaftueshem per nje ose me shume rreshta.";
    case "variant":
      return "Nje nga variantet nuk ekziston me.";
    case "validation":
      return "Ploteso variantin dhe nje sasi valide per cdo rresht qe don te ruash.";
    case "session":
      return "POS session nuk ekziston me, eshte mbyllur ose nuk ke akses ne te.";
    case "warehouse":
      return "Depoja nuk eshte aktive per kete biznes.";
    default:
      return null;
  }
}

export default async function QuickOrdersPage({
  searchParams,
}: QuickOrdersPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN", "SELLER"]);
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = getErrorMessage(resolvedSearchParams?.error);
  const posSessionIdValue = Number(resolvedSearchParams?.posSessionId);
  const posSessionId =
    Number.isInteger(posSessionIdValue) && posSessionIdValue > 0 ? posSessionIdValue : null;
  const sourceParam = resolvedSearchParams?.source;
  const defaultSource =
    sourceParam === "STORE" || sourceParam === "INSTAGRAM" || sourceParam === "WHOLESALE"
      ? sourceParam
      : "INSTAGRAM";
  const warehouseIdParam = Number(resolvedSearchParams?.warehouseId);
  const defaultWarehouseId =
    Number.isInteger(warehouseIdParam) && warehouseIdParam > 0 ? warehouseIdParam : null;

  const activePosSession = posSessionId
    ? await prisma.posSession.findFirst({
        where: {
          id: posSessionId,
          tenantId,
          status: "OPEN",
          ...(currentUser.role === "SUPER_ADMIN" ? {} : { openedById: currentUser.id }),
        },
        select: {
          id: true,
          warehouseId: true,
          register: {
            select: {
              name: true,
              warehouse: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })
    : null;

  const tenantSettings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { catalogConfig: true },
  });
  const warehouses = await getTenantWarehouses(
    tenantId,
    parseTenantCatalogConfig(tenantSettings?.catalogConfig),
  );
  const products = await prisma.product.findMany({
    where: {
      tenantId,
      variants: {
        some: {
          inventories: {
            some: {
              stock: {
                gt: 0,
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      brand: true,
      warehouseName: true,
      category: {
        select: {
          name: true,
        },
      },
      variants: {
        select: {
          imagePath: true,
          inventories: {
            where: {
              stock: {
                gt: 0,
              },
            },
            select: {
              warehouseId: true,
            },
          },
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ebf8f0_0%,#eef4f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-7xl rounded-[32px] border border-emerald-100 bg-[linear-gradient(135deg,#f7fffb_0%,#ffffff_52%,#edf9f2_100%)] px-6 py-6 shadow-[0_20px_55px_rgba(16,185,129,0.10)] sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Porosi te shpejta
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Porosi te shpejta
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Shiko porosite
            </Link>
            <Link
              href="/orders/new"
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Porosi normale
            </Link>
          </div>
        </div>

        {errorMessage ? (
          <FlashMessage
            type="error"
            text={errorMessage}
            className="mt-6 rounded-2xl px-4 py-3 text-sm shadow-sm"
          />
        ) : null}

        {activePosSession ? (
          <FlashMessage
            type="success"
            text={`POS checkout aktiv: ${activePosSession.register.name} / ${activePosSession.register.warehouse.name}`}
            className="mt-4 rounded-2xl px-4 py-3 text-sm shadow-sm"
          />
        ) : null}

        <QuickOrdersForm
          action={createQuickOrders}
          warehouses={warehouses.map((warehouse) => ({
            id: warehouse.id,
            name: warehouse.name,
          }))}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            brand: product.brand ?? "",
            warehouseName: [
              ...new Set(
                product.variants.flatMap((variant) =>
                  variant.inventories
                    .map((inventory) => warehouses.find((warehouse) => warehouse.id === inventory.warehouseId)?.name)
                    .filter((value): value is string => Boolean(value)),
                ),
              ),
            ].join(", "),
            category: product.category.name,
            imagePath:
              product.variants.find((variant) => variant.imagePath)?.imagePath ?? null,
            warehouseIds: [
              ...new Set(
                product.variants.flatMap((variant) =>
                  variant.inventories.map((inventory) => inventory.warehouseId),
                ),
              ),
            ],
          }))}
          defaultSource={activePosSession ? "STORE" : defaultSource}
          defaultWarehouseId={activePosSession?.warehouseId ?? defaultWarehouseId}
          posSessionId={activePosSession?.id ?? null}
          backHref={activePosSession ? `/pos/session/${activePosSession.id}` : "/orders"}
          submitLabel={activePosSession ? "Perfundo shitjen" : "Ruaj"}
        />
      </section>
    </main>
  );
}
