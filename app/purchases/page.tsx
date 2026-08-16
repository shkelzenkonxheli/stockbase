import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { buildVariantIdentityKey, getCategoryConfig } from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import { buildBarcodeFromVariantId, buildVariantSku, ensureUniqueSku } from "@/lib/variant-codes";
import { getTenantWarehouses } from "@/lib/warehouses";
import { PurchaseOrdersManager } from "./purchase-orders-manager";

export const metadata: Metadata = {
  title: "Purchase Orders",
};

type PurchasesPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    q?: string;
    status?: string;
  }>;
};

const PURCHASE_ORDER_STATUS_FILTERS = [
  "ALL",
  "DRAFT",
  "ORDERED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELED",
] as const;

type PurchaseOrderStatusFilter = (typeof PURCHASE_ORDER_STATUS_FILTERS)[number];

function normalizePurchaseOrderStatusFilter(value?: string): PurchaseOrderStatusFilter {
  if (!value) {
    return "ALL";
  }

  const normalized = value.trim().toUpperCase();
  return PURCHASE_ORDER_STATUS_FILTERS.includes(normalized as PurchaseOrderStatusFilter)
    ? (normalized as PurchaseOrderStatusFilter)
    : "ALL";
}

function getMessage(error?: string, success?: string) {
  if (error === "validation") {
    return {
      type: "error" as const,
      text: "Ploteso furnitorin, depon dhe te pakten nje rresht valid.",
    };
  }

  if (error === "items") {
    return {
      type: "error" as const,
      text: "Nje nga variantet nuk u gjet me ose eshte derguar dy here. Rifresko faqen dhe provo perseri.",
    };
  }

  if (error === "receive_validation") {
    return {
      type: "error" as const,
      text: "Vendos sasi valide per te pakten nje rresht qe nuk eshte pranuar plotesisht.",
    };
  }

  if (error === "receive_state") {
    return {
      type: "error" as const,
      text: "Ky purchase order nuk mund te pranohet me ne gjendjen aktuale.",
    };
  }

  if (error === "receive_items") {
    return {
      type: "error" as const,
      text: "Nje nga rreshtat nuk u gjet ose sasia tejkalon pjesen e pambyllur.",
    };
  }

  if (success === "created") {
    return {
      type: "success" as const,
      text: "Purchase order u ruajt me sukses.",
    };
  }

  if (success === "received") {
    return {
      type: "success" as const,
      text: "Pranimi i stokut nga purchase order u ruajt me sukses.",
    };
  }

  return null;
}

