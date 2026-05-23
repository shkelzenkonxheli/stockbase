import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@/app/generated/prisma/client";
import { hasRole, requireRole, requireUser } from "@/lib/auth";
import {
  getCatalogAwareCategoryConfig,
  parseCategoryFieldConfig,
  parseVariantCustomAttributes,
} from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import { ProductVariantsFilters } from "./product-variants-filters";
import { VariantsManager } from "./variants-manager";

type ProductDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    size?: string;
    color?: string;
    stock?: string;
    feedback?: string;
    feedbackType?: string;
  }>;
};

function buildProductDetailsHref(
  productId: number,
  options: {
    size?: string;
    color?: string;
    stock?: string;
    feedback?: string;
    feedbackType?: string;
  } = {},
) {
  const params = new URLSearchParams();
  if (options.size) params.set("size", options.size);
  if (options.color) params.set("color", options.color);
  if (options.stock) params.set("stock", options.stock);
  if (options.feedback) params.set("feedback", options.feedback);
  if (options.feedbackType) params.set("feedbackType", options.feedbackType);
  const query = params.toString();
  return query ? `/products/${productId}?${query}` : `/products/${productId}`;
}

async function deleteVariant(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const variantId = Number(formData.get("variantId"));
  const productId = Number(formData.get("productId"));
  const selectedSize = formData.get("size")?.toString() || "";
  const selectedColor = formData.get("color")?.toString() || "";
  const selectedStock = formData.get("stock")?.toString() || "";

  if (!variantId || !productId || !tenantId) return;

  const variantWithOrders = await prisma.variant.findFirst({
    where: { id: variantId, tenantId, productId },
    select: {
      id: true,
      orders: { select: { id: true }, take: 1 },
    },
  });

  if (!variantWithOrders || variantWithOrders.orders.length > 0) {
    redirect(
      buildProductDetailsHref(productId, {
        size: selectedSize,
        color: selectedColor,
        stock: selectedStock,
        feedback: "Ky variant nuk u fshi sepse ka histori porosish.",
        feedbackType: "error",
      }),
    );
  }

  await prisma.variant.delete({ where: { id: variantId } });
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/orders/new");

  redirect(
    buildProductDetailsHref(productId, {
      size: selectedSize,
      color: selectedColor,
      stock: selectedStock,
      feedback: "Varianti u fshi me sukses.",
      feedbackType: "success",
    }),
  );
}

async function bulkDeleteVariants(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const productId = Number(formData.get("productId"));
  const variantIdsRaw = formData.get("variantIds")?.toString();
  const selectedSize = formData.get("size")?.toString() || "";
  const selectedColor = formData.get("color")?.toString() || "";
  const selectedStock = formData.get("stock")?.toString() || "";

  if (!productId || !variantIdsRaw || !tenantId) return;

  let parsedVariantIds: unknown;
  try {
    parsedVariantIds = JSON.parse(variantIdsRaw);
  } catch {
    return;
  }

  if (!Array.isArray(parsedVariantIds) || parsedVariantIds.length === 0) return;

  const variantIds = parsedVariantIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (variantIds.length === 0) return;

  const variants = await prisma.variant.findMany({
    where: { productId, tenantId, id: { in: variantIds } },
    select: {
      id: true,
      orders: { select: { id: true }, take: 1 },
      items: { select: { id: true }, take: 1 },
    },
  });

  const deletableIds = variants
    .filter((variant) => variant.orders.length === 0 && variant.items.length === 0)
    .map((variant) => variant.id);

  if (deletableIds.length === 0) {
    redirect(
      buildProductDetailsHref(productId, {
        size: selectedSize,
        color: selectedColor,
        stock: selectedStock,
        feedback: "Asnje variant nuk u fshi sepse te gjitha kane histori porosish.",
        feedbackType: "error",
      }),
    );
  }

  await prisma.variant.deleteMany({
    where: { productId, tenantId, id: { in: deletableIds } },
  });

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/orders/new");

  const blockedCount = variants.length - deletableIds.length;

  redirect(
    buildProductDetailsHref(productId, {
      size: selectedSize,
      color: selectedColor,
      stock: selectedStock,
      feedback:
        blockedCount > 0
          ? `${deletableIds.length} variante u fshine. ${blockedCount} nuk u fshine sepse kane histori porosish.`
          : `${deletableIds.length} variante u fshine me sukses.`,
      feedbackType: blockedCount > 0 ? "warning" : "success",
    }),
  );
}

