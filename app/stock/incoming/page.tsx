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
import { IncomingStockForm } from "./incoming-stock-form";

export const metadata: Metadata = {
  title: "Hyrje Stoku",
};

type IncomingStockPageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

async function createIncomingStock(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const productId = Number(formData.get("productId"));
  const warehouseId = Number(formData.get("warehouseId"));
  const reason =
    formData.get("reason")?.toString() === "CUSTOMER_RETURN"
      ? "CUSTOMER_RETURN"
      : "INCOMING_STOCK";
  const adjustmentsRaw = formData.get("adjustments")?.toString();

  if (!productId || !warehouseId || !adjustmentsRaw || !tenantId) {
    redirect("/stock/incoming?error=validation");
  }

  let parsedAdjustments: unknown;

  try {
    parsedAdjustments = JSON.parse(adjustmentsRaw);
  } catch {
    redirect("/stock/incoming?error=validation");
  }

  if (!Array.isArray(parsedAdjustments) || parsedAdjustments.length === 0) {
    redirect("/stock/incoming?error=validation");
  }

  const adjustments = parsedAdjustments
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as { variantId?: unknown; quantity?: unknown };
      const variantId = Number(candidate.variantId);
      const quantity = Number(candidate.quantity);

      if (!variantId || !quantity || quantity <= 0) {
        return null;
      }

      return {
        variantId,
        quantity,
      };
    })
    .filter(
      (item): item is { variantId: number; quantity: number } => item !== null,
    );

  if (adjustments.length === 0) {
    redirect("/stock/incoming?error=validation");
  }

  const result = await prisma.$transaction(async (tx) => {
    const variants = await tx.variant.findMany({
      where: {
        tenantId,
        productId,
        id: {
          in: adjustments.map((item) => item.variantId),
        },
      },
      select: {
        id: true,
        stock: true,
        size: true,
        color: true,
        inventories: {
          where: { warehouseId },
          select: {
            id: true,
            stock: true,
          },
          take: 1,
        },
      },
    });

    if (variants.length !== adjustments.length) {
      return { ok: false as const };
    }

    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

    for (const adjustment of adjustments) {
      const variant = variantMap.get(adjustment.variantId);
      if (!variant) {
        return { ok: false as const };
      }

      const existingInventory = variant.inventories[0];

      if (existingInventory) {
        await tx.variantInventory.update({
          where: { id: existingInventory.id },
          data: {
            stock: {
              increment: adjustment.quantity,
            },
          },
        });
      } else {
        await tx.variantInventory.create({
          data: {
            variantId: adjustment.variantId,
            warehouseId,
            stock: adjustment.quantity,
          },
        });
      }

      await tx.variant.update({
        where: { id: adjustment.variantId },
        data: {
          stock: {
            increment: adjustment.quantity,
          },
        },
      });
    }

    await tx.stockMovement.createMany({
      data: adjustments.map((adjustment) => ({
        tenantId,
        variantId: adjustment.variantId,
        warehouseId,
        quantity: adjustment.quantity,
        reason,
      })),
    });

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "STOCK_INCOMING_CREATED",
      entityType: "STOCK",
      entityId: productId,
      entityLabel: `Produkti #${productId}`,
      warehouseId,
      metadata: {
        reason,
        adjustments: adjustments.map((adjustment) => {
          const variant = variantMap.get(adjustment.variantId);
          return {
            variantId: adjustment.variantId,
            quantity: adjustment.quantity,
            size: variant?.size ?? null,
            color: variant?.color ?? null,
          };
        }),
      },
    });

    return { ok: true as const };
  });

  if (!result.ok) {
    redirect("/stock/incoming?error=variant");
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/orders/new");
  revalidatePath("/orders/quick");
  revalidatePath("/stock/incoming");

  redirect("/stock/incoming?success=1");
}

function getMessage(error?: string, success?: string) {
  if (error === "validation") {
    return {
      type: "error" as const,
      text: "Zgjedh depon, produktin dhe vendos sasi per te pakten nje variant.",
    };
  }

  if (error === "variant") {
    return {
      type: "error" as const,
      text: "Nje nga variantet nuk u gjet me. Rifresko faqen dhe provo perseri.",
    };
  }

  if (success === "1") {
    return {
      type: "success" as const,
      text: "Hyrja e stokut u ruajt me sukses.",
    };
  }

  return null;
}

const reasonLabels: Record<
  "INCOMING_STOCK" | "POS_SALE" | "CUSTOMER_RETURN" | "SUPPLIER_RETURN" | "TRANSFER" | "INVENTORY_COUNT",
  string
> = {
  INCOMING_STOCK: "Hyrje stoku",
  POS_SALE: "Shitje POS",
  CUSTOMER_RETURN: "Kthim klienti",
  SUPPLIER_RETURN: "Kthim te furnitori",
  TRANSFER: "Transfer",
  INVENTORY_COUNT: "Inventory count",
};

