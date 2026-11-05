import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/app/generated/prisma/client";
import { ConfirmActionForm } from "@/app/components/confirm-action-form";
import { hasRole, requireRole, requireUser } from "@/lib/auth";
import { isLowStock } from "@/lib/inventory";
import { isMultiWarehouseEnabled } from "@/lib/inventory-module-access";
import {
  getCatalogAwareCategoryConfig,
  getProductListViewConfig,
  parseCategoryFieldConfig,
  type ProductListFieldKey,
} from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import { getTenantWarehouses } from "@/lib/warehouses";
import { ProductsFilters } from "./products-filters";
import { ProductStockQuickView } from "./product-stock-quick-view";

function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path d="M4.5 4.5h4v4h-4zm7 0h4v4h-4zm-7 7h4v4h-4zm7 0h4v4h-4z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="m13.958 4.375 1.667 1.667M5.417 14.583l2.166-.416 7.5-7.5a1.179 1.179 0 0 0 0-1.667l-.833-.833a1.179 1.179 0 0 0-1.667 0l-7.5 7.5-.416 2.166Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: "Produktet",
};

type ProductsPageProps = {
  searchParams?: Promise<{
    page?: string;
    q?: string;
    code?: string;
    category?: string;
    model?: string;
    warehouse?: string;
    stock?: string;
  }>;
};

function buildProductsPageHref(
  page: number,
  q: string,
  code: string,
  category: string,
  model: string,
  warehouse: string,
  stock: string,
) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (q) params.set("q", q);
  if (code) params.set("code", code);
  if (category) params.set("category", category);
  if (model) params.set("model", model);
  if (warehouse) params.set("warehouse", warehouse);
  if (stock) params.set("stock", stock);
  return `/products?${params.toString()}`;
}

function buildProductDetailsHref(
  productId: number,
  options: {
    warehouse?: string;
    returnTo?: string;
  },
) {
  const params = new URLSearchParams();
  if (options.warehouse) {
    params.set("warehouse", options.warehouse);
  }
  if (options.returnTo) {
    params.set("returnTo", options.returnTo);
  }
  return `/products/${productId}?${params.toString()}`;
}

function summarizeList(values: string[], visibleCount: number) {
  if (values.length === 0) {
    return "-";
  }

  if (values.length <= visibleCount) {
    return values.join(", ");
  }

  return `${values.slice(0, visibleCount).join(", ")} ...`;
}