export default async function ProductDetailsPage({
  params,
  searchParams,
}: ProductDetailsPageProps) {
  const currentUser = await requireUser();
  const tenantId = currentUser.tenant?.id;
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const productId = Number(id);

  if (Number.isNaN(productId) || !tenantId) notFound();

  const selectedSize = resolvedSearchParams?.size?.trim() || "";
  const selectedColor = resolvedSearchParams?.color?.trim() || "";
  const selectedStock = resolvedSearchParams?.stock?.trim() || "";
  const feedbackMessage = resolvedSearchParams?.feedback?.trim() || "";
  const feedbackType = resolvedSearchParams?.feedbackType?.trim() || "";

  const variantsWhere: Prisma.VariantWhereInput = {
    tenantId,
    productId,
    ...(selectedSize ? { size: selectedSize } : {}),
    ...(selectedColor ? { color: selectedColor } : {}),
    ...(selectedStock === "in" ? { stock: { gt: 0 } } : {}),
    ...(selectedStock === "low" ? { stock: { gt: 0, lte: 5 } } : {}),
    ...(selectedStock === "out" ? { stock: 0 } : {}),
  };

  const [product, allVariants, filteredVariants] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: {
        id: true,
        name: true,
        brand: true,
        category: { select: { name: true, config: true } },
        variants: {
          select: {
            stockMovements: {
              select: {
                id: true,
                quantity: true,
                reason: true,
                createdAt: true,
                variant: { select: { size: true, color: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 4,
            },
          },
        },
      },
    }),
    prisma.variant.findMany({
      where: { productId, tenantId },
      select: {
        id: true,
        size: true,
        color: true,
        material: true,
        powerWatts: true,
        sku: true,
        barcode: true,
        imagePath: true,
        stock: true,
        price: true,
        customAttributes: true,
      },
      orderBy: [{ color: "asc" }, { size: "asc" }],
    }),
    prisma.variant.findMany({
      where: variantsWhere,
      select: {
        id: true,
        size: true,
        color: true,
        material: true,
        powerWatts: true,
        sku: true,
        barcode: true,
        imagePath: true,
        stock: true,
        price: true,
        customAttributes: true,
      },
      orderBy: [{ color: "asc" }, { size: "asc" }],
    }),
  ]);

  if (!product) notFound();

  const totalStock = allVariants.reduce((sum, variant) => sum + variant.stock, 0);
  const colors = [...new Set(allVariants.map((variant) => variant.color))];
  const sizes = [...new Set(allVariants.map((variant) => variant.size))];
  const materials = [...new Set(allVariants.map((variant) => variant.material).filter(Boolean))];
  const watts = [...new Set(allVariants.map((variant) => variant.powerWatts).filter(Boolean))];
  const canManageInventory = hasRole(currentUser, ["SUPER_ADMIN"]);
  const latestMovements = product.variants
    .flatMap((variant) => variant.stockMovements)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 4);
  const weeklyIncoming = latestMovements
    .filter((movement) => movement.reason === "INCOMING_STOCK")
    .reduce((sum, movement) => sum + movement.quantity, 0);
  const returnCount = latestMovements
    .filter((movement) => movement.reason === "CUSTOMER_RETURN")
    .reduce((sum, movement) => sum + movement.quantity, 0);
  const categoryConfig = getCatalogAwareCategoryConfig(
    currentUser.tenant?.catalogType,
    product.category.name,
    currentUser.tenant?.catalogConfig,
    parseCategoryFieldConfig(product.category.config),
  );

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="space-y-5 rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Inventory / Produkte
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {product.brand ? `${product.brand} ${product.name}` : product.name}
              </h1>
              <p className="mt-2 text-base text-slate-600">
                {product.category.name}
                {product.brand ? ` · ${product.brand}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
              >
                Kthehu te produktet
              </Link>
              {canManageInventory ? (
                <Link
                  href={`/products/${product.id}/edit`}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
                >
                  Edito produktin
                </Link>
              ) : null}
              {canManageInventory ? (
                <Link
                  href={`/products/${product.id}/variants/new`}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
                >
                  + Shto Variant
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white px-3 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-4 sm:py-5">
          {allVariants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center">
              <p className="text-base font-medium text-slate-900">Ky produkt ende nuk ka variante</p>
              <p className="mt-2 text-sm text-slate-600">
                Shto variantin e pare per te filluar menaxhimin e stokut.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbackMessage ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    feedbackType === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : feedbackType === "warning"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {feedbackMessage}
                </div>
              ) : null}

              <ProductVariantsFilters
                selectedSize={selectedSize}
                selectedColor={selectedColor}
                selectedStock={selectedStock}
                sizes={sizes}
                colors={colors}
              />

              <p className="px-1 text-sm text-slate-600">
                Po shfaqen <span className="font-semibold text-slate-950">{filteredVariants.length}</span> nga{" "}
                <span className="font-semibold text-slate-950">{allVariants.length}</span> variante
              </p>

              <VariantsManager
                productId={product.id}
                productName={product.name}
                canManageInventory={canManageInventory}
                selectedSize={selectedSize}
                selectedColor={selectedColor}
                selectedStock={selectedStock}
                variants={filteredVariants.map((variant) => ({
                  id: variant.id,
                  size: variant.size,
                  color: variant.color,
                  material: variant.material ?? null,
                  powerWatts: variant.powerWatts ?? null,
                  sku: variant.sku,
                  barcode: variant.barcode,
                  imagePath: variant.imagePath,
                  stock: variant.stock,
                  price: Number(variant.price),
                  customAttributes: parseVariantCustomAttributes(variant.customAttributes),
                }))}
                customFields={categoryConfig.customVariantFields.filter((field) => field.enabled)}
                deleteVariantAction={deleteVariant}
                bulkDeleteAction={bulkDeleteVariants}
              />
            </div>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          <article className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="border-l-[3px] border-slate-950 pl-4">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Informacioni i Produktit
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                {`${product.brand ? `${product.brand} ` : ""}${product.name} ben pjese ne kategorine ${product.category.name}. ${categoryConfig.description}`}
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Kategoria
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{product.category.name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Struktura
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {sizes.length} dimensione / {colors.length} ngjyra
                </p>
              </div>
              {materials.length > 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Materialet
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{materials.join(", ")}</p>
                </div>
              ) : null}
              {watts.length > 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Fuqia
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{watts.join(", ")}</p>
                </div>
              ) : null}
            </div>
          </article>

          <aside className="rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Trendi i Inventarit
            </h2>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">Hyrje te fundit</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                  +{weeklyIncoming}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">Kthime</span>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-600">
                  {returnCount}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-600">Stoku total</span>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                  {totalStock}
                </span>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
