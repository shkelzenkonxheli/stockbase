import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/app/generated/prisma/client";
import { ConfirmActionForm } from "@/app/components/confirm-action-form";
import { hasRole, requireUser } from "@/lib/auth";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { getProductListViewConfig, type ProductListFieldKey } from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
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

type ProductsPageProps = {
  searchParams?: Promise<{
    page?: string;
    q?: string;
    category?: string;
    model?: string;
  }>;
};

function buildProductsPageHref(page: number, q: string, category: string, model: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (model) params.set("model", model);
  return `/products?${params.toString()}`;
}

async function deleteProduct(formData: FormData) {
  "use server";

  const currentUser = await requireUser();
  const tenantId = currentUser.tenant?.id;
  const productId = Number(formData.get("productId"));
  if (!productId || !tenantId) return;

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: {
      id: true,
      _count: { select: { variants: true } },
    },
  });

  if (!product || product._count.variants > 0) return;

  await prisma.product.delete({ where: { id: productId } });
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
  const selectedCategory = resolvedSearchParams?.category?.trim() || "";
  const selectedModel = resolvedSearchParams?.model?.trim() || "";
  const currentPage = Math.max(1, Number(resolvedSearchParams?.page) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;
  const filters: Prisma.ProductWhereInput[] = [];
  const searchTokens = searchQuery.split(/\s+/).map((token) => token.trim()).filter(Boolean);

  if (searchTokens.length > 0) {
    filters.push({
      AND: searchTokens.map((token) => ({
        OR: [
          { name: { contains: token, mode: "insensitive" } },
          { brand: { contains: token, mode: "insensitive" } },
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

  const where: Prisma.ProductWhereInput = {
    tenantId,
    ...(filters.length > 0 ? { AND: filters } : {}),
  };

  const [products, totalProducts, filterProducts, stockTotals] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        brand: true,
        category: { select: { name: true } },
        variants: {
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
            price: true,
          },
        },
      },
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where: { tenantId },
      select: { name: true, brand: true, category: { select: { name: true } } },
      orderBy: [{ name: "asc" }],
    }),
    prisma.variant.findMany({
      where: { product: where },
      select: { stock: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const previousPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  const categories = [...new Set(filterProducts.map((product) => product.category.name))];
  const models = [
    ...new Set(
      filterProducts.map(
        (product) =>
          `${product.category.name.toLowerCase()}::${product.brand ? `${product.brand} ` : ""}${product.name}`,
      ),
    ),
  ];
  const totalUnits = stockTotals.reduce((sum, variant) => sum + variant.stock, 0);
  const lowStockProducts = products.filter((product) =>
    product.variants.some((variant) => variant.stock > 0 && variant.stock <= LOW_STOCK_THRESHOLD),
  ).length;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="space-y-5 rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                Inventari i produkteve
              </h1>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                  {totalProducts.toLocaleString("sq-AL")} produkte
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                  {totalUnits.toLocaleString("sq-AL")} njesi ne total
                </span>
                <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-600">
                  {lowStockProducts} me stok te ulet
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
              >
                Ballina
              </Link>
              {canManageInventory ? (
                <Link
                  href="/products/new"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
                >
                  + Shto Produkt
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.07)]">
          <div className="border-b border-slate-200/80 px-4 py-4 sm:px-5">
            <ProductsFilters
              key={`${searchQuery}|${selectedCategory}|${selectedModel}`}
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              selectedModel={selectedModel}
              categories={categories}
              models={models}
            />
          </div>

          {products.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-base font-medium text-slate-900">
                {searchQuery || selectedCategory || selectedModel
                  ? "Nuk u gjet asnje produkt me keto filtra"
                  : "Nuk ka ende produkte te regjistruara"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {searchQuery || selectedCategory || selectedModel
                  ? "Provo nje kerkese tjeter ose bej reset."
                  : "Shto produktin e pare dhe vazhdo me variantet per te filluar inventarin."}
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <div className="space-y-3 lg:hidden">
                {products.map((product) => {
                  const dimensions = [...new Set(product.variants.map((variant) => variant.size))];
                  const colors = [...new Set(product.variants.map((variant) => variant.color))];
                  const materials = [
                    ...new Set(product.variants.map((variant) => variant.material).filter(Boolean)),
                  ];
                  const watts = [
                    ...new Set(product.variants.map((variant) => variant.powerWatts).filter(Boolean)),
                  ];
                  const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
                  const prices = product.variants.map((variant) => Number(variant.price));
                  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
                  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
                  const previewVariant =
                    product.variants.find((variant) => variant.imagePath) ?? product.variants[0];
                  const fieldValues: Record<ProductListFieldKey, string | null> = {
                    brand: product.brand ?? null,
                    category: product.category.name,
                    stock: totalStock.toLocaleString("sq-AL"),
                    price:
                      minPrice === null
                        ? "-"
                        : minPrice === maxPrice
                          ? `${minPrice.toFixed(2)} EUR`
                          : `${minPrice.toFixed(2)} - ${maxPrice?.toFixed(2)} EUR`,
                    sizes: dimensions.length > 0 ? dimensions.join(", ") : "-",
                    colors: colors.length > 0 ? colors.join(", ") : "-",
                    materials: materials.length > 0 ? materials.join(", ") : null,
                    power: watts.length > 0 ? watts.join(", ") : null,
                  };
                  const fieldLabels: Record<ProductListFieldKey, string> = {
                    brand: "Brandi",
                    category: "Kategoria",
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
                      className="relative rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <details className="absolute right-4 top-4 z-10 lg:hidden">
                        <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
                          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                            <circle cx="4.5" cy="10" r="1.4" />
                            <circle cx="10" cy="10" r="1.4" />
                            <circle cx="15.5" cy="10" r="1.4" />
                          </svg>
                        </summary>
                        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                          <div className="flex flex-col gap-2">
                            <ProductStockQuickView
                              productId={product.id}
                              productName={product.brand ? `${product.brand} ${product.name}` : product.name}
                              productBrand={product.category.name}
                              imagePath={previewVariant?.imagePath ?? null}
                              variants={product.variants.map((variant) => ({
                                id: variant.id,
                                size: variant.size,
                                color: variant.color,
                                imagePath: variant.imagePath,
                                stock: variant.stock,
                                price: Number(variant.price),
                                material: variant.material,
                                powerWatts: variant.powerWatts,
                                locationCode: variant.locationCode,
                              }))}
                              showImageButton={false}
                              canAdjustStock={canQuickAdjustStock}
                              canDeleteColor={canManageInventory}
                              className="w-full"
                            />
                            <Link
                              href={`/products/${product.id}`}
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
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                          <ProductStockQuickView
                            productId={product.id}
                            productName={product.brand ? `${product.brand} ${product.name}` : product.name}
                            productBrand={product.category.name}
                            imagePath={previewVariant?.imagePath ?? null}
                            variants={product.variants.map((variant) => ({
                              id: variant.id,
                              size: variant.size,
                              color: variant.color,
                              imagePath: variant.imagePath,
                              stock: variant.stock,
                              price: Number(variant.price),
                              material: variant.material,
                              powerWatts: variant.powerWatts,
                              locationCode: variant.locationCode,
                            }))}
                            className="h-full w-full"
                            canAdjustStock={canQuickAdjustStock}
                            canDeleteColor={canManageInventory}
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
                              <span className="font-medium text-slate-800">{fieldLabels[key]}:</span>{" "}
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
                    <col className="w-[280px]" />
                    {productListView.order
                      .filter((key) => productListView.visibility[key])
                      .map((key) => (
                        <col
                          key={key}
                          className={
                            key === "stock"
                              ? "w-[110px]"
                              : key === "price"
                                ? "w-[160px]"
                                : "w-[180px]"
                          }
                        />
                      ))}
                    <col className="w-[340px]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-slate-50/95 text-left backdrop-blur">
                    <tr className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-4 py-4">Produkti</th>
                      {productListView.order
                        .filter((key) => productListView.visibility[key])
                        .map((key) => (
                          <th key={key} className="px-4 py-4">
                            {{
                              brand: "Brandi",
                              category: "Kategoria",
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
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {products.map((product) => {
                      const dimensions = [...new Set(product.variants.map((variant) => variant.size))];
                      const colors = [...new Set(product.variants.map((variant) => variant.color))];
                      const materials = [
                        ...new Set(product.variants.map((variant) => variant.material).filter(Boolean)),
                      ];
                      const watts = [
                        ...new Set(product.variants.map((variant) => variant.powerWatts).filter(Boolean)),
                      ];
                      const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
                      const prices = product.variants.map((variant) => Number(variant.price));
                      const minPrice = prices.length > 0 ? Math.min(...prices) : null;
                      const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
                      const previewVariant =
                        product.variants.find((variant) => variant.imagePath) ?? product.variants[0];
                      const fieldValues: Record<ProductListFieldKey, string | null> = {
                        brand: product.brand ?? null,
                        category: product.category.name,
                        stock: totalStock.toLocaleString("sq-AL"),
                        price:
                          minPrice === null
                            ? "-"
                            : minPrice === maxPrice
                              ? `${minPrice.toFixed(2)} EUR`
                              : `${minPrice.toFixed(2)} - ${maxPrice?.toFixed(2)} EUR`,
                        sizes: dimensions.length > 0 ? dimensions.join(", ") : "-",
                        colors: colors.length > 0 ? colors.join(", ") : "-",
                        materials: materials.length > 0 ? materials.join(", ") : null,
                        power: watts.length > 0 ? watts.join(", ") : null,
                      };

                      return (
                        <tr key={product.id} className="align-top transition hover:bg-slate-50/75">
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                <ProductStockQuickView
                                  productId={product.id}
                                  productName={product.brand ? `${product.brand} ${product.name}` : product.name}
                                  productBrand={product.category.name}
                                  imagePath={previewVariant?.imagePath ?? null}
                                  variants={product.variants.map((variant) => ({
                                    id: variant.id,
                                    size: variant.size,
                                    color: variant.color,
                                    imagePath: variant.imagePath,
                                    stock: variant.stock,
                                    price: Number(variant.price),
                                    locationCode: variant.locationCode,
                                  }))}
                                  className="h-full w-full"
                                  canAdjustStock={canQuickAdjustStock}
                                  canDeleteColor={canManageInventory}
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
                              <td key={key} className="px-4 py-4 text-slate-600">
                                <span className="block max-w-[220px] truncate" title={fieldValues[key] ?? "-"}>
                                  {fieldValues[key] ?? "-"}
                                </span>
                              </td>
                            ))}
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                              <ProductStockQuickView
                                productId={product.id}
                                productName={product.brand ? `${product.brand} ${product.name}` : product.name}
                                productBrand={product.category.name}
                                imagePath={previewVariant?.imagePath ?? null}
                                variants={product.variants.map((variant) => ({
                                  id: variant.id,
                                  size: variant.size,
                                  color: variant.color,
                                  imagePath: variant.imagePath,
                                  stock: variant.stock,
                                  price: Number(variant.price),
                                  material: variant.material,
                                  powerWatts: variant.powerWatts,
                                  locationCode: variant.locationCode,
                                }))}
                                showImageButton={false}
                                iconOnly
                                canAdjustStock={canQuickAdjustStock}
                                canDeleteColor={canManageInventory}
                              />
                              <Link
                                href={`/products/${product.id}`}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                                aria-label="Menaxho"
                                title="Menaxho"
                              >
                                <IconGrid />
                              </Link>
                              {canManageInventory ? (
                                <Link
                                  href={`/products/${product.id}/edit`}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
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
                  href={buildProductsPageHref(previousPage, searchQuery, selectedCategory, selectedModel)}
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
                  href={buildProductsPageHref(nextPage, searchQuery, selectedCategory, selectedModel)}
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