async function createPurchaseOrder(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const supplierId = Number(formData.get("supplierId"));
  const warehouseId = Number(formData.get("warehouseId"));
  const orderedAtRaw = formData.get("orderedAt")?.toString();
  const note = formData.get("note")?.toString().trim() || null;
  const submitIntent = formData.get("submitIntent")?.toString();
  const status =
    submitIntent === "draft" || formData.get("status")?.toString() === "DRAFT"
      ? "DRAFT"
      : "ORDERED";
  const itemsRaw = formData.get("items")?.toString();

  if (!tenantId || !supplierId || !warehouseId || !itemsRaw) {
    redirect("/purchases?error=validation");
  }

  let parsedItems: unknown;

  try {
    parsedItems = JSON.parse(itemsRaw);
  } catch {
    redirect("/purchases?error=validation");
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    redirect("/purchases?error=validation");
  }

  const items = parsedItems
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as {
        variantId?: unknown;
        productId?: unknown;
        size?: unknown;
        color?: unknown;
        quantity?: unknown;
        unitCost?: unknown;
        note?: unknown;
      };

      const rawVariantId = candidate.variantId;
      const variantId =
        rawVariantId === null || rawVariantId === undefined || rawVariantId === ""
          ? null
          : Number(rawVariantId);
      const productId = Number(candidate.productId);
      const size = typeof candidate.size === "string" ? candidate.size.trim() : "";
      const color = typeof candidate.color === "string" ? candidate.color.trim() : "";
      const orderedQuantity = Number(candidate.quantity);
      const unitCost = Number(candidate.unitCost);
      const lineNote =
        typeof candidate.note === "string" && candidate.note.trim()
          ? candidate.note.trim()
          : null;

      if (!Number.isInteger(orderedQuantity) || orderedQuantity <= 0) {
        return null;
      }

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        return null;
      }

      if (variantId !== null && (!Number.isInteger(variantId) || variantId <= 0)) {
        return null;
      }

      if (variantId === null && (!productId || !size || !color)) {
        return null;
      }

      return {
        variantId,
        productId: variantId === null ? productId : null,
        size: variantId === null ? size : null,
        color: variantId === null ? color : null,
        orderedQuantity,
        unitCost,
        note: lineNote,
      };
    })
    .filter(
      (
        item,
      ): item is {
        variantId: number | null;
        productId: number | null;
        size: string | null;
        color: string | null;
        orderedQuantity: number;
        unitCost: number;
        note: string | null;
      } => item !== null,
    );

  if (items.length === 0) {
    redirect("/purchases?error=validation");
  }

  const uniqueLineKeys = new Set(
    items.map((item) =>
      item.variantId !== null
        ? `variant:${item.variantId}`
        : `custom:${item.productId}:${item.color}:${item.size}`,
    ),
  );
  if (uniqueLineKeys.size !== items.length) {
    redirect("/purchases?error=items");
  }

  const orderedAt = orderedAtRaw ? new Date(`${orderedAtRaw}T00:00:00`) : new Date();
  if (Number.isNaN(orderedAt.getTime())) {
    redirect("/purchases?error=validation");
  }

  const existingVariantIds = items
    .filter((item): item is typeof item & { variantId: number } => item.variantId !== null)
    .map((item) => item.variantId);
  const customProductIds = [
    ...new Set(
      items
        .filter((item): item is typeof item & { productId: number } => item.variantId === null)
        .map((item) => item.productId),
    ),
  ];

  const result = await prisma.$transaction(async (tx) => {
    const [supplier, warehouse, variants, customProducts] = await Promise.all([
      tx.supplier.findFirst({
        where: { id: supplierId, tenantId, isActive: true },
        select: { id: true, name: true },
      }),
      tx.warehouse.findFirst({
        where: { id: warehouseId, tenantId, isActive: true },
        select: { id: true, name: true },
      }),
      tx.variant.findMany({
        where: {
          tenantId,
          id: { in: existingVariantIds },
        },
        select: {
          id: true,
          size: true,
          color: true,
          productId: true,
          sku: true,
          barcode: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      }),
      tx.product.findMany({
        where: {
          tenantId,
          id: { in: customProductIds },
        },
        select: {
          id: true,
          name: true,
          category: {
            select: {
              name: true,
            },
          },
          variants: {
            select: {
              sku: true,
              barcode: true,
            },
          },
        },
      }),
    ]);

    if (!supplier || !warehouse || variants.length !== existingVariantIds.length) {
      return { ok: false as const };
    }

    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    const productMap = new Map(customProducts.map((product) => [product.id, product]));
    const createdOrResolvedCustomVariants = new Map<
      string,
      { id: number; productId: number; size: string; color: string; product: { name: string } }
    >();

    for (const item of items) {
      if (item.variantId !== null) {
        continue;
      }

      const identity = `custom:${item.productId}:${item.color}:${item.size}`;
      if (createdOrResolvedCustomVariants.has(identity)) {
        continue;
      }

      const product = productMap.get(item.productId!);
      if (!product) {
        return { ok: false as const };
      }

      const categoryConfig = getCategoryConfig(product.category.name);
      const variantIdentityKey = buildVariantIdentityKey(categoryConfig, {
        size: item.size,
        color: item.color,
        material: null,
        powerWatts: null,
      });

      const existingVariant = await tx.variant.findFirst({
        where: {
          tenantId,
          productId: product.id,
          variantIdentityKey,
        },
        select: {
          id: true,
          productId: true,
          size: true,
          color: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      });

      if (existingVariant) {
        createdOrResolvedCustomVariants.set(identity, existingVariant);
        continue;
      }

      const usedSkus = new Set(
        product.variants.map((variant) => variant.sku).filter((sku): sku is string => Boolean(sku)),
      );
      const baseSku = buildVariantSku({
        productName: product.name,
        size: item.size,
        color: item.color!,
      });
      const nextSku = ensureUniqueSku(baseSku, usedSkus);

      const createdVariant = await tx.variant.create({
        data: {
          tenantId,
          productId: product.id,
          size: item.size!,
          color: item.color!,
          stock: 0,
          price: item.unitCost.toFixed(2),
          sku: nextSku,
          variantIdentityKey,
        },
        select: {
          id: true,
          productId: true,
          size: true,
          color: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      });

      const barcode = buildBarcodeFromVariantId(createdVariant.id);
      await tx.variant.update({
        where: { id: createdVariant.id },
        data: { barcode },
      });

      createdOrResolvedCustomVariants.set(identity, createdVariant);
    }

    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        tenantId,
        supplierId,
        warehouseId,
        status,
        note,
        orderedAt,
        createdById: currentUser.id,
        items: {
          create: items.map((item) => {
            const variant =
              item.variantId !== null
                ? variantMap.get(item.variantId)
                : createdOrResolvedCustomVariants.get(
                    `custom:${item.productId}:${item.color}:${item.size}`,
                  );
            if (!variant) {
              throw new Error("Missing purchase order variant");
            }
            return {
              productId: variant.productId,
              variantId: variant.id,
              orderedQuantity: item.orderedQuantity,
              unitCost: item.unitCost.toFixed(2),
              note: item.note,
            };
          }),
        },
      },
      include: {
        items: true,
      },
    });

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "PURCHASE_ORDER_CREATED",
      entityType: "PURCHASE_ORDER",
      entityId: purchaseOrder.id,
      entityLabel: `PO #${purchaseOrder.id}`,
      warehouseId,
      metadata: {
        supplier: supplier.name,
        warehouse: warehouse.name,
        status,
        orderedAt: orderedAt.toISOString(),
        lines: items.map((item) => {
          const variant =
            item.variantId !== null
              ? variantMap.get(item.variantId)
              : createdOrResolvedCustomVariants.get(
                  `custom:${item.productId}:${item.color}:${item.size}`,
                );
          if (!variant) {
            throw new Error("Missing purchase order variant");
          }
          return {
            variantId: variant.id,
            product: variant.product.name,
            size: variant.size,
            color: variant.color,
            quantity: item.orderedQuantity,
            unitCost: item.unitCost,
          };
        }),
      },
    });

    return { ok: true as const };
  });

  if (!result.ok) {
    redirect("/purchases?error=items");
  }

  revalidatePath("/purchases");
  revalidatePath("/suppliers");
  redirect("/purchases?success=created");
}

