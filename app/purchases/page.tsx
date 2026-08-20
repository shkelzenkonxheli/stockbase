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
  "PARTIALLY_RETURNED",
  "RETURNED",
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

  if (error === "update_validation") {
    return {
      type: "error" as const,
      text: "Perditesimi deshtoi. Kontrollo daten, furnitorin, depon dhe rreshtat e porosise.",
    };
  }

  if (error === "update_state") {
    return {
      type: "error" as const,
      text: "Kjo porosi nuk mund te editohet me pasi ka pranim ose eshte mbyllur.",
    };
  }

  if (error === "cancel_state") {
    return {
      type: "error" as const,
      text: "Mund te anulosh vetem porosite pa pranime ne status draft ose ordered.",
    };
  }

  if (error === "return_validation") {
    return {
      type: "error" as const,
      text: "Vendos sasi valide per te pakten nje rresht qe po kthehet te furnitori.",
    };
  }

  if (error === "return_state") {
    return {
      type: "error" as const,
      text: "Ky purchase order nuk lejon kthime te furnitori ne gjendjen aktuale.",
    };
  }

  if (error === "return_stock") {
    return {
      type: "error" as const,
      text: "Nuk ka stok te mjaftueshem ne depon aktuale per kthimin e kerkuar.",
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

  if (success === "updated") {
    return {
      type: "success" as const,
      text: "Purchase order u perditesua me sukses.",
    };
  }

  if (success === "canceled") {
    return {
      type: "success" as const,
      text: "Purchase order u anulua me sukses.",
    };
  }

  if (success === "returned") {
    return {
      type: "success" as const,
      text: "Kthimi te furnitori u ruajt me sukses.",
    };
  }

  return null;
}

function derivePurchaseOrderStatus(items: Array<{
  orderedQuantity: number;
  receivedQuantity: number;
  returnedQuantity: number;
}>) {
  const totalReceived = items.reduce((sum, item) => sum + item.receivedQuantity, 0);
  const totalReturned = items.reduce((sum, item) => sum + item.returnedQuantity, 0);

  if (totalReceived > 0 && items.every((item) => item.returnedQuantity >= item.receivedQuantity)) {
    return "RETURNED" as const;
  }

  if (totalReturned > 0) {
    return "PARTIALLY_RETURNED" as const;
  }

  if (items.every((item) => item.receivedQuantity >= item.orderedQuantity)) {
    return "RECEIVED" as const;
  }

  if (totalReceived > 0) {
    return "PARTIALLY_RECEIVED" as const;
  }

  return "ORDERED" as const;
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
        draftKind?: unknown;
        variantId?: unknown;
        productId?: unknown;
        productName?: unknown;
        brand?: unknown;
        categoryName?: unknown;
        size?: unknown;
        color?: unknown;
        material?: unknown;
        powerWatts?: unknown;
        quantity?: unknown;
        unitCost?: unknown;
        note?: unknown;
      };

      const draftKind =
        candidate.draftKind === "pendingVariant" || candidate.draftKind === "pendingProduct"
          ? candidate.draftKind
          : "existing";
      const rawVariantId = candidate.variantId;
      const variantId =
        rawVariantId === null || rawVariantId === undefined || rawVariantId === ""
          ? null
          : Number(rawVariantId);
      const productId = Number(candidate.productId);
      const productName =
        typeof candidate.productName === "string" ? candidate.productName.trim() : "";
      const brand = typeof candidate.brand === "string" ? candidate.brand.trim() : "";
      const categoryName =
        typeof candidate.categoryName === "string" ? candidate.categoryName.trim() : "";
      const size = typeof candidate.size === "string" ? candidate.size.trim() : "";
      const color = typeof candidate.color === "string" ? candidate.color.trim() : "";
      const material = typeof candidate.material === "string" ? candidate.material.trim() : "";
      const powerWatts =
        typeof candidate.powerWatts === "string" ? candidate.powerWatts.trim() : "";
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

      if (draftKind === "existing" && variantId === null) {
        return null;
      }

      if (draftKind === "pendingVariant" && (!productId || !size || !color)) {
        return null;
      }

      if (draftKind === "pendingProduct" && (!categoryName || !productName || !size || !color)) {
        return null;
      }

      return {
        draftKind,
        variantId,
        productId:
          draftKind === "existing" ? null : Number.isInteger(productId) && productId > 0 ? productId : null,
        productName: draftKind === "pendingProduct" ? productName : null,
        brand: brand || null,
        categoryName:
          draftKind === "pendingProduct" ? categoryName : draftKind === "pendingVariant" ? categoryName || null : null,
        size,
        color,
        material: material || null,
        powerWatts: powerWatts || null,
        orderedQuantity,
        unitCost,
        note: lineNote,
      };
    })
    .filter(
      (
        item,
      ): item is {
        draftKind: "existing" | "pendingVariant" | "pendingProduct";
        variantId: number | null;
        productId: number | null;
        productName: string | null;
        brand: string | null;
        categoryName: string | null;
        size: string;
        color: string;
        material: string | null;
        powerWatts: string | null;
        orderedQuantity: number;
        unitCost: number;
        note: string | null;
      } => item !== null,
    );

  if (items.length === 0) {
    redirect("/purchases?error=validation");
  }

  const uniqueLineKeys = new Set(
    items.map((item) => {
      if (item.draftKind === "existing" && item.variantId !== null) {
        return `variant:${item.variantId}`;
      }

      if (item.draftKind === "pendingVariant") {
        return `pending-variant:${item.productId}:${item.color}:${item.size}:${item.material ?? ""}:${item.powerWatts ?? ""}`;
      }

      return `pending-product:${item.categoryName}:${item.brand ?? ""}:${item.productName}:${item.color}:${item.size}:${item.material ?? ""}:${item.powerWatts ?? ""}`;
    }),
  );
  if (uniqueLineKeys.size !== items.length) {
    redirect("/purchases?error=items");
  }

  const orderedAt = orderedAtRaw ? new Date(`${orderedAtRaw}T00:00:00`) : new Date();
  if (Number.isNaN(orderedAt.getTime())) {
    redirect("/purchases?error=validation");
  }

  const existingVariantIds = items
    .filter(
      (item): item is typeof item & { variantId: number } =>
        item.draftKind === "existing" && item.variantId !== null,
    )
    .map((item) => item.variantId);
  const pendingVariantProductIds = [
    ...new Set(
      items
        .filter(
          (item): item is typeof item & { productId: number } =>
            item.draftKind === "pendingVariant" && item.productId !== null,
        )
        .map((item) => item.productId),
    ),
  ];

  const result = await prisma.$transaction(async (tx) => {
    const [supplier, warehouse, variants, pendingVariantProducts] = await Promise.all([
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
          id: { in: pendingVariantProductIds },
        },
        select: {
          id: true,
          name: true,
          brand: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    if (!supplier || !warehouse || variants.length !== existingVariantIds.length) {
      return { ok: false as const };
    }

    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    const productMap = new Map(pendingVariantProducts.map((product) => [product.id, product]));

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
            if (item.draftKind === "existing") {
              const variant = variantMap.get(item.variantId!);
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
            }

            const sourceProduct =
              item.productId !== null ? productMap.get(item.productId) : null;
            const pendingCategoryName =
              item.categoryName ?? sourceProduct?.category.name ?? null;
            const pendingProductName = item.productName ?? sourceProduct?.name ?? null;
            const pendingBrand = item.brand ?? sourceProduct?.brand ?? null;
            const categoryConfig = getCategoryConfig(pendingCategoryName);
            const pendingVariantIdentityKey = buildVariantIdentityKey(categoryConfig, {
              size: item.size,
              color: item.color,
              material: item.material,
              powerWatts: item.powerWatts,
            });

            return {
              productId: item.productId,
              variantId: null,
              orderedQuantity: item.orderedQuantity,
              unitCost: item.unitCost.toFixed(2),
              note: item.note,
              pendingProductName,
              pendingBrand,
              pendingCategoryName,
              pendingColor: item.color,
              pendingSize: item.size,
              pendingMaterial: item.material,
              pendingPowerWatts: item.powerWatts,
              pendingVariantIdentityKey,
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
          if (item.draftKind === "existing") {
            const variant = variantMap.get(item.variantId!);
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
              kind: "existing",
            };
          }
          const sourceProduct =
            item.productId !== null ? productMap.get(item.productId) : null;
          return {
            variantId: null,
            product: item.productName ?? sourceProduct?.name ?? "Produkt i ri",
            size: item.size,
            color: item.color,
            quantity: item.orderedQuantity,
            unitCost: item.unitCost,
            kind: item.draftKind,
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

async function updatePurchaseOrder(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const purchaseOrderId = Number(formData.get("purchaseOrderId"));
  const supplierId = Number(formData.get("supplierId"));
  const warehouseId = Number(formData.get("warehouseId"));
  const orderedAtRaw = formData.get("orderedAt")?.toString();
  const note = formData.get("note")?.toString().trim() || null;
  const statusRaw = formData.get("status")?.toString();
  const status = statusRaw === "DRAFT" ? "DRAFT" : "ORDERED";

  if (!tenantId || !purchaseOrderId || !supplierId || !warehouseId || !orderedAtRaw) {
    redirect("/purchases?error=update_validation");
  }

  const orderedAt = new Date(`${orderedAtRaw}T00:00:00`);
  if (Number.isNaN(orderedAt.getTime())) {
    redirect("/purchases?error=update_validation");
  }

  const itemIds = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("item_"))
    .map(([, value]) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (itemIds.length === 0) {
    redirect("/purchases?error=update_validation");
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId },
      include: {
        supplier: { select: { name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { name: true } },
            variant: {
              select: {
                id: true,
                size: true,
                color: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { ok: false as const, reason: "validation" as const };
    }

    const hasAnyReceive = order.items.some((item) => item.receivedQuantity > 0);
    if (!["DRAFT", "ORDERED"].includes(order.status) || hasAnyReceive) {
      return { ok: false as const, reason: "state" as const };
    }

    const [supplier, warehouse] = await Promise.all([
      tx.supplier.findFirst({
        where: { id: supplierId, tenantId, isActive: true },
        select: { id: true, name: true },
      }),
      tx.warehouse.findFirst({
        where: { id: warehouseId, tenantId, isActive: true },
        select: { id: true, name: true },
      }),
    ]);

    if (!supplier || !warehouse) {
      return { ok: false as const, reason: "validation" as const };
    }

    const itemMap = new Map(order.items.map((item) => [item.id, item]));
    const updates: Array<{
      id: number;
      orderedQuantity: number;
      unitCost: number;
      note: string | null;
    }> = [];

    for (const itemId of itemIds) {
      const item = itemMap.get(itemId);
      if (!item) {
        return { ok: false as const, reason: "validation" as const };
      }

      const orderedQuantity = Math.floor(Number(formData.get(`quantity_${itemId}`)));
      const unitCost = Number(formData.get(`unitCost_${itemId}`));
      const itemNote = formData.get(`note_${itemId}`)?.toString().trim() || null;

      if (!Number.isInteger(orderedQuantity) || orderedQuantity <= 0) {
        return { ok: false as const, reason: "validation" as const };
      }

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        return { ok: false as const, reason: "validation" as const };
      }

      updates.push({ id: itemId, orderedQuantity, unitCost, note: itemNote });
    }

    if (updates.length !== order.items.length) {
      return { ok: false as const, reason: "validation" as const };
    }

    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        supplierId,
        warehouseId,
        orderedAt,
        note,
        status,
      },
    });

    for (const item of updates) {
      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: {
          orderedQuantity: item.orderedQuantity,
          unitCost: item.unitCost.toFixed(2),
          note: item.note,
        },
      });
    }

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "PURCHASE_ORDER_UPDATED",
      entityType: "PURCHASE_ORDER",
      entityId: order.id,
      entityLabel: `PO #${order.id}`,
      warehouseId,
      metadata: {
        supplier: supplier.name,
        warehouse: warehouse.name,
        status,
        orderedAt: orderedAt.toISOString(),
        lines: updates.map((item) => {
          const existing = itemMap.get(item.id)!;
          return {
            itemId: item.id,
            product:
              existing.variant?.product.name ??
              existing.product?.name ??
              existing.pendingProductName ??
              "Produkt i ri",
            size: existing.variant?.size ?? existing.pendingSize ?? "Standard",
            color: existing.variant?.color ?? existing.pendingColor ?? "Standard",
            quantity: item.orderedQuantity,
            unitCost: item.unitCost,
          };
        }),
      },
    });

    return { ok: true as const };
  });

  if (!result.ok) {
    redirect(`/purchases?error=${result.reason === "state" ? "update_state" : "update_validation"}`);
  }

  revalidatePath("/purchases");
  revalidatePath("/suppliers");
  redirect("/purchases?success=updated");
}

