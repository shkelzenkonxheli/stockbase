import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireRole } from "@/lib/auth";
import {
  ProductImageUploadError,
  saveProductImage,
} from "@/lib/product-images";
import { prisma } from "@/lib/prisma";
import {
  buildBarcodeFromVariantId,
  buildVariantSku,
  ensureUniqueSku,
  normalizeVariantCode,
} from "@/lib/variant-codes";
import {
  getCatalogAwareCategoryConfig,
  parseCategoryFieldConfig,
  parseVariantCustomAttributes,
} from "@/lib/product-taxonomy";
import { VariantRowsForm } from "./variant-rows-form";

type NewProductVariantPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

async function createVariants(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const productId = Number(formData.get("productId"));
  const rowsRaw = formData.get("rows")?.toString();

  if (!productId || !rowsRaw || !tenantId) {
    return;
  }

  let parsedRows: unknown;

  try {
    parsedRows = JSON.parse(rowsRaw);
  } catch {
    return;
  }

  if (!Array.isArray(parsedRows)) {
    return;
  }

  const normalizedRows = parsedRows
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const candidate = row as {
        imageFieldName?: unknown;
        size?: unknown;
        color?: unknown;
        material?: unknown;
        powerWatts?: unknown;
        sku?: unknown;
        barcode?: unknown;
        imagePath?: unknown;
        stock?: unknown;
        price?: unknown;
        customAttributes?: unknown;
      };

      const imageFieldName = String(candidate.imageFieldName ?? "").trim();
      const size = String(candidate.size ?? "").trim();
      const color = String(candidate.color ?? "").trim();
      const material = String(candidate.material ?? "").trim() || null;
      const powerWatts = String(candidate.powerWatts ?? "").trim() || null;
      const sku = normalizeVariantCode(String(candidate.sku ?? ""));
      const barcode = normalizeVariantCode(String(candidate.barcode ?? ""));
      const imagePath = String(candidate.imagePath ?? "").trim() || null;
      const stock = Number(candidate.stock);
      const price = String(candidate.price ?? "").trim();
      const customAttributes = parseVariantCustomAttributes(candidate.customAttributes);

      if (!color || Number.isNaN(stock) || stock < 0 || !price) {
        return null;
      }

      return {
        imageFieldName,
        size,
        color,
        material,
        powerWatts,
        sku,
        barcode,
        imagePath,
        stock,
        price,
        customAttributes,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (normalizedRows.length === 0) {
    return;
  }

  const [existingProductVariants, existingVariantCodes] = await Promise.all([
    prisma.variant.findMany({
      where: { productId, tenantId },
      select: {
        size: true,
        color: true,
        barcode: true,
      },
    }),
    prisma.variant.findMany({
      where: { tenantId },
      select: {
        sku: true,
        barcode: true,
      },
    }),
  ]);

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: {
      name: true,
      brand: true,
      category: {
        select: {
          name: true,
          config: true,
        },
      },
    },
  });

  if (!product) {
    return;
  }
  const categoryConfig = getCatalogAwareCategoryConfig(
    currentUser.tenant?.catalogType,
    product.category?.name,
    currentUser.tenant?.catalogConfig,
    parseCategoryFieldConfig(product.category?.config),
  );
  const sizeIsRequired = !categoryConfig.showPowerField || categoryConfig.sizeLabel !== "Versioni (opsional)";

  const existingKeys = new Set(
    existingProductVariants.map(
      (variant) => `${variant.size}::${variant.color.toLowerCase()}`,
    ),
  );
  const usedSkus = new Set(
    existingVariantCodes
      .map((variant) => variant.sku)
      .filter((sku): sku is string => Boolean(sku)),
  );
  const usedBarcodes = new Set(
    existingVariantCodes
      .map((variant) => variant.barcode)
      .filter((barcode): barcode is string => Boolean(barcode)),
  );

  const seenRowKeys = new Set<string>();
  const duplicateRowsInRequest = new Set<string>();

  for (const row of normalizedRows) {
    const effectiveSize = row.size || "__no-size__";
    const key = `${effectiveSize}::${row.color.toLowerCase()}`;

    if (seenRowKeys.has(key)) {
      duplicateRowsInRequest.add(key);
      continue;
    }

    seenRowKeys.add(key);
  }

  if (duplicateRowsInRequest.size > 0) {
    const [firstDuplicate] = [...duplicateRowsInRequest];
    const [size, color] = firstDuplicate.split("::");
    const duplicateLabel = size === "__no-size__" ? color : `Nr ${size} / ${color}`;

    redirect(
      `/products/${productId}/variants/new?error=${encodeURIComponent(
        `Varianti ${duplicateLabel} eshte shkruar me shume se nje here.`,
      )}`,
    );
  }

  const validRowsWithCategory = normalizedRows.filter((row) => {
    if (sizeIsRequired && !row.size) {
      return false;
    }

    return Boolean(row.color) && !Number.isNaN(row.stock) && row.stock >= 0 && Boolean(row.price);
  });

  if (validRowsWithCategory.length === 0) {
    return;
  }

  const alreadyExistingRows = validRowsWithCategory.filter((row) =>
    existingKeys.has(`${row.size || "__no-size__"}::${row.color.toLowerCase()}`),
  );

  if (alreadyExistingRows.length > 0) {
    const firstExisting = alreadyExistingRows[0];

    redirect(
      `/products/${productId}/variants/new?error=${encodeURIComponent(
        firstExisting.size
          ? `Varianti Nr ${firstExisting.size} / ${firstExisting.color} ekziston tashme per kete produkt.`
          : `Varianti ${firstExisting.color} ekziston tashme per kete produkt.`,
      )}`,
    );
  }

  if (validRowsWithCategory.length > 0) {
    const uploadedImages = new Map<string, string | null>();

    await prisma.$transaction(async (tx) => {
      for (const row of validRowsWithCategory) {
        let imagePath = row.imagePath;

        if (row.imageFieldName) {
          if (uploadedImages.has(row.imageFieldName)) {
            imagePath = uploadedImages.get(row.imageFieldName) ?? imagePath;
          } else {
            const rowFile = formData.get(row.imageFieldName);

            if (rowFile instanceof File && rowFile.size > 0) {
              try {
                imagePath = await saveProductImage(productId, rowFile);
              } catch (error) {
                const message =
                  error instanceof ProductImageUploadError
                    ? error.message
                    : `Ngarkimi i fotos deshtoi per variantin ${row.color}.`;
                redirect(
                  `/products/${productId}/variants/new?error=${encodeURIComponent(message)}`,
                );
              }
            }

            uploadedImages.set(row.imageFieldName, imagePath);
          }
        }

        const baseSku =
          row.sku ??
          buildVariantSku({
            productName: product.brand ? `${product.brand} ${product.name}` : product.name,
            size: row.size || undefined,
            color: row.color,
          });
        const createdVariant = await tx.variant.create({
          data: {
            tenantId,
            productId,
            size: row.size,
            color: row.color,
            material: row.material,
            powerWatts: row.powerWatts,
            sku: ensureUniqueSku(baseSku, usedSkus),
            imagePath,
            stock: row.stock,
            price: row.price,
            customAttributes: row.customAttributes,
          },
        });
        const barcode =
          row.barcode ?? buildBarcodeFromVariantId(createdVariant.id);

        if (usedBarcodes.has(barcode)) {
          throw new Error("Duplicate barcode detected.");
        }

        usedBarcodes.add(barcode);

        await tx.variant.update({
          where: { id: createdVariant.id },
          data: {
            barcode,
          },
        });
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath("/orders/new");

  redirect(`/products/${productId}`);
}

export default async function NewProductVariantPage({
  params,
  searchParams,
}: NewProductVariantPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  const { id } = await params;
  const productId = Number(id);

  if (Number.isNaN(productId) || !tenantId) {
    notFound();
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      category: true,
    },
  });

  if (!product) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedSearchParams?.error?.trim() || null;

  const categoryConfig = getCatalogAwareCategoryConfig(
    currentUser.tenant?.catalogType,
    product.category?.name,
    currentUser.tenant?.catalogConfig,
    parseCategoryFieldConfig(product.category?.config),
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fef3c7_0%,transparent_18%),radial-gradient(circle_at_top_right,#dbeafe_0%,transparent_22%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[32px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Variant Setup
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Shto variante
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {product.name} - {product.category?.name}
              {product.brand ? ` · ${product.brand}` : ""}
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
              href={`/products/${product.id}`}
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
            className="mt-6 rounded-2xl px-4 py-3 text-sm"
          />
        ) : null}
        <VariantRowsForm
          productId={product.id}
          productName={product.brand ? `${product.brand} ${product.name}` : product.name}
          productBrand={product.category?.name ?? ""}
          categoryConfig={categoryConfig}
          action={createVariants}
        />
      </div>
    </main>
  );
}