async function receivePurchaseOrder(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const purchaseOrderId = Number(formData.get("purchaseOrderId"));
  const receiveMode = formData.get("receiveMode")?.toString();

  if (!tenantId || !purchaseOrderId) {
    redirect("/purchases?error=receive_validation");
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: {
        id: purchaseOrderId,
        tenantId,
      },
      include: {
        supplier: {
          select: { name: true },
        },
        warehouse: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            variant: {
              select: {
                id: true,
                size: true,
                color: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { ok: false as const, reason: "items" as const };
    }

    if (!["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status)) {
      return { ok: false as const, reason: "state" as const };
    }

    const adjustments =
      receiveMode === "all"
        ? order.items
            .map((item) => ({
              itemId: item.id,
              quantity: item.orderedQuantity - item.receivedQuantity,
            }))
            .filter((item) => item.quantity > 0)
        : Array.from(formData.entries())
            .filter(([key]) => key.startsWith("received_"))
            .map(([key, value]) => ({
              itemId: Number(key.replace("received_", "")),
              quantity: Math.floor(Number(value)),
            }))
            .filter(
              (entry) =>
                Number.isInteger(entry.itemId) &&
                Number.isFinite(entry.quantity) &&
                entry.quantity > 0,
            );

    if (adjustments.length === 0) {
      return { ok: false as const, reason: "validation" as const };
    }

    const items = await tx.purchaseOrderItem.findMany({
      where: {
        purchaseOrderId,
        id: { in: adjustments.map((item) => item.itemId) },
      },
      include: {
        variant: {
          select: {
            id: true,
            stock: true,
            size: true,
            color: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            inventories: {
              where: {
                warehouseId: order.warehouse.id,
              },
              select: {
                id: true,
                stock: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    if (items.length !== adjustments.length) {
      return { ok: false as const, reason: "items" as const };
    }

    const itemMap = new Map(items.map((item) => [item.id, item]));

    for (const adjustment of adjustments) {
      const item = itemMap.get(adjustment.itemId);
      if (!item) {
        return { ok: false as const, reason: "items" as const };
      }

      const remaining = item.orderedQuantity - item.receivedQuantity;
      if (adjustment.quantity <= 0 || adjustment.quantity > remaining) {
        return { ok: false as const, reason: "items" as const };
      }

      const existingInventory = item.variant.inventories[0];

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
            variantId: item.variantId,
            warehouseId: order.warehouse.id,
            stock: adjustment.quantity,
          },
        });
      }

      await tx.variant.update({
        where: { id: item.variantId },
        data: {
          stock: {
            increment: adjustment.quantity,
          },
        },
      });

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: {
          receivedQuantity: {
            increment: adjustment.quantity,
          },
        },
      });
    }

    await tx.stockMovement.createMany({
      data: adjustments.map((adjustment) => {
        const item = itemMap.get(adjustment.itemId)!;
        return {
          tenantId,
          variantId: item.variantId,
          warehouseId: order.warehouse.id,
          quantity: adjustment.quantity,
          reason: "INCOMING_STOCK" as const,
        };
      }),
    });

    const refreshedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId },
      select: {
        orderedQuantity: true,
        receivedQuantity: true,
      },
    });

    const nextStatus = refreshedItems.every(
      (item) => item.receivedQuantity >= item.orderedQuantity,
    )
      ? "RECEIVED"
      : "PARTIALLY_RECEIVED";

    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: nextStatus },
    });

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "PURCHASE_ORDER_RECEIVED",
      entityType: "PURCHASE_ORDER",
      entityId: order.id,
      entityLabel: `PO #${order.id}`,
      warehouseId: order.warehouse.id,
      metadata: {
        supplier: order.supplier.name,
        warehouse: order.warehouse.name,
        status: nextStatus,
        receivedAt: new Date().toISOString(),
        adjustments: adjustments.map((adjustment) => {
          const item = itemMap.get(adjustment.itemId)!;
          return {
            itemId: item.id,
            variantId: item.variantId,
            product: item.variant.product.name,
            size: item.variant.size,
            color: item.variant.color,
            quantity: adjustment.quantity,
          };
        }),
      },
    });

    return {
      ok: true as const,
      warehouseId: order.warehouse.id,
      productIds: [...new Set(items.map((item) => item.variant.product.id))],
    };
  });

  if (!result.ok) {
    if (result.reason === "validation") {
      redirect("/purchases?error=receive_validation");
    }
    if (result.reason === "state") {
      redirect("/purchases?error=receive_state");
    }

    redirect("/purchases?error=receive_items");
  }

  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/orders/new");
  revalidatePath("/orders/quick");
  revalidatePath("/stock/incoming");
  for (const productId of result.productIds) {
    revalidatePath(`/products/${productId}`);
  }

  redirect("/purchases?success=received");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("sq-AL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

const statusStyles: Record<string, string> = {
  DRAFT: "border border-slate-200 bg-slate-100 text-slate-700",
  ORDERED: "border border-sky-200 bg-sky-50 text-sky-700",
  PARTIALLY_RECEIVED: "border border-amber-200 bg-amber-50 text-amber-700",
  RECEIVED: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELED: "border border-rose-200 bg-rose-50 text-rose-700",
};

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const message = getMessage(resolvedSearchParams?.error, resolvedSearchParams?.success);
  const searchQuery = resolvedSearchParams?.q?.trim() ?? "";
  const statusFilter = normalizePurchaseOrderStatusFilter(resolvedSearchParams?.status);
  const numericSearchId = Number(searchQuery);
  const hasNumericSearchId = Number.isInteger(numericSearchId) && numericSearchId > 0;

  const [suppliers, warehouses, variants, purchaseOrders] = await Promise.all([
    prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    getTenantWarehouses(tenantId),
    prisma.product.findMany({
      where: {
        tenantId,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        brand: true,
        category: {
          select: {
            name: true,
          },
        },
        variants: {
          orderBy: [{ color: "asc" }, { size: "asc" }],
          select: {
            id: true,
            size: true,
            color: true,
            price: true,
          },
        },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        ...(searchQuery
          ? {
              OR: [
                { supplier: { name: { contains: searchQuery, mode: "insensitive" } } },
                ...(hasNumericSearchId ? [{ id: numericSearchId }] : []),
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        supplier: {
          select: { name: true },
        },
        warehouse: {
          select: { name: true },
        },
        items: {
          select: {
            id: true,
            orderedQuantity: true,
            receivedQuantity: true,
            unitCost: true,
            variant: {
              select: {
                size: true,
                color: true,
                product: {
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

  const totalOrderedValue = purchaseOrders.reduce((sum, order) => {
    return (
      sum +
      order.items.reduce(
        (orderSum, item) => orderSum + Number(item.unitCost) * item.orderedQuantity,
        0,
      )
    );
  }, 0);

  const purchaseOrderItems = purchaseOrders.map((order) => {
    const total = order.items.reduce(
      (sum, item) => sum + Number(item.unitCost) * item.orderedQuantity,
      0,
    );

    return {
      id: order.id,
      status: order.status,
      note: order.note,
      orderedAtLabel: formatDate(order.orderedAt),
      supplierName: order.supplier.name,
      warehouseName: order.warehouse.name,
      totalLabel: formatMoney(total),
      itemCount: order.items.length,
      totalQuantity: order.items.reduce((sum, item) => sum + item.orderedQuantity, 0),
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.variant.product.name,
        size: item.variant.size,
        color: item.variant.color,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        remainingQuantity: Math.max(0, item.orderedQuantity - item.receivedQuantity),
        unitCostLabel: formatMoney(Number(item.unitCost)),
        lineTotalLabel: formatMoney(Number(item.unitCost) * item.orderedQuantity),
      })),
    };
  });

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-emerald-100 bg-[linear-gradient(135deg,#f7fffb_0%,#ffffff_52%,#edf9f2_100%)] px-5 py-6 shadow-[0_20px_55px_rgba(16,185,129,0.10)] sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Purchasing / Orders
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
                Purchase Orders
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Ketu krijon porosite blerese ndaj furnitoreve. Hapi i ardhshem do
                te jete receiving dhe partial receiving.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-slate-600 shadow-sm">
                  {purchaseOrders.length} purchase orders
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700 shadow-sm">
                  {formatMoney(totalOrderedValue)} vlere totale
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/suppliers"
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white/92 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                Furnitoret
              </Link>
              <Link
                href="/stock/incoming"
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white/92 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                Hyrje stoku
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

        <PurchaseOrdersManager
          action={createPurchaseOrder}
          receiveAction={receivePurchaseOrder}
          suppliers={suppliers}
          warehouses={warehouses.map((warehouse) => ({
            id: warehouse.id,
            name: warehouse.name,
          }))}
          products={variants.map((product) => ({
            id: product.id,
            name: product.name,
            brand: product.brand,
            categoryName: product.category.name,
            variants: product.variants.map((variant) => ({
              id: variant.id,
              size: variant.size,
              color: variant.color,
              price: Number(variant.price),
            })),
          }))}
          purchaseOrders={purchaseOrderItems}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
        />
      </div>
    </main>
  );
}
