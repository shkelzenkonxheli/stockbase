import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireRole } from "@/lib/auth";
import { ensureTenantCategories } from "@/lib/categories";
import {
  getCatalogAwareCategoryConfig,
  parseCategoryFieldConfig,
} from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";

type EditProductPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

async function updateProduct(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const productId = Number(formData.get("productId"));
  const name = formData.get("name")?.toString().trim();
  const brand = formData.get("brand")?.toString().trim() || null;
  const categoryId = Number(formData.get("categoryId"));
  if (!productId || !name || !categoryId || !tenantId) {
    return;
  }

  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      tenantId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!category) {
    redirect(
      `/products/${productId}/edit?error=${encodeURIComponent(
        "Kategoria nuk eshte valide per kete tenant.",
      )}`,
    );
  }

  const existingProduct = await prisma.product.findFirst({
    where: {
      tenantId,
      id: { not: productId },
      name: { equals: name, mode: "insensitive" },
      brand: brand ? { equals: brand, mode: "insensitive" } : null,
      categoryId,
    },
    select: { id: true },
  });

  if (existingProduct) {
    redirect(
      `/products/${productId}/edit?error=${encodeURIComponent(
        "Ky produkt ekziston tashme ne kete kategori. Ndrysho emrin ose mbaje produktin ekzistues.",
      )}`,
    );
  }

  await prisma.product.update({
    where: { id: productId, tenantId },
    data: {
      name,
      brand,
      categoryId,
    },
  });

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);

  redirect(`/products/${productId}`);
}

export default async function EditProductPage({
  params,
  searchParams,
}: EditProductPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const productId = Number(id);

  if (Number.isNaN(productId) || !tenantId) {
    notFound();
  }

  const tenantCategoriesCount = await prisma.category.count({
    where: { tenantId },
  });

  if (tenantCategoriesCount === 0) {
    await ensureTenantCategories(tenantId, currentUser.tenant?.catalogType ?? "ELECTRONICS");
  }

  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { category: true },
    }),
    prisma.category.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, config: true },
    }),
  ]);

  if (!product) {
    notFound();
  }

  const errorMessage = resolvedSearchParams?.error;
  const productConfig = getCatalogAwareCategoryConfig(
    currentUser.tenant?.catalogType,
    product.category?.name,
    currentUser.tenant?.catalogConfig,
    parseCategoryFieldConfig(product.category?.config),
  );

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200/80 bg-white px-6 py-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Ndrysho produktin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Edito produktin
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Ndrysho fushat baze te produktit.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Ballina
            </Link>
            <Link
              href={`/products/${productId}`}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Kthehu
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

        <form action={updateProduct} className="mt-8 space-y-5">
          <input type="hidden" name="productId" value={product.id} />

          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-slate-800">
              {productConfig.productNameLabel}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={product.name}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
            />
          </div>

          {productConfig.showProductBrandField ? (
            <div className="space-y-2">
              <label htmlFor="brand" className="block text-sm font-medium text-slate-800">
                Brandi
              </label>
              <input
                id="brand"
                name="brand"
                type="text"
                defaultValue={product.brand ?? ""}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <label
              htmlFor="categoryId"
              className="block text-sm font-medium text-slate-800"
            >
              Kategoria
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={product.categoryId}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 pt-3 sm:flex-row">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              Ruaj ndryshimet
            </button>
            <Link
              href={`/products/${productId}`}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Anulo
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
