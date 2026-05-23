import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  ProductImageUploadError,
  saveProductImage,
} from "@/lib/product-images";
import {
  getCatalogAwareCategoryConfig,
  parseCategoryFieldConfig,
  parseVariantCustomAttributes,
} from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import {
  buildBarcodeFromVariantId,
  buildVariantSku,
  ensureUniqueSku,
  normalizeVariantCode,
} from "@/lib/variant-codes";
import { VariantImageUploadForm } from "./variant-image-upload-form";

type EditVariantPageProps = {
  params: Promise<{
    id: string;
    variantId: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

async function uploadVariantImage(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const productId = Number(formData.get("productId"));
  const variantId = Number(formData.get("variantId"));
  const file = formData.get("image");

  if (!productId || !variantId || !tenantId || !(file instanceof File)) return;

  let imagePath: string | null;
  try {
    imagePath = await saveProductImage(productId, file);
  } catch (error) {
    const message =
      error instanceof ProductImageUploadError ? error.message : "Ngarkimi i fotos deshtoi.";
    redirect(`/products/${productId}/variants/${variantId}/edit?error=${encodeURIComponent(message)}`);
  }

  if (!imagePath) {
    redirect(
      `/products/${productId}/variants/${variantId}/edit?error=${encodeURIComponent(
        "Zgjedh nje foto para upload-it.",
      )}`,
    );
  }

  const variant = await prisma.variant.findFirst({
    where: { id: variantId, productId, tenantId },
    select: { id: true, productId: true, color: true },
  });

  if (!variant || variant.productId !== productId) return;
  await prisma.variant.updateMany({
    where: { productId, tenantId, color: variant.color },
    data: { imagePath },
  });

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/variants/${variantId}/edit`);

  redirect(`/products/${productId}/variants/${variantId}/edit`);
}

async function updateVariant(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const productId = Number(formData.get("productId"));
  const variantId = Number(formData.get("variantId"));
  const size = formData.get("size")?.toString().trim();
  const color = formData.get("color")?.toString().trim();
  const material = formData.get("material")?.toString().trim() || null;
  const powerWatts = formData.get("powerWatts")?.toString().trim() || null;
  const skuInput = normalizeVariantCode(formData.get("sku")?.toString());
  const barcode = normalizeVariantCode(formData.get("barcode")?.toString());
  const stock = Number(formData.get("stock"));
  const price = formData.get("price")?.toString().trim();

  const variant = await prisma.variant.findFirst({
    where: { id: variantId, productId, tenantId: tenantId ?? undefined },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });

  if (!variant || variant.productId !== productId || !tenantId) return;
  const categoryConfig = getCatalogAwareCategoryConfig(
    currentUser.tenant?.catalogType,
    variant.product.category?.name,
    currentUser.tenant?.catalogConfig,
    parseCategoryFieldConfig(variant.product.category?.config),
  );
  const sizeIsRequired = categoryConfig.sizeLabel !== "Versioni (opsional)";
  const customFields = (categoryConfig.customVariantFields ?? []).filter((field) => field.enabled);
  const customAttributes = Object.fromEntries(
    customFields.map((field) => [field.id, formData.get(`custom__${field.id}`)?.toString().trim() || ""]),
  );

  if (
    !productId ||
    !variantId ||
    (sizeIsRequired && !size) ||
    !color ||
    Number.isNaN(stock) ||
    stock < 0 ||
    !price
  ) {
    return;
  }

  const otherVariants = await prisma.variant.findMany({
    where: {
      tenantId,
      productId,
      NOT: { id: variantId },
    },
    select: {
      sku: true,
      barcode: true,
    },
  });

  const usedSkus = new Set(
    otherVariants.map((item) => item.sku).filter((sku): sku is string => Boolean(sku)),
  );
  const baseSku =
    skuInput ??
    buildVariantSku({
      productName: variant.product.brand
        ? `${variant.product.brand} ${variant.product.name}`
        : variant.product.name,
      size: size || undefined,
      color,
    });
  const sku = ensureUniqueSku(baseSku, usedSkus);
  const usedBarcodes = new Set(
    otherVariants.map((item) => item.barcode).filter((code): code is string => Boolean(code)),
  );
  const nextBarcode = barcode ?? buildBarcodeFromVariantId(variant.id);

  if (usedBarcodes.has(nextBarcode)) return;

  await prisma.variant.update({
    where: { id: variantId },
    data: {
      size,
      color,
      material,
      powerWatts,
      customAttributes,
      sku,
      barcode: nextBarcode,
      stock,
      price,
    },
  });

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/orders/new");

  redirect(`/products/${productId}`);
}

export default async function EditVariantPage({ params, searchParams }: EditVariantPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const { id, variantId } = await params;
  const productId = Number(id);
  const parsedVariantId = Number(variantId);

  if (Number.isNaN(productId) || Number.isNaN(parsedVariantId) || !tenantId) notFound();

  const variant = await prisma.variant.findFirst({
    where: { id: parsedVariantId, productId, tenantId },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });

  if (!variant || variant.productId !== productId) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedSearchParams?.error?.trim() || null;
  const categoryConfig = getCatalogAwareCategoryConfig(
    currentUser.tenant?.catalogType,
    variant.product.category?.name,
    currentUser.tenant?.catalogConfig,
    parseCategoryFieldConfig(variant.product.category?.config),
  );
  const sizeFieldType = categoryConfig.sizeInputType ?? "text";
  const colorFieldType = categoryConfig.colorInputType ?? "text";
  const materialFieldType = categoryConfig.materialInputType ?? "text";
  const powerFieldType = categoryConfig.powerInputType ?? "text";
  const customAttributes = parseVariantCustomAttributes(variant.customAttributes);
  const customFields = (categoryConfig.customVariantFields ?? []).filter((field) => field.enabled);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200/80 bg-white px-6 py-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Ndrysho variantin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Edito variantin
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              {variant.product.brand ? `${variant.product.brand} ${variant.product.name}` : variant.product.name} - {variant.product.category?.name}
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

        <VariantImageUploadForm
          action={uploadVariantImage}
          productId={productId}
          variantId={variant.id}
          imagePath={variant.imagePath}
          productName={variant.product.brand ? `${variant.product.brand} ${variant.product.name}` : variant.product.name}
          color={variant.color}
          errorMessage={errorMessage}
        />

        <form action={updateVariant} className="mt-5 space-y-5">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="variantId" value={variant.id} />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="size" className="block text-sm font-medium text-slate-800">
                {categoryConfig.sizeLabel}
              </label>
              {sizeFieldType === "select" ? (
                <select
                  id="size"
                  name="size"
                  defaultValue={variant.size}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                >
                  <option value="">Zgjidh...</option>
                  {categoryConfig.sizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="size"
                  name="size"
                  type={sizeFieldType === "number" ? "number" : "text"}
                  defaultValue={variant.size}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                />
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="color" className="block text-sm font-medium text-slate-800">
                {categoryConfig.colorLabel}
              </label>
              {colorFieldType === "select" ? (
                <select
                  id="color"
                  name="color"
                  defaultValue={variant.color}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                >
                  <option value="">Zgjidh...</option>
                  {categoryConfig.colorOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="color"
                  name="color"
                  type={colorFieldType === "number" ? "number" : "text"}
                  defaultValue={variant.color}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                />
              )}
            </div>
          </div>

          {customFields.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {customFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <label htmlFor={`custom__${field.id}`} className="block text-sm font-medium text-slate-800">
                    {field.label}
                  </label>
                  <input
                    id={`custom__${field.id}`}
                    name={`custom__${field.id}`}
                    type={field.type === "number" ? "number" : "text"}
                    defaultValue={customAttributes[field.id] ?? ""}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {categoryConfig.showMaterialField ? (
              <div className="space-y-2">
                <label htmlFor="material" className="block text-sm font-medium text-slate-800">
                  {categoryConfig.materialLabel}
                </label>
                {materialFieldType === "select" ? (
                  <select
                    id="material"
                    name="material"
                    defaultValue={variant.material ?? ""}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  >
                    <option value="">Zgjidh...</option>
                    {categoryConfig.materialOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="material"
                    name="material"
                    type={materialFieldType === "number" ? "number" : "text"}
                    defaultValue={variant.material ?? ""}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  />
                )}
              </div>
            ) : null}

            {categoryConfig.showPowerField ? (
              <div className="space-y-2">
                <label htmlFor="powerWatts" className="block text-sm font-medium text-slate-800">
                  {categoryConfig.powerLabel}
                </label>
                {powerFieldType === "select" ? (
                  <select
                    id="powerWatts"
                    name="powerWatts"
                    defaultValue={variant.powerWatts ?? ""}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  >
                    <option value="">Zgjidh...</option>
                    {categoryConfig.powerOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="powerWatts"
                    name="powerWatts"
                    type={powerFieldType === "number" ? "number" : "text"}
                    defaultValue={variant.powerWatts ?? ""}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  />
                )}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="stock" className="block text-sm font-medium text-slate-800">
                Stoku
              </label>
              <input
                id="stock"
                name="stock"
                type="number"
                min="0"
                defaultValue={variant.stock}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="price" className="block text-sm font-medium text-slate-800">
                Cmimi
              </label>
              <input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={Number(variant.price).toFixed(2)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="sku" className="block text-sm font-medium text-slate-800">
                SKU
              </label>
              <input
                id="sku"
                name="sku"
                type="text"
                defaultValue={variant.sku ?? ""}
                placeholder="Leje bosh per gjenerim automatik"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="barcode" className="block text-sm font-medium text-slate-800">
                Barcode
              </label>
              <input
                id="barcode"
                name="barcode"
                type="text"
                defaultValue={variant.barcode ?? ""}
                placeholder="Opsionale"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              />
            </div>
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