async function deleteProduct(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const productId = Number(formData.get("productId"));
  if (!Number.isSafeInteger(productId) || productId <= 0 || !tenantId) return;

  const deleted = await prisma.product.deleteMany({
    where: { id: productId, tenantId, variants: { none: {} } },
  });
  if (!deleted.count) return;
  revalidatePath("/");
  revalidatePath("/products");
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const currentUser = await requireUser();
  const tenant = currentUser.tenant;
  if (!tenant) {
    return null;
  }
  const tenantId = tenant.id;
  const canManageInventory = hasRole(currentUser, ["SUPER_ADMIN"]);
  const canQuickAdjustStock = hasRole(currentUser, ["SUPER_ADMIN", "WAREHOUSE"]);
  const savedProductListView = getProductListViewConfig(tenant.catalogConfig);
  const productListView = {
    ...savedProductListView,
    layout: "list" as const,
    density: "comfortable" as const,
  };
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const searchQuery = resolvedSearchParams?.q?.trim() || "";
  const selectedCode = resolvedSearchParams?.code?.trim().toUpperCase() || "";
  const selectedCategory = resolvedSearchParams?.category?.trim() || "";
  const selectedModel = resolvedSearchParams?.model?.trim() || "";
  const selectedWarehouse = resolvedSearchParams?.warehouse?.trim() || "";
  const selectedStock = resolvedSearchParams?.stock?.trim() || "in";
  const currentPage = Math.max(1, Number(resolvedSearchParams?.page) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;
  const currentListHref = buildProductsPageHref(
    currentPage,
    searchQuery,
    selectedCode,
    selectedCategory,
    selectedModel,
    selectedWarehouse,
    selectedStock,
  );
  const warehouseRecords = await getTenantWarehouses(tenantId, tenant.catalogConfig);
  const transferWarehouses = warehouseRecords.filter((warehouse) => warehouse.isActive).map(({ id, name }) => ({ id, name }));
  const canTransferStock = canManageInventory && isMultiWarehouseEnabled(tenant.catalogConfig) && transferWarehouses.length > 1;
  const selectedWarehouseRecord =
    warehouseRecords.find(
      (warehouse) => warehouse.name.toLowerCase() === selectedWarehouse.toLowerCase(),
    ) ?? null;
  const activeWarehouseId = selectedWarehouseRecord?.id ?? null;
  const filters: Prisma.ProductWhereInput[] = [];
  const scannedVariant = selectedCode
    ? await prisma.variant.findFirst({
        where: {
          tenantId,
          OR: [{ barcode: selectedCode }, { sku: selectedCode }],
          ...(activeWarehouseId
            ? {
                inventories: {
                  some: {
                    warehouseId: activeWarehouseId,
                  },
                },
              }
            : {}),
        },
        select: {
          productId: true,
        },
      })
    : null;
  const searchTokens = searchQuery.split(/\s+/).map((token) => token.trim()).filter(Boolean);

  if (selectedCode) {
    if (scannedVariant) {
      filters.push({
        id: scannedVariant.productId,
      });
    } else {
      filters.push({
        id: -1,
      });
    }
  }

  const getVariantDisplayStock = (
    variant: {
      stock: number;
      reorderLevel?: number | null;
      inventories?: Array<{
        stock: number;
        locationCode?: string | null;
      }>;
    },
  ) =>
    selectedWarehouseRecord
      ? (variant.inventories?.[0]?.stock ?? 0)
      : variant.inventories && variant.inventories.length > 0
        ? variant.inventories.reduce((inventorySum, inventory) => inventorySum + inventory.stock, 0)
        : variant.stock;

  const getVariantDisplayLocation = (
    variant: {
      locationCode?: string | null;
      inventories?: Array<{
        locationCode?: string | null;
      }>;
    },
  ) =>
    selectedWarehouseRecord
      ? (variant.inventories?.[0]?.locationCode ?? null)
      : variant.locationCode ?? null;

  if (searchTokens.length > 0) {
    filters.push({
      AND: searchTokens.map((token) => ({
        OR: [
          { name: { contains: token, mode: "insensitive" } },
          { brand: { contains: token, mode: "insensitive" } },
          { warehouseName: { contains: token, mode: "insensitive" } },
          { category: { name: { contains: token, mode: "insensitive" } } },
          { variants: { some: { color: { contains: token, mode: "insensitive" } } } },
          { variants: { some: { size: { contains: token, mode: "insensitive" } } } },
          { variants: { some: { material: { contains: token, mode: "insensitive" } } } },
          { variants: { some: { powerWatts: { contains: token, mode: "insensitive" } } } },
          { variants: { some: { sku: { contains: token, mode: "insensitive" } } } },
        ],
      })),
    });
  }

  if (selectedCategory) {
    filters.push({
      category: { name: { equals: selectedCategory, mode: "insensitive" } },
    });
  }

  if (selectedModel) {
    filters.push({
      name: { equals: selectedModel, mode: "insensitive" },
    });
  }

  if (selectedWarehouse) {
    filters.push({
      variants: {
        some: {
          inventories: {
            some: {
              warehouseId: selectedWarehouseRecord?.id ?? -1,
            },
          },
        },
      },
    });
  }

  const positiveStockVariant: Prisma.VariantWhereInput = selectedWarehouseRecord && activeWarehouseId
    ? { inventories: { some: { warehouseId: activeWarehouseId, stock: { gt: 0 } } } }
    : { OR: [
      { inventories: { some: { stock: { gt: 0 } } } },
      { inventories: { none: {} }, stock: { gt: 0 } },
    ] };

  const where: Prisma.ProductWhereInput = {
    tenantId,
    ...(selectedStock === "out"
      ? { variants: { none: positiveStockVariant } }
      : selectedStock === "in"
        ? { variants: { some: positiveStockVariant } }
        : selectedStock === "all" ? {} : { variants: { some: {} } }),
    ...(filters.length > 0 ? { AND: filters } : {}),
  };

  const filterOptionsWhere: Prisma.ProductWhereInput = {
    tenantId,
    ...(selectedWarehouseRecord && activeWarehouseId
      ? { variants: { some: { inventories: { some: { warehouseId: activeWarehouseId } } } } }
      : selectedStock === "out" || selectedStock === "all" ? {} : { variants: { some: {} } }),
    ...(searchTokens.length > 0 || selectedCode
      ? {
          AND: filters.filter(
            (filter) =>
              !("category" in filter) &&
              !("name" in filter && typeof filter.name === "object" && "equals" in filter.name),
          ),
        }
      : {}),
  };

  const stockTotalPromise = selectedWarehouseRecord && activeWarehouseId
    ? prisma.variantInventory.aggregate({
        where: {
          warehouseId: activeWarehouseId,
          variant: {
            product: {
              tenantId,
              ...(filters.length > 0 ? { AND: filters.filter((_, index) => index !== filters.length - 1) } : {}),
            },
          },
        },
        _sum: { stock: true },
      }).then((result) => result._sum.stock ?? 0)
    : Promise.all([
        prisma.variantInventory.aggregate({
          where: { variant: { product: where } },
          _sum: { stock: true },
        }),
        prisma.variant.aggregate({
          where: { product: where, inventories: { none: {} } },
          _sum: { stock: true },
        }),
      ]).then(([inventories, legacyVariants]) =>
        (inventories._sum.stock ?? 0) + (legacyVariants._sum.stock ?? 0),
      );

  const [products, totalProducts, filterProducts, totalUnits] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        brand: true,
        warehouseName: true,
        category: { select: { name: true, config: true } },
        variants: {
          where: selectedWarehouseRecord && activeWarehouseId
            ? {
                inventories: {
                  some: {
                    warehouseId: activeWarehouseId,
                  },
                },
              }
            : undefined,
          select: {
            id: true,
            size: true,
            color: true,
            material: true,
            powerWatts: true,
            locationCode: true,
            sku: true,
            imagePath: true,
            stock: true,
            reorderLevel: true,
            price: true,
            inventories: selectedWarehouseRecord && activeWarehouseId
              ? {
                  where: { warehouseId: activeWarehouseId },
                  select: {
                    stock: true,
                    locationCode: true,
                  },
                  take: 1,
                }
              : {
                  select: {
                    stock: true,
                    locationCode: true,
                  },
                },
          },
        },
      },
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where: filterOptionsWhere,
      select: { name: true, brand: true, warehouseName: true, category: { select: { name: true } } },
      orderBy: [{ name: "asc" }],
    }),
    stockTotalPromise,
  ]);

  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const previousPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  const categories = [...new Set(filterProducts.map((product) => product.category.name))];
  const warehouses = warehouseRecords.map((warehouse) => warehouse.name);
  const models = [
    ...new Set(
      filterProducts.map(
        (product) =>
          `${product.category.name.toLowerCase()}::${product.brand ? `${product.brand} ` : ""}${product.name}`,
      ),
    ),
  ];
  const stockMatchesFilter = (variant: {
    stock: number;
    reorderLevel?: number | null;
    inventories?: Array<{ stock: number }>;
  }) => {
    const displayStock = getVariantDisplayStock(variant);

    if (selectedStock === "low") {
      return isLowStock(displayStock, variant.reorderLevel);
    }

    if (selectedStock === "out") {
      return displayStock <= 0;
    }

    if (selectedStock === "in") {
      return displayStock > 0;
    }

    return true;
  };

  const visibleProducts = products.filter((product) => selectedStock === "out"
    ? product.variants.every((variant) => getVariantDisplayStock(variant) <= 0)
    : selectedStock === "all" || product.variants.some((variant) => stockMatchesFilter(variant)));

  const lowStockProducts = visibleProducts.filter((product) =>
    product.variants.some((variant) => {
      const displayStock = getVariantDisplayStock(variant);
      return isLowStock(displayStock, variant.reorderLevel);
    }),
  ).length;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-3">
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,35,27,0.055)]">
          <div className="flex flex-col gap-4 px-5 py-4 sm:px-7 lg:flex-row lg:items-start lg:justify-between lg:px-8">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Katalogu / Inventari</p>
              <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-[-0.045em] text-slate-950 sm:text-4xl">Produktet</h1>
              <p className="mt-1 text-sm text-slate-500">Menaxho produktet, variantet dhe stokun ne nje vend.</p>
            </div>
            {canManageInventory ? (
              <div className="flex flex-wrap gap-2.5">
                <Link href="/products/import" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.7]"><path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 12.5v3A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Importo
                </Link>
                <Link href="/products/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#093a2d] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(9,58,45,0.14)] transition hover:bg-emerald-800">
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]"><path d="M10 4v12M4 10h12" strokeLinecap="round" /></svg>
                  Shto produkt
                </Link>
              </div>
            ) : null}
          </div>
          <dl className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 bg-[#fbfcfa] px-2 py-2.5 sm:px-5">
            <div className="min-w-0 px-3 sm:px-5"><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Produkte</dt><dd className="mt-1 text-xl font-bold tabular-nums text-slate-950 sm:text-2xl">{totalProducts.toLocaleString("sq-AL")}</dd></div>
            <div className="min-w-0 px-3 sm:px-5"><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Njesi ne total</dt><dd className="mt-1 text-xl font-bold tabular-nums text-slate-950 sm:text-2xl">{totalUnits.toLocaleString("sq-AL")}</dd></div>
            <div className="min-w-0 px-3 sm:px-5"><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Stok i ulet ne faqe</dt><dd className="mt-1 text-xl font-bold tabular-nums text-rose-700 sm:text-2xl">{lowStockProducts}</dd></div>
          </dl>
        </section>

        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,35,27,0.055)]">
          <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
            <ProductsFilters
              key={`${searchQuery}|${selectedCode}|${selectedCategory}|${selectedModel}|${selectedWarehouse}|${selectedStock}`}
              searchQuery={searchQuery}
              selectedCode={selectedCode}
              selectedCategory={selectedCategory}
              selectedModel={selectedModel}
              selectedWarehouse={selectedWarehouse}
              selectedStock={selectedStock}
              categories={categories}
              models={models}
              warehouses={warehouses}
            />
          </div>

          {visibleProducts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-base font-medium text-slate-900">
                {searchQuery || selectedCategory || selectedModel || selectedWarehouse || selectedStock
                  ? "Nuk u gjet asnje produkt me keto filtra"
                  : "Nuk ka ende produkte te regjistruara"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {searchQuery || selectedCategory || selectedModel || selectedWarehouse || selectedStock
                  ? "Provo nje kerkese tjeter ose bej reset."
                  : "Shto produktin e pare dhe vazhdo me variantet per te filluar inventarin."}
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <div className="space-y-3 lg:hidden">
                {visibleProducts.map((product) => {
                  const dimensions = [...new Set(product.variants.map((variant) => variant.size))];
                  const colors = [...new Set(product.variants.map((variant) => variant.color))];
                  const materials = [
                    ...new Set(product.variants.map((variant) => variant.material).filter(Boolean)),
                  ];
                  const watts = [
                    ...new Set(product.variants.map((variant) => variant.powerWatts).filter(Boolean)),
                  ];
                  const totalStock = product.variants.reduce(
                    (sum, variant) => sum + getVariantDisplayStock(variant),
                    0,
                  );
                  const prices = product.variants.map((variant) => Number(variant.price));
                  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
                  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
                  const previewVariant =
                    product.variants.find((variant) => variant.imagePath) ?? product.variants[0];
                  const fieldValues: Record<ProductListFieldKey, string | null> = {
                    brand: product.brand ?? null,
                    category: product.category.name,
                    warehouse: product.warehouseName ?? null,
                    stock: totalStock.toLocaleString("sq-AL"),
                    price:
                      minPrice === null
                        ? "-"
                        : minPrice === maxPrice
                          ? `${minPrice.toFixed(2)} EUR`
                          : `${minPrice.toFixed(2)} - ${maxPrice?.toFixed(2)} EUR`,
                    sizes: summarizeList(dimensions, 3),
                    colors: summarizeList(colors, 2),
                    materials: materials.length > 0 ? materials.join(", ") : null,
                    power: watts.length > 0 ? watts.join(", ") : null,
                  };
                  const fieldLabels: Record<ProductListFieldKey, string> = {
                    brand: "Brandi",
                    category: "Kategoria",
                    warehouse: "Depoja",
                    stock: "Stoku",
                    price: "Cmimi",
                    sizes: "Madhesia",
                    colors: "Ngjyrat",
                    materials: "Materialet",
                    power: "Fuqia",
                  };

                  return (
                    <article
                      key={product.id}
                      className="relative rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fdf9_100%)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                    >
                      <details className="absolute right-4 top-4 z-10 lg:hidden">
                        <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
                          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                            <circle cx="4.5" cy="10" r="1.4" />
                            <circle cx="10" cy="10" r="1.4" />
                            <circle cx="15.5" cy="10" r="1.4" />
                          </svg>
                        </summary>
                        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl border border-emerald-100 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                          <div className="flex flex-col gap-2">
                            <ProductStockQuickView
                              productId={product.id}
                              productName={product.brand ? `${product.brand} ${product.name}` : product.name}
                              productBrand={product.category.name}
                              warehouseId={activeWarehouseId}
                              warehouseName={selectedWarehouse || product.warehouseName}
                              categoryConfig={getCatalogAwareCategoryConfig(
                                tenant.catalogType,
                                product.category.name,
                                tenant.catalogConfig,
                                parseCategoryFieldConfig(product.category.config),
                              )}
                              imagePath={previewVariant?.imagePath ?? null}
                              variants={product.variants.map((variant) => ({
                                id: variant.id,
                                size: variant.size,
                                color: variant.color,
                                imagePath: variant.imagePath,
                                stock: getVariantDisplayStock(variant),
                                reorderLevel: variant.reorderLevel,
                                price: Number(variant.price),
                                material: variant.material,
                                powerWatts: variant.powerWatts,
                                locationCode: getVariantDisplayLocation(variant),
                              }))}
                              showImageButton={false}
                              canAdjustStock={canQuickAdjustStock}
                              canDeleteColor={canManageInventory}
                              canTransferStock={canTransferStock}
                              transferWarehouses={transferWarehouses}
                              className="w-full"
                            />
                            <Link
                              href={buildProductDetailsHref(product.id, {
                                warehouse: selectedWarehouse,
                                returnTo: currentListHref,
                              })}
                              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                            >
                              Menaxho
                            </Link>
                            {canManageInventory ? (
                              <Link
                                href={`/products/${product.id}/edit`}
                                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                              >
                                Edito
                              </Link>
                            ) : null}
                            {canManageInventory && product.variants.length === 0 ? (
                              <ConfirmActionForm
                                action={deleteProduct}
                                hiddenFields={[{ name: "productId", value: product.id }]}
                                confirmMessage="A je i sigurt qe don ta fshish kete produkt?"
                                buttonLabel="Fshi"
                                className="inline-flex w-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                              />
                            ) : null}
                          </div>
                        </div>
                      </details>

                      <div className="flex items-start gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-emerald-100 bg-slate-100">
                          <ProductStockQuickView
                            productId={product.id}
                            productName={product.brand ? `${product.brand} ${product.name}` : product.name}
                            productBrand={product.category.name}
                            warehouseId={activeWarehouseId}
                            warehouseName={selectedWarehouse || product.warehouseName}
                            categoryConfig={getCatalogAwareCategoryConfig(
                              tenant.catalogType,
                              product.category.name,
                              tenant.catalogConfig,
                              parseCategoryFieldConfig(product.category.config),
                            )}
                            imagePath={previewVariant?.imagePath ?? null}
                            variants={product.variants.map((variant) => ({
                              id: variant.id,
                              size: variant.size,
                              color: variant.color,
                              imagePath: variant.imagePath,
                              stock: getVariantDisplayStock(variant),
                              reorderLevel: variant.reorderLevel,
                              price: Number(variant.price),
                              material: variant.material,
                              powerWatts: variant.powerWatts,
                              locationCode: getVariantDisplayLocation(variant),
                            }))}
                            className="h-full w-full"
                            canAdjustStock={canQuickAdjustStock}
                            canDeleteColor={canManageInventory}
                            canTransferStock={canTransferStock}
                            transferWarehouses={transferWarehouses}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-base font-semibold text-slate-950">
                            {product.name}
                          </h2>
                          <p className="mt-1 text-xs text-slate-500">
                            {product.variants.length} variante
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-600">
                        {productListView.order
                          .filter((key) => productListView.visibility[key] && fieldValues[key])
                          .map((key) => (
                            <p key={key} className="break-words">
                              <span className="font-medium text-emerald-800">{fieldLabels[key]}:</span>{" "}
                              {fieldValues[key]}
                            </p>
                          ))}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full text-sm">
                  <colgroup>
                    <col className="w-[250px]" />
                    {productListView.order
                      .filter((key) => productListView.visibility[key])
                      .map((key) => (
                        <col
                          key={key}
                          className={
                            key === "stock"
                              ? "w-[90px]"
                              : key === "price"
                                ? "w-[130px]"
                                : key === "sizes" || key === "colors"
                                  ? "w-[120px]"
                                  : "w-[130px]"
                          }
                        />
                      ))}
                    <col className="w-[170px]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,#f6fdf8_0%,#eef8f1_100%)] text-left backdrop-blur">
                    <tr className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                      <th className="px-4 py-4">Produkti</th>
                      {productListView.order
                        .filter((key) => productListView.visibility[key])
                        .map((key) => (
                          <th key={key} className="px-4 py-4">
                            {{
                              brand: "Brandi",
                              category: "Kategoria",
                              warehouse: "Depoja",
                              stock: "Stoku",
                              price: "Cmimi",
                              sizes: "Madhesia",
                              colors: "Ngjyrat",
                              materials: "Materialet",
                              power: "Fuqia",
                            }[key]}
                          </th>
                        ))}
                      <th className="px-4 py-4 text-right">Veprime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50 bg-white">
                    {visibleProducts.map((product) => {
                      const dimensions = [...new Set(product.variants.map((variant) => variant.size))];
                      const colors = [...new Set(product.variants.map((variant) => variant.color))];
                      const materials = [
                        ...new Set(product.variants.map((variant) => variant.material).filter(Boolean)),
                      ];
                      const watts = [
                        ...new Set(product.variants.map((variant) => variant.powerWatts).filter(Boolean)),
                      ];
                      const totalStock = product.variants.reduce(
                        (sum, variant) => sum + getVariantDisplayStock(variant),
                        0,
                      );
                      const prices = product.variants.map((variant) => Number(variant.price));
                      const minPrice = prices.length > 0 ? Math.min(...prices) : null;
                      const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
                      const previewVariant =
                        product.variants.find((variant) => variant.imagePath) ?? product.variants[0];
                      const fieldValues: Record<ProductListFieldKey, string | null> = {
                        brand: product.brand ?? null,
                        category: product.category.name,
                        warehouse: product.warehouseName ?? null,
                        stock: totalStock.toLocaleString("sq-AL"),
                        price:
                          minPrice === null
                            ? "-"
                            : minPrice === maxPrice
                              ? `${minPrice.toFixed(2)} EUR`
                              : `${minPrice.toFixed(2)} - ${maxPrice?.toFixed(2)} EUR`,
                        sizes: summarizeList(dimensions, 3),
                        colors: summarizeList(colors, 2),
                        materials: materials.length > 0 ? materials.join(", ") : null,
                        power: watts.length > 0 ? watts.join(", ") : null,
                      };

                      return (
                        <tr key={product.id} className="align-top transition hover:bg-emerald-50/45">
                          <td className="px-3 py-3.5">
                            <div className="flex items-start gap-3">
                              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-emerald-100 bg-slate-100">
                                <ProductStockQuickView
                                  productId={product.id}
                                  productName={product.brand ? `${product.brand} ${product.name}` : product.name}
                                  productBrand={product.category.name}
                                  warehouseId={activeWarehouseId}
                                  warehouseName={selectedWarehouse || product.warehouseName}
                                  categoryConfig={getCatalogAwareCategoryConfig(
                                    tenant.catalogType,
                                    product.category.name,
                                    tenant.catalogConfig,
                                    parseCategoryFieldConfig(product.category.config),
                                  )}
                                  imagePath={previewVariant?.imagePath ?? null}
                                  variants={product.variants.map((variant) => ({
                                    id: variant.id,
                                    size: variant.size,
                                    color: variant.color,
                                    imagePath: variant.imagePath,
                                    stock: getVariantDisplayStock(variant),
                                    reorderLevel: variant.reorderLevel,
                                    price: Number(variant.price),
                                    locationCode: getVariantDisplayLocation(variant),
                                  }))}
                                  className="h-full w-full"
                                  canAdjustStock={canQuickAdjustStock}
                                  canDeleteColor={canManageInventory}
                                  canTransferStock={canTransferStock}
                                  transferWarehouses={transferWarehouses}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-950">{product.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{product.variants.length} variante</p>
                              </div>
                            </div>
                          </td>
                          {productListView.order
                            .filter((key) => productListView.visibility[key])
                            .map((key) => (
                              <td key={key} className="px-3 py-3.5 text-slate-600">
                                <span className="block max-w-[150px] truncate" title={fieldValues[key] ?? "-"}>
                                  {fieldValues[key] ?? "-"}
                                </span>
                              </td>
                            ))}
                          <td className="px-3 py-3.5">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <ProductStockQuickView
                                productId={product.id}
                                productName={product.brand ? `${product.brand} ${product.name}` : product.name}
                                productBrand={product.category.name}
                                warehouseId={activeWarehouseId}
                                warehouseName={selectedWarehouse || product.warehouseName}
                                categoryConfig={getCatalogAwareCategoryConfig(
                                  tenant.catalogType,
                                  product.category.name,
                                  tenant.catalogConfig,
                                  parseCategoryFieldConfig(product.category.config),
                                )}
                                imagePath={previewVariant?.imagePath ?? null}
                                variants={product.variants.map((variant) => ({
                                  id: variant.id,
                                  size: variant.size,
                                  color: variant.color,
                                  imagePath: variant.imagePath,
                                  stock: getVariantDisplayStock(variant),
                                  reorderLevel: variant.reorderLevel,
                                  price: Number(variant.price),
                                  material: variant.material,
                                  powerWatts: variant.powerWatts,
                                  locationCode: getVariantDisplayLocation(variant),
                                }))}
                                showImageButton={false}
                                iconOnly
                                canAdjustStock={canQuickAdjustStock}
                                canDeleteColor={canManageInventory}
                                canTransferStock={canTransferStock}
                                transferWarehouses={transferWarehouses}
                              />
                              <Link
                                href={buildProductDetailsHref(product.id, {
                                  warehouse: selectedWarehouse,
                                  returnTo: currentListHref,
                                })}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                aria-label="Menaxho"
                                title="Menaxho"
                              >
                                <IconGrid />
                              </Link>
                              {canManageInventory ? (
                                <Link
                                  href={`/products/${product.id}/edit`}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                  aria-label="Edito"
                                  title="Edito"
                                >
                                  <IconPencil />
                                </Link>
                              ) : null}
                              {canManageInventory && product.variants.length === 0 ? (
                                <ConfirmActionForm
                                  action={deleteProduct}
                                  hiddenFields={[{ name: "productId", value: product.id }]}
                                  confirmMessage="A je i sigurt qe don ta fshish kete produkt?"
                                  buttonLabel="Fshi"
                                  className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {totalProducts > PAGE_SIZE ? (
          <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200/80 bg-white px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Faqja <span className="font-semibold text-slate-950">{currentPage}</span> nga{" "}
              <span className="font-semibold text-slate-950">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              {previousPage ? (
                <Link
                  href={buildProductsPageHref(
                    previousPage,
                    searchQuery,
                    selectedCode,
                    selectedCategory,
                    selectedModel,
                    selectedWarehouse,
                    selectedStock,
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
                  href={buildProductsPageHref(
                    nextPage,
                    searchQuery,
                    selectedCode,
                    selectedCategory,
                    selectedModel,
                    selectedWarehouse,
                    selectedStock,
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
