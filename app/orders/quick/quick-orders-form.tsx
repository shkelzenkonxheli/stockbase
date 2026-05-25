"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductModelPicker } from "@/app/components/product-model-picker";
import { VariantColorPicker } from "@/app/components/variant-color-picker";
import { UploadedImage } from "@/app/components/uploaded-image";
import { getOrderVariantSummary } from "@/lib/order-variant-display";

type ProductOption = {
  id: number;
  name: string;
  brand: string;
  imagePath: string | null;
};

type OrderVariant = {
  id: number;
  productId: number;
  productLabel: string;
  category: string;
  size: string;
  color: string;
  imagePath: string | null;
  stock: number;
  price: number;
  material?: string | null;
  powerWatts?: string | null;
};

type QuickOrdersFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  products: ProductOption[];
};

type OrderSource = "INSTAGRAM" | "STORE" | "WHOLESALE";

type QuickOrderRow = {
  id: string;
  productId: string;
  variantId: string;
  quantity: string;
};

const sourceOptions: Array<{ value: OrderSource; label: string }> = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "STORE", label: "Shitore" },
  { value: "WHOLESALE", label: "Shumice" },
];

function createRow(productId: number, variantId: number): QuickOrderRow {
  return {
    id: crypto.randomUUID(),
    productId: String(productId),
    variantId: String(variantId),
    quantity: "1",
  };
}

