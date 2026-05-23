import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireRole } from "@/lib/auth";
import { ensureTenantCategories } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import {
  getCategoryDescription,
  getCatalogAwareCategoryConfig,
  getCatalogTemplate,
  parseCategoryFieldConfig,
} from "@/lib/product-taxonomy";

async function createProduct(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) {
    redirect("/login");
  }

  const name = formData.get("name")?.toString().trim();
  const brand = formData.get("brand")?.toString().trim() || null;
  const categoryId = Number(formData.get("categoryId"));
  if (!name || !categoryId) {
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
    redirect("/products/new?error=Kategoria%20nuk%20eshte%20valide%20per%20kete%20tenant.");
  }

  const existingProduct = await prisma.product.findFirst({
    where: {
      tenantId,
      name: { equals: name, mode: "insensitive" },
      brand: brand ? { equals: brand, mode: "insensitive" } : null,
      categoryId,
    },
    select: { id: true },
  });

  if (existingProduct) {
    redirect(
      `/products/new?error=${encodeURIComponent(
        "Ky produkt ekziston tashme ne kete kategori. Ndrysho emrin ose zgjidh produktin ekzistues.",
      )}`,
    );
  }

  const product = await prisma.product.create({
    data: {
      tenantId,
      name,
      brand,
      categoryId,
    },
  });

  revalidatePath("/");
  revalidatePath("/products");

  redirect(`/products/${product.id}`);
}

type NewProductPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NewProductPage({
  searchParams,
}: NewProductPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedSearchParams?.error;
  const catalogType = currentUser.tenant?.catalogType;
  const catalogTemplate = getCatalogTemplate(catalogType);
  const recommendedCategories = new Set(catalogTemplate.recommendedCategories);

  if (currentUser.tenant?.id) {
    const tenantCategoriesCount = await prisma.category.count({
      where: { tenantId: currentUser.tenant.id },
    });

    if (tenantCategoriesCount === 0) {
      await ensureTenantCategories(currentUser.tenant.id, catalogType ?? "ELECTRONICS");
    }
  }

  const categories = await prisma.category.findMany({
    where: {
      tenantId: currentUser.tenant?.id,
      isActive: true,
    },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, config: true },
  });
  const productConfig =
    categories.length > 0
      ? getCatalogAwareCategoryConfig(
          currentUser.tenant?.catalogType,
          categories[0].name,
          currentUser.tenant?.catalogConfig,
          parseCategoryFieldConfig(categories[0].config),
        )
      : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffedd5_0%,transparent_20%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-slate-200/80 bg-white px-6 py-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Krijo produktin
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Shto produkt te ri
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Krijo produktin baze dhe lidhe me nje kategori. Pas ruajtjes kalon
            direkt te faqja e produktit per te shtuar variantet sipas
            dimensionit, ngjyres, materialit ose fuqise.
          </p>
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{catalogTemplate.label}</p>
            <p className="mt-1">{catalogTemplate.variantFocus}</p>
          </div>

          {errorMessage ? (
            <FlashMessage
              type="error"
              text={errorMessage}
              className="mt-6 rounded-2xl px-4 py-3 text-sm shadow-sm"
            />
          ) : null}

          <form action={createProduct} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-slate-800">
                {productConfig?.productNameLabel ?? "Emri i produktit"}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder={
                  productConfig?.productNamePlaceholder ?? catalogTemplate.productNamePlaceholder
                }
              />
            </div>

            {productConfig?.showProductBrandField ? (
              <div className="space-y-2">
                <label htmlFor="brand" className="block text-sm font-medium text-slate-800">
                  Brandi
                </label>
                <input
                  id="brand"
                  name="brand"
                  type="text"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  placeholder="p.sh. Nike"
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
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                defaultValue=""
              >
                <option value="" disabled>
                  Zgjidh kategorine
                </option>
                {(categories.length > 0 ? categories : []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {categories.length === 0 ? (
                <p className="text-xs text-amber-700">
                  Nuk ka kategori ne databaze. Pasi te aplikosh migrimin, ekzekuto
                  `npm run seed`.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 pt-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
              >
                Ruaj produktin
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Ballina
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Kthehu te produktet
              </Link>
            </div>
          </form>
        </section>

        <aside className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="rounded-[28px] bg-gradient-to-br from-orange-50 via-white to-sky-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Kategorite
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
              Struktura e inventarit
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {catalogTemplate.description}
            </p>
            <div className="mt-6 space-y-4">
              {categories.map((category, index) => (
                <div
                  key={category.id}
                  className={`rounded-2xl border p-4 ${
                    recommendedCategories.has(category.name as never)
                      ? "border-slate-200 bg-white text-slate-900"
                      : "border-white/80 bg-white/70 text-slate-600"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {index + 1}. {category.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {getCategoryDescription(category.name)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