async function cancelPurchaseOrder(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const purchaseOrderId = Number(formData.get("purchaseOrderId"));

  if (!tenantId || !purchaseOrderId) {
    redirect("/purchases?error=cancel_state");
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId },
      include: {
        supplier: { select: { name: true } },
        warehouse: { select: { id: true, name: true } },
        items: { select: { orderedQuantity: true, receivedQuantity: true } },
      },
    });

    if (!order) {
      return { ok: false as const };
    }

    if (
      !["DRAFT", "ORDERED"].includes(order.status) ||
      order.items.some((item) => item.receivedQuantity > 0)
    ) {
      return { ok: false as const };
    }

    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: "CANCELED" },
    });

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "PURCHASE_ORDER_CANCELED",
      entityType: "PURCHASE_ORDER",
      entityId: order.id,
      entityLabel: `PO #${order.id}`,
      warehouseId: order.warehouse.id,
      metadata: {
        supplier: order.supplier.name,
        warehouse: order.warehouse.name,
        status: "CANCELED",
      },
    });

    return { ok: true as const };
  });

  if (!result.ok) {
    redirect("/purchases?error=cancel_state");
  }

  revalidatePath("/purchases");
  redirect("/purchases?success=canceled");
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
            product: {
              select: {
                id: true,
                name: true,
                brand: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
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

    if (!["ORDERED", "PARTIALLY_RECEIVED", "PARTIALLY_RETURNED"].includes(order.status)) {
      return { ok: false as const, reason: "state" as const };
    }

    const warehouseId = order.warehouse.id;

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

    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { catalogType: true },
    });

    const items = await tx.purchaseOrderItem.findMany({
      where: {
        purchaseOrderId,
        id: { in: adjustments.map((item) => item.itemId) },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
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
                warehouseId,
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
    const resolvedVariants = new Map<
      number,
      {
        variantId: number;
        productId: number;
        productName: string;
        size: string;
        color: string;
        inventoryId: number | null;
      }
    >();
    const resolvedPendingProducts = new Map<
      string,
      {
        id: number;
        name: string;
        brand: string | null;
        category: {
          id: number;
          name: string;
        };
      }
    >();

    const buildPendingProductKey = (item: (typeof items)[number]) =>
      [
        item.pendingCategoryName?.trim().toLowerCase() ?? "",
        item.pendingBrand?.trim().toLowerCase() ?? "",
        item.pendingProductName?.trim().toLowerCase() ?? "",
      ].join("::");

    async function resolveVariantForItem(item: (typeof items)[number]) {
      if (resolvedVariants.has(item.id)) {
        return resolvedVariants.get(item.id)!;
      }

      if (item.variant && item.product) {
        const resolved = {
          variantId: item.variant.id,
          productId: item.product.id,
          productName: item.product.name,
          size: item.variant.size,
          color: item.variant.color,
          inventoryId: item.variant.inventories[0]?.id ?? null,
        };
        resolvedVariants.set(item.id, resolved);
        return resolved;
      }

      let product = item.product;

      if (!product) {
        if (!tenant || !item.pendingCategoryName || !item.pendingProductName) {
          throw new Error("Missing pending purchase order product");
        }

        const pendingProductKey = buildPendingProductKey(item);
        const cachedProduct = resolvedPendingProducts.get(pendingProductKey);

        if (cachedProduct) {
          product = cachedProduct;
        } else {
          let category = await tx.category.findFirst({
            where: {
              tenantId,
              name: item.pendingCategoryName,
            },
            select: { id: true, name: true },
          });

          if (!category) {
            category = await tx.category.create({
              data: {
                tenantId,
                name: item.pendingCategoryName,
                catalogType: tenant.catalogType,
                isActive: true,
              },
              select: { id: true, name: true },
            });
          }

          product = await tx.product.create({
            data: {
              tenantId,
              categoryId: category.id,
              name: item.pendingProductName,
              brand: item.pendingBrand,
            },
            select: {
              id: true,
              name: true,
              brand: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          resolvedPendingProducts.set(pendingProductKey, product);
        }
      }

      const categoryConfig = getCategoryConfig(product.category.name);
      const size = item.pendingSize ?? "Standard";
      const color = item.pendingColor ?? "Standard";
      const material = item.pendingMaterial;
      const powerWatts = item.pendingPowerWatts;
      const variantIdentityKey =
        item.pendingVariantIdentityKey ??
        buildVariantIdentityKey(categoryConfig, {
          size,
          color,
          material,
          powerWatts,
        });

      let variant = await tx.variant.findFirst({
        where: {
          tenantId,
          productId: product.id,
          variantIdentityKey,
        },
        select: {
          id: true,
          size: true,
          color: true,
          inventories: {
            where: {
              warehouseId,
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      });

      if (!variant) {
        const existingSkus = await tx.variant.findMany({
          where: { productId: product.id },
          select: { sku: true },
        });
        const usedSkus = new Set(
          existingSkus.map((entry) => entry.sku).filter((sku): sku is string => Boolean(sku)),
        );
        const baseSku = buildVariantSku({
          productName: product.name,
          size,
          color,
        });
        const nextSku = ensureUniqueSku(baseSku, usedSkus);

        const createdVariant = await tx.variant.create({
          data: {
            tenantId,
            productId: product.id,
            size,
            color,
            stock: 0,
            price: item.unitCost,
            costPrice: item.unitCost,
            sku: nextSku,
            material,
            powerWatts,
            variantIdentityKey,
          },
          select: {
            id: true,
          },
        });

        const barcode = buildBarcodeFromVariantId(createdVariant.id);
        await tx.variant.update({
          where: { id: createdVariant.id },
          data: { barcode },
        });

        variant = {
          id: createdVariant.id,
          size,
          color,
          inventories: [],
        };
      }

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: {
          productId: product.id,
          variantId: variant.id,
        },
      });

      await tx.variant.update({
        where: { id: variant.id },
        data: {
          costPrice: item.unitCost,
        },
      });

      const resolved = {
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        size: variant.size,
        color: variant.color,
        inventoryId: variant.inventories[0]?.id ?? null,
      };
      resolvedVariants.set(item.id, resolved);
      return resolved;
    }

    for (const adjustment of adjustments) {
      const item = itemMap.get(adjustment.itemId);
      if (!item) {
        return { ok: false as const, reason: "items" as const };
      }

      const remaining = item.orderedQuantity - item.receivedQuantity;
      if (adjustment.quantity <= 0 || adjustment.quantity > remaining) {
        return { ok: false as const, reason: "items" as const };
      }

      const resolvedVariant = await resolveVariantForItem(item);

      if (resolvedVariant.inventoryId) {
        await tx.variantInventory.update({
          where: { id: resolvedVariant.inventoryId },
          data: {
            stock: {
              increment: adjustment.quantity,
            },
          },
        });
      } else {
        await tx.variantInventory.create({
          data: {
            variantId: resolvedVariant.variantId,
            warehouseId,
            stock: adjustment.quantity,
          },
        });
      }

      await tx.variant.update({
        where: { id: resolvedVariant.variantId },
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
        const resolvedVariant = resolvedVariants.get(item.id)!;
        return {
          tenantId,
          variantId: resolvedVariant.variantId,
          warehouseId,
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
        returnedQuantity: true,
      },
    });

    const nextStatus = derivePurchaseOrderStatus(refreshedItems);

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
      warehouseId,
      metadata: {
        supplier: order.supplier.name,
        warehouse: order.warehouse.name,
        status: nextStatus,
        receivedAt: new Date().toISOString(),
        adjustments: adjustments.map((adjustment) => {
          const item = itemMap.get(adjustment.itemId)!;
          const resolvedVariant = resolvedVariants.get(item.id)!;
          return {
            itemId: item.id,
            variantId: resolvedVariant.variantId,
            product: resolvedVariant.productName,
            size: resolvedVariant.size,
            color: resolvedVariant.color,
            quantity: adjustment.quantity,
          };
        }),
      },
    });

    return {
      ok: true as const,
      warehouseId,
      productIds: [...new Set(Array.from(resolvedVariants.values()).map((item) => item.productId))],
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

async function returnPurchaseOrderToSupplier(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const purchaseOrderId = Number(formData.get("purchaseOrderId"));
  const returnMode = formData.get("returnMode")?.toString();

  if (!tenantId || !purchaseOrderId) {
    redirect("/purchases?error=return_validation");
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId },
      include: {
        supplier: { select: { name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { name: true } },
            variant: {
              select: {
                id: true,
                stock: true,
                size: true,
                color: true,
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { ok: false as const, reason: "validation" as const };
    }

    if (!["RECEIVED", "PARTIALLY_RECEIVED", "PARTIALLY_RETURNED"].includes(order.status)) {
      return { ok: false as const, reason: "state" as const };
    }

    const warehouseId = order.warehouse.id;

    const itemMap = new Map(order.items.map((item) => [item.id, item]));

    const adjustments =
      returnMode === "all"
        ? order.items
            .map((item) => ({
              itemId: item.id,
              quantity: item.receivedQuantity - item.returnedQuantity,
            }))
            .filter((item) => item.quantity > 0)
        : Array.from(formData.entries())
            .filter(([key]) => key.startsWith("returned_"))
            .map(([key, value]) => ({
              itemId: Number(key.replace("returned_", "")),
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

    for (const adjustment of adjustments) {
      const item = itemMap.get(adjustment.itemId);
      if (!item || !item.variant) {
        return { ok: false as const, reason: "validation" as const };
      }

      const returnableQuantity = item.receivedQuantity - item.returnedQuantity;
      if (adjustment.quantity <= 0 || adjustment.quantity > returnableQuantity) {
        return { ok: false as const, reason: "validation" as const };
      }

      const inventory = await tx.variantInventory.findUnique({
        where: {
          variantId_warehouseId: {
            variantId: item.variant.id,
            warehouseId,
          },
        },
        select: { id: true, stock: true },
      });

      if (!inventory || inventory.stock < adjustment.quantity || item.variant.stock < adjustment.quantity) {
        return { ok: false as const, reason: "stock" as const };
      }

      await tx.variantInventory.update({
        where: { id: inventory.id },
        data: {
          stock: {
            decrement: adjustment.quantity,
          },
        },
      });

      await tx.variant.update({
        where: { id: item.variant.id },
        data: {
          stock: {
            decrement: adjustment.quantity,
          },
        },
      });

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: {
          returnedQuantity: {
            increment: adjustment.quantity,
          },
        },
      });
    }

    await tx.stockMovement.createMany({
      data: adjustments.map((adjustment) => ({
        tenantId,
        variantId: itemMap.get(adjustment.itemId)!.variant!.id,
        warehouseId,
        quantity: -adjustment.quantity,
        reason: "SUPPLIER_RETURN" as const,
      })),
    });

    const refreshedItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId },
      select: {
        orderedQuantity: true,
        receivedQuantity: true,
        returnedQuantity: true,
      },
    });

    const nextStatus = derivePurchaseOrderStatus(refreshedItems);

    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: nextStatus },
    });

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "PURCHASE_ORDER_RETURNED_TO_SUPPLIER",
      entityType: "PURCHASE_ORDER",
      entityId: order.id,
      entityLabel: `PO #${order.id}`,
      warehouseId,
      metadata: {
        supplier: order.supplier.name,
        warehouse: order.warehouse.name,
        status: nextStatus,
        returnedAt: new Date().toISOString(),
        adjustments: adjustments.map((adjustment) => {
          const item = itemMap.get(adjustment.itemId)!;
          return {
            itemId: item.id,
            variantId: item.variant?.id,
            product: item.variant?.product.name ?? item.product?.name ?? item.pendingProductName,
            size: item.variant?.size ?? item.pendingSize ?? "Standard",
            color: item.variant?.color ?? item.pendingColor ?? "Standard",
            quantity: adjustment.quantity,
          };
        }),
      },
    });

    return { ok: true as const };
  });

  if (!result.ok) {
    const code =
      result.reason === "state"
        ? "return_state"
        : result.reason === "stock"
          ? "return_stock"
          : "return_validation";
    redirect(`/purchases?error=${code}`);
  }

  revalidatePath("/purchases");
  revalidatePath("/products");
  revalidatePath("/stock/incoming");
  redirect("/purchases?success=returned");
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
  PARTIALLY_RETURNED: "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  RETURNED: "border border-violet-200 bg-violet-50 text-violet-700",
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

  const [suppliers, warehouses, categories, variants, purchaseOrders] = await Promise.all([
    prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    getTenantWarehouses(tenantId),
    prisma.category.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
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
            product: {
              select: {
                name: true,
              },
            },
            orderedQuantity: true,
            receivedQuantity: true,
            returnedQuantity: true,
            unitCost: true,
            note: true,
            pendingProductName: true,
            pendingBrand: true,
            pendingCategoryName: true,
            pendingColor: true,
            pendingSize: true,
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
      supplierId: order.supplierId,
      warehouseId: order.warehouseId,
      status: order.status,
      note: order.note,
      orderedAtLabel: formatDate(order.orderedAt),
      orderedAtValue: order.orderedAt.toISOString().slice(0, 10),
      supplierName: order.supplier.name,
      warehouseName: order.warehouse.name,
      totalLabel: formatMoney(total),
      itemCount: order.items.length,
      totalQuantity: order.items.reduce((sum, item) => sum + item.orderedQuantity, 0),
      items: order.items.map((item) => ({
        id: item.id,
        productName:
          item.variant?.product.name ??
          item.product?.name ??
          item.pendingProductName ??
          "Produkt i ri",
        size: item.variant?.size ?? item.pendingSize ?? "Standard",
        color: item.variant?.color ?? item.pendingColor ?? "Standard",
        isPending: !item.variant,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        returnedQuantity: item.returnedQuantity,
        remainingQuantity: Math.max(0, item.orderedQuantity - item.receivedQuantity),
        returnableQuantity: Math.max(0, item.receivedQuantity - item.returnedQuantity),
        unitCostLabel: formatMoney(Number(item.unitCost)),
        unitCostValue: Number(item.unitCost),
        lineTotalLabel: formatMoney(Number(item.unitCost) * item.orderedQuantity),
        note: item.note,
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
          updateAction={updatePurchaseOrder}
          cancelAction={cancelPurchaseOrder}
          receiveAction={receivePurchaseOrder}
          returnAction={returnPurchaseOrderToSupplier}
          suppliers={suppliers}
          warehouses={warehouses.map((warehouse) => ({
            id: warehouse.id,
            name: warehouse.name,
          }))}
          categoryOptions={categories.map((category) => category.name)}
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