export function QuickOrdersForm({ action, products }: QuickOrdersFormProps) {
  const [source, setSource] = useState<OrderSource>("INSTAGRAM");
  const [rows, setRows] = useState<QuickOrderRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [variantsByProduct, setVariantsByProduct] = useState<
    Record<number, OrderVariant[]>
  >({});
  const [loadingProducts, setLoadingProducts] = useState<Record<number, boolean>>(
    {},
  );
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  useEffect(() => {
    const productId = Number(selectedProductId);

    if (!productId || variantsByProduct[productId]) {
      return;
    }

    let isCancelled = false;

    const loadVariants = async () => {
      setLoadingProducts((current) => ({ ...current, [productId]: true }));

      try {
        const response = await fetch(`/api/products/${productId}/variants`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as OrderVariant[];

        if (!isCancelled) {
          setVariantsByProduct((current) => ({
            ...current,
            [productId]: data,
          }));
        }
      } finally {
        if (!isCancelled) {
          setLoadingProducts((current) => ({ ...current, [productId]: false }));
        }
      }
    };

    void loadVariants();

    return () => {
      isCancelled = true;
    };
  }, [selectedProductId, variantsByProduct]);

  useEffect(() => {
    if (Object.keys(rowErrors).length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRowErrors({});
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [rowErrors]);

  const brands = useMemo(
    () =>
      [...new Set(products.map((product) => product.brand))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [products],
  );

  const filteredProducts = useMemo(
    () =>
      selectedBrand
        ? products.filter((product) => product.brand === selectedBrand)
        : [],
    [products, selectedBrand],
  );

  const currentProductId = Number(selectedProductId);
  const currentVariants = currentProductId
    ? variantsByProduct[currentProductId] ?? []
    : [];
  const currentProductLoading = currentProductId
    ? Boolean(loadingProducts[currentProductId])
    : false;

  const variantUsage = useMemo(() => {
    const totals = new Map<number, number>();

    for (const row of rows) {
      const variantId = Number(row.variantId);
      const quantity = Number(row.quantity);

      if (!variantId) {
        continue;
      }

      totals.set(
        variantId,
        (totals.get(variantId) ?? 0) + (quantity > 0 ? quantity : 0),
      );
    }

    return totals;
  }, [rows]);

  const variantOptions = currentVariants
    .map((variant) => ({
      ...variant,
      availableStock: variant.stock - (variantUsage.get(variant.id) ?? 0),
    }))
    .filter((variant) => variant.availableStock > 0)
    .sort((a, b) => {
      const colorComparison = a.color.localeCompare(b.color, "sq", {
        sensitivity: "base",
      });

      if (colorComparison !== 0) {
        return colorComparison;
      }

      return a.size.localeCompare(b.size, "sq", {
        numeric: true,
        sensitivity: "base",
      });
    });

  const selectedRows = rows
    .map((row) => {
      const productId = Number(row.productId);
      const variantId = Number(row.variantId);
      const product = products.find((item) => item.id === productId) ?? null;
      const variant =
        Object.values(variantsByProduct)
          .flat()
          .find((item) => item.id === variantId) ?? null;

      if (!product || !variant) {
        return null;
      }

      return { row, product, variant };
    })
    .filter(
      (
        item,
      ): item is {
        row: QuickOrderRow;
        product: ProductOption;
        variant: OrderVariant;
      } => item !== null,
    );

  const serializedRows = JSON.stringify(
    rows
      .map((row) => ({
        variantId: Number(row.variantId),
        quantity: Number(row.quantity),
      }))
      .filter((row) => row.variantId > 0 && row.quantity > 0),
  );

  const totalQuantity = rows.reduce(
    (sum, row) => sum + (Number(row.quantity) > 0 ? Number(row.quantity) : 0),
    0,
  );

  const addSelectedVariant = (variantIdValue: string) => {
    const productId = Number(selectedProductId);
    const variantId = Number(variantIdValue);

    if (!productId || !variantId) {
      setSelectedVariantId(variantIdValue);
      return;
    }

    setRows((currentRows) => {
      const existingRow = currentRows.find(
        (row) => Number(row.variantId) === variantId,
      );

      if (existingRow) {
        const variant = currentVariants.find((item) => item.id === variantId);
        const currentQuantity = Number(existingRow.quantity) || 0;

        if (!variant || currentQuantity >= variant.stock) {
          setRowErrors((current) => ({
            ...current,
            [existingRow.id]: "Nuk ka stok te mjaftueshem per kete sasi.",
          }));
          return currentRows;
        }

        setRowErrors((current) => {
          if (!current[existingRow.id]) {
            return current;
          }

          const next = { ...current };
          delete next[existingRow.id];
          return next;
        });

        return currentRows.map((row) =>
          row.id === existingRow.id
            ? {
                ...row,
                quantity: String((Number(row.quantity) || 1) + 1),
              }
            : row,
        );
      }

      return [...currentRows, createRow(productId, variantId)];
    });

    setSelectedVariantId("");
  };

  const changeQuantity = (rowId: string, delta: number) => {
    const selectedRow = rows.find((row) => row.id === rowId);

    if (!selectedRow) {
      return;
    }

    const variant = Object.values(variantsByProduct)
      .flat()
      .find((item) => item.id === Number(selectedRow.variantId));
    const currentQuantity = Number(selectedRow.quantity) || 1;
    const nextQuantity = Math.max(1, currentQuantity + delta);

    if (delta > 0 && variant && nextQuantity > variant.stock) {
      setRowErrors((current) => ({
        ...current,
        [rowId]: "Nuk ka stok te mjaftueshem per kete sasi.",
      }));
      return;
    }

    setRowErrors((current) => {
      if (!current[rowId]) {
        return current;
      }

      const next = { ...current };
      delete next[rowId];
      return next;
    });

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          quantity: String(nextQuantity),
        };
      }),
    );
  };

  const removeRow = (rowId: string) => {
    setRowErrors((current) => {
      if (!current[rowId]) {
        return current;
      }

      const next = { ...current };
      delete next[rowId];
      return next;
    });

    setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
  };

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="rows" value={serializedRows} />

      <div className="rounded-[28px] bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Burimi i porosise
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {sourceOptions.map((option) => {
            const active = source === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSource(option.value)}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] transition ${
                  active
                    ? "border-emerald-200 bg-emerald-300/55 text-slate-950"
                    : "border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <select
            value={selectedBrand}
            onChange={(event) => {
              setSelectedBrand(event.target.value);
              setSelectedProductId("");
              setSelectedVariantId("");
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="">Zgjidh kategorine</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>

          <ProductModelPicker
            products={filteredProducts}
            selectedProductId={selectedProductId}
            onSelect={(value) => {
              setSelectedProductId(value);
              setSelectedVariantId("");
            }}
            disabled={!selectedBrand}
            placeholder={!selectedBrand ? "Zgjidh kategorine" : "Zgjidh produktin"}
            emptyLabel="Nuk ka produkte per kete kategori."
          />

          <VariantColorPicker
            variants={variantOptions}
            selectedVariantId={selectedVariantId}
            onSelectVariant={(value) => addSelectedVariant(value)}
            disabled={!selectedProductId || currentProductLoading}
            placeholder={
              !selectedProductId
                ? "Zgjidh Modelin"
                : currentProductLoading
                  ? "Duke ngarkuar variantet..."
                  : "Zgjidh ngjyren"
            }
            emptyLabel="Nuk ka variante me stok."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Produktet e zgjedhura
          </p>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            {totalQuantity} produkte ne total
          </span>
        </div>

        <div className="px-5 py-3">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(160px,1fr)_120px_120px_80px] gap-5 border-b border-slate-100 pb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 md:grid">
            <span>Produkti</span>
            <span>Varianti</span>
            <span>Cmimi</span>
            <span>Sasia</span>
            <span className="text-right">Aksionet</span>
          </div>

          <div className="divide-y divide-slate-100">
            {selectedRows.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Zgjidh kategorine, produktin dhe variantin per ta shtuar ne liste.
              </div>
            ) : (
              selectedRows.map(({ row, product, variant }) => (
                <div
                  key={row.id}
                  className="grid grid-cols-1 gap-5 py-4 md:grid-cols-[minmax(0,1.5fr)_minmax(160px,1fr)_120px_120px_80px] md:items-center"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        variant.imagePath
                          ? setLightboxImage({
                              src: variant.imagePath,
                              alt: `${product.name} | ${getOrderVariantSummary(variant)}`,
                            })
                          : null
                      }
                      className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      {variant.imagePath ? (
                        <UploadedImage
                          src={variant.imagePath}
                          alt={`${product.name} ${variant.color}`}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {product.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {product.brand}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                      {getOrderVariantSummary(variant)}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-slate-950">
                    €{variant.price.toFixed(2)}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => changeQuantity(row.id, -1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-base font-semibold text-slate-700 transition hover:bg-slate-300"
                    >
                      -
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold text-slate-950">
                      {row.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(row.id, 1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-300 text-base font-semibold text-slate-950 transition hover:bg-emerald-400"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded-xl px-2.5 py-2 text-lg leading-none text-rose-500 transition hover:bg-rose-50"
                      aria-label="Hiq"
                    >
                      ×
                    </button>
                  </div>

                  {rowErrors[row.id] ? (
                    <div className="md:col-span-5">
                      <p className="text-sm font-medium text-rose-600">
                        {rowErrors[row.id]}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-end gap-3 sm:flex-row">
        <Link
          href="/orders"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-600 transition hover:bg-slate-200"
        >
          Anulo
        </Link>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-[0_10px_25px_rgba(5,150,105,0.24)] transition hover:bg-emerald-500"
        >
          Ruaj
        </button>
      </div>

      {lightboxImage ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4">
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute inset-0 cursor-default"
            aria-label="Mbyll preview"
          />
          <div className="relative z-[101] w-full max-w-3xl">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg font-semibold text-slate-900 shadow-sm transition hover:bg-white"
              aria-label="Mbyll"
            >
              ×
            </button>
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl">
              <UploadedImage
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="max-h-[80vh] w-full object-contain bg-slate-100"
              />
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