const reasonStyles: Record<
  "INCOMING_STOCK" | "POS_SALE" | "CUSTOMER_RETURN" | "SUPPLIER_RETURN" | "TRANSFER" | "INVENTORY_COUNT",
  string
> = {
  INCOMING_STOCK: "border-emerald-200 bg-emerald-50 text-emerald-700",
  POS_SALE: "border-sky-200 bg-sky-50 text-sky-700",
  CUSTOMER_RETURN: "border-sky-200 bg-sky-50 text-sky-700",
  SUPPLIER_RETURN: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  TRANSFER: "border-amber-200 bg-amber-50 text-amber-700",
  INVENTORY_COUNT: "border-violet-200 bg-violet-50 text-violet-700",
};

export default async function IncomingStockPage({
  searchParams,
}: IncomingStockPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const message = getMessage(
    resolvedSearchParams?.error,
    resolvedSearchParams?.success,
  );

  const tenantSettings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { catalogConfig: true },
  });

  const [warehouses, products, recentMovements] = await Promise.all([
    getTenantWarehouses(
      tenantId,
      parseTenantCatalogConfig(tenantSettings?.catalogConfig),
    ),
    prisma.product.findMany({
      where: {
        tenantId,
        variants: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.stockMovement.findMany({
      where: { tenantId },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
      select: {
          id: true,
          quantity: true,
          reason: true,
          warehouse: {
            select: {
              name: true,
            },
          },
          createdAt: true,
          variant: {
          select: {
            size: true,
            color: true,
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
    }),
  ]);

  const dateTimeFormatter = new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-7xl">
        <div className="rounded-[30px] border border-emerald-100 bg-[linear-gradient(135deg,#f7fffb_0%,#ffffff_52%,#edf9f2_100%)] px-5 py-6 shadow-[0_20px_55px_rgba(16,185,129,0.10)] sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Hyrje Stoku
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Hyrje stoku
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Zgjedh produktin dhe shto stok per disa variante njeheresh.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white/92 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Ballina
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white/92 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Shiko produktet
            </Link>
          </div>
        </div>
        </div>

        {message ? (
          <FlashMessage
            type={message.type}
            text={message.text}
            className="mt-6 rounded-2xl px-4 py-3 text-sm shadow-sm"
          />
        ) : null}

        <IncomingStockForm
          action={createIncomingStock}
          warehouses={warehouses.map((warehouse) => ({
            id: warehouse.id,
            name: warehouse.name,
          }))}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            brand: product.category.name,
          }))}
        />

        <section className="mt-10">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                  Historia e hyrjeve
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 shadow-sm">
                  {recentMovements.length} levizje
                </span>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition group-open:rotate-180">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="m6 9 6 6 6-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </summary>

            {recentMovements.length === 0 ? (
              <div className="mt-5 rounded-[28px] border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                <p className="text-base font-medium text-slate-900">
                  Nuk ka ende histori te hyrjeve
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                <div className="grid gap-3 p-4 lg:hidden">
                  {recentMovements.map((movement) => (
                    <article
                      key={movement.id}
                      className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {movement.variant.product.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {movement.variant.product.category.name}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${reasonStyles[movement.reason]}`}
                        >
                          {reasonLabels[movement.reason]}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Varianti
                          </p>
                          <p className="mt-1 text-slate-700">
                            Nr {movement.variant.size} / {movement.variant.color}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Sasia
                          </p>
                          <p className="mt-1 font-semibold text-emerald-600">
                            +{movement.quantity}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-slate-500">
                        {dateTimeFormatter.format(movement.createdAt)}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-emerald-100 bg-[linear-gradient(180deg,#f6fdf8_0%,#eef8f1_100%)] text-left">
                      <tr className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
                        <th className="px-4 py-3.5">Produkti</th>
                        <th className="px-4 py-3.5">Varianti</th>
                        <th className="px-4 py-3.5">Arsyeja</th>
                        <th className="px-4 py-3.5 text-right">Sasia</th>
                        <th className="px-4 py-3.5 text-right">Koha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50 bg-white">
                      {recentMovements.map((movement) => (
                        <tr key={movement.id}>
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium text-slate-900">
                                {movement.variant.product.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {movement.variant.product.category.name}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            Nr {movement.variant.size} /{" "}
                            {movement.variant.color}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${reasonStyles[movement.reason]}`}
                            >
                              {reasonLabels[movement.reason]}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="font-semibold text-emerald-600">
                              {" "}
                              +{movement.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600">
                            {dateTimeFormatter.format(movement.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </details>
        </section>
      </section>
    </main>
  );
}
