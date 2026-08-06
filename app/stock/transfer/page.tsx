import Link from "next/link";
import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit-log";
import { parseTenantCatalogConfig } from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import { getTenantWarehouses } from "@/lib/warehouses";
import { TransferStockForm } from "./transfer-stock-form";

export const metadata: Metadata = {
  title: "Transfer Stoku",
};

type TransferStockPageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

async function createTransfer(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const productId = Number(formData.get("productId"));
  const fromWarehouseId = Number(formData.get("fromWarehouseId"));
  const toWarehouseId = Number(formData.get("toWarehouseId"));
  const adjustmentsRaw = formData.get("adjustments")?.toString();

  if (!tenantId || !productId || !fromWarehouseId || !toWarehouseId || !adjustmentsRaw) {
    redirect("/stock/transfer?error=validation");
  }

  if (fromWarehouseId === toWarehouseId) {
    redirect("/stock/transfer?error=same-warehouse");
  }

  let parsedAdjustments: unknown;

  try {
    parsedAdjustments = JSON.parse(adjustmentsRaw);
  } catch {
    redirect("/stock/transfer?error=validation");
  }

  if (!Array.isArray(parsedAdjustments) || parsedAdjustments.length === 0) {
    redirect("/stock/transfer?error=validation");
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

      return { variantId, quantity };
    })
    .filter((item): item is { variantId: number; quantity: number } => item !== null);

  if (adjustments.length === 0) {
    redirect("/stock/transfer?error=validation");
  }

  const result = await prisma.$transaction(async (tx) => {
    const variants = await tx.variant.findMany({
      where: {
        tenantId,
        productId,
        id: { in: adjustments.map((item) => item.variantId) },
      },
      select: {
        id: true,
        size: true,
        color: true,
        inventories: {
          where: {
            warehouseId: {
              in: [fromWarehouseId, toWarehouseId],
            },
          },
          select: {
            id: true,
            warehouseId: true,
            stock: true,
            locationCode: true,
          },
        },
      },
    });

    if (variants.length !== adjustments.length) {
      return { ok: false as const, reason: "variant" };
    }

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

    for (const adjustment of adjustments) {
      const variant = variantsById.get(adjustment.variantId);
      const sourceInventory = variant?.inventories.find(
        (inventory) => inventory.warehouseId === fromWarehouseId,
      );

      if (!variant || !sourceInventory || sourceInventory.stock < adjustment.quantity) {
        return { ok: false as const, reason: "stock" };
      }
    }

    for (const adjustment of adjustments) {
      const variant = variantsById.get(adjustment.variantId)!;
      const sourceInventory = variant.inventories.find(
        (inventory) => inventory.warehouseId === fromWarehouseId,
      )!;
      const targetInventory = variant.inventories.find(
        (inventory) => inventory.warehouseId === toWarehouseId,
      );

      await tx.variantInventory.update({
        where: { id: sourceInventory.id },
        data: {
          stock: {
            decrement: adjustment.quantity,
          },
        },
      });

      if (targetInventory) {
        await tx.variantInventory.update({
          where: { id: targetInventory.id },
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
            warehouseId: toWarehouseId,
            stock: adjustment.quantity,
            locationCode: null,
          },
        });
      }

      await tx.stockMovement.createMany({
        data: [
          {
            tenantId,
            variantId: adjustment.variantId,
            warehouseId: fromWarehouseId,
            quantity: -adjustment.quantity,
            reason: "TRANSFER",
          },
          {
            tenantId,
            variantId: adjustment.variantId,
            warehouseId: toWarehouseId,
            quantity: adjustment.quantity,
            reason: "TRANSFER",
          },
        ],
      });
    }

    await writeAuditLog(tx, {
      tenantId,
      userId: currentUser.id,
      action: "STOCK_TRANSFER_CREATED",
      entityType: "TRANSFER",
      entityId: productId,
      entityLabel: `Produkti #${productId}`,
      warehouseId: toWarehouseId,
      metadata: {
        fromWarehouseId,
        toWarehouseId,
        adjustments: adjustments.map((adjustment) => {
          const variant = variantsById.get(adjustment.variantId);
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
    redirect(`/stock/transfer?error=${result.reason}`);
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/stock/incoming");
  revalidatePath("/stock/transfer");
  revalidatePath("/orders/new");
  revalidatePath("/orders/quick");

  redirect("/stock/transfer?success=1");
}

function getMessage(error?: string, success?: string) {
  if (error === "validation") {
    return {
      type: "error" as const,
      text: "Zgjedh te dy depot, produktin dhe te pakten nje variant me sasi.",
    };
  }

  if (error === "same-warehouse") {
    return {
      type: "error" as const,
      text: "Depoja burim dhe depoja destinacion duhet te jene te ndryshme.",
    };
  }

  if (error === "stock") {
    return {
      type: "error" as const,
      text: "Nuk ka stok te mjaftueshem ne depon burim per kete transfer.",
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
      text: "Transferi i stokut u ruajt me sukses.",
    };
  }

  return null;
}

export default async function TransferStockPage({
  searchParams,
}: TransferStockPageProps) {
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

  const [warehouses, products] = await Promise.all([
    getTenantWarehouses(
      tenantId,
      parseTenantCatalogConfig(tenantSettings?.catalogConfig),
    ),
    prisma.product.findMany({
      where: {
        tenantId,
        variants: { some: {} },
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
  ]);

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Transfer Stoku
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Transfer stoku mes depove
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Zgjedh produktin, depon burim dhe depon destinacion per te levizur stokun.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/stock/incoming"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Hyrje stoku
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Shiko produktet
            </Link>
          </div>
        </div>

        {message ? (
          <FlashMessage
            type={message.type}
            text={message.text}
            className="mt-6 rounded-2xl px-4 py-3 text-sm shadow-sm"
          />
        ) : null}

        <TransferStockForm
          action={createTransfer}
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
      </section>
    </main>
  );
}
