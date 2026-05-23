"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductModelPicker } from "@/app/components/product-model-picker";
import { VariantColorPicker } from "@/app/components/variant-color-picker";
import { UploadedImage } from "@/app/components/uploaded-image";

type OrderVariant = {
  id: number;
  productId: number;
  productLabel: string;
  size: string;
  color: string;
  imagePath: string | null;
  stock: number;
  price: number;
};

type ProductOption = {
  id: number;
  name: string;
  brand: string;
  imagePath: string | null;
};

type OrderFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  products: ProductOption[];
};

type OrderSource = "INSTAGRAM" | "STORE" | "WHOLESALE";

type OrderItemRow = {
  id: string;
  brand: string;
  productId: string;
  variantId: string;
  quantity: string;
  committed: boolean;
};

const sourceOptions: Array<{ value: OrderSource; label: string }> = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "STORE", label: "Dyqan" },
  { value: "WHOLESALE", label: "Shumice" },
];

function createEmptyRow(): OrderItemRow {
  return {
    id: crypto.randomUUID(),
    brand: "",
    productId: "",
    variantId: "",
    quantity: "1",
    committed: false,
  };
}

function getSourceIcon(source: OrderSource) {
  switch (source) {
    case "INSTAGRAM":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
        >
          <rect
            x="4.25"
            y="4.25"
            width="11.5"
            height="11.5"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle
            cx="10"
            cy="10"
            r="2.75"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="14" cy="6" r="0.9" fill="currentColor" />
        </svg>
      );
    case "STORE":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
        >
          <path
            d="M4 7.25 5.25 4.5h9.5L16 7.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M4.25 7.25h11.5v7.5H4.25z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M8 10.25h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
        >
          <path
            d="M10 3.25 16 6.5v7L10 16.75 4 13.5v-7l6-3.25Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M10 3.5v13" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="m4.25 6.75 5.75 3.25 5.75-3.25"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
  }
}

export function OrderForm({ action, products }: OrderFormProps) {
  const [source, setSource] = useState<OrderSource>("INSTAGRAM");
  const [rows, setRows] = useState<OrderItemRow[]>([createEmptyRow()]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [variantsByProduct, setVariantsByProduct] = useState<
    Record<number, OrderVariant[]>
  >({});
  const [loadingProducts, setLoadingProducts] = useState<
    Record<number, boolean>
  >({});
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const productIdsToLoad = [
      ...new Set(
        rows
          .map((row) => Number(row.productId))
          .filter(
            (productId) => productId > 0 && !variantsByProduct[productId],
          ),
      ),
    ];

    if (productIdsToLoad.length === 0) {
      return;
    }

    let isCancelled = false;

    const loadVariants = async () => {
      for (const productId of productIdsToLoad) {
        setLoadingProducts((current) => ({ ...current, [productId]: true }));

        try {
          const response = await fetch(`/api/products/${productId}/variants`, {
            cache: "no-store",
          });

          if (!response.ok) {
            continue;
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
            setLoadingProducts((current) => ({
              ...current,
              [productId]: false,
            }));
          }
        }
      }
    };

    void loadVariants();

    return () => {
      isCancelled = true;
    };
  }, [rows, variantsByProduct]);

  useEffect(() => {
    if (Object.keys(rowErrors).length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRowErrors({});
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [rowErrors]);

  const reservedByVariant = useMemo(() => {
    const totals = new Map<number, number>();

    for (const row of rows) {
      const variantId = Number(row.variantId);
      const quantity = Number(row.quantity) || 0;

      if (!variantId || quantity <= 0) {
        continue;
      }

      totals.set(variantId, (totals.get(variantId) ?? 0) + quantity);
    }

    return totals;
  }, [rows]);

  const updateRow = (
    rowId: string,
    field: keyof Omit<OrderItemRow, "id">,
    value: string,
  ) => {
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

        if (field === "brand") {
          return {
            ...row,
            brand: value,
            productId: "",
            variantId: "",
            committed: false,
          };
        }

        if (field === "productId") {
          return {
            ...row,
            productId: value,
            variantId: "",
            committed: false,
          };
        }

        return {
          ...row,
          [field]: value,
          committed: false,
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

    setRows((currentRows) => {
      const nextRows = currentRows.filter((row) => row.id !== rowId);
      const hasDraft = nextRows.some((row) => !row.committed);

      if (nextRows.length === 0) {
        return [createEmptyRow()];
      }

      return hasDraft ? nextRows : [...nextRows, createEmptyRow()];
    });
  };

  const commitRow = (rowId: string) => {
    const rowToCommit = rows.find((row) => row.id === rowId);

    if (
      !rowToCommit ||
      !rowToCommit.productId ||
      !rowToCommit.variantId ||
      Number(rowToCommit.quantity) <= 0
    ) {
      return;
    }

    const selectedProductId = Number(rowToCommit.productId);
    const productVariants = selectedProductId
      ? (variantsByProduct[selectedProductId] ?? [])
      : [];
    const currentVariantId = Number(rowToCommit.variantId);
    const currentQuantity = Number(rowToCommit.quantity) || 0;
    const reservedElsewhere =
      (reservedByVariant.get(currentVariantId) ?? 0) - currentQuantity;
    const selectedVariant = productVariants.find(
      (variant) => variant.id === currentVariantId,
    );
    const availableStock = selectedVariant
      ? Math.max(selectedVariant.stock - reservedElsewhere, 0)
      : 0;

    if (!selectedVariant || currentQuantity > availableStock) {
      setRowErrors((current) => ({
        ...current,
        [rowId]: "Nuk ka stok te mjaftueshem per kete sasi.",
      }));
      quantityInputRefs.current[rowId]?.focus();
      quantityInputRefs.current[rowId]?.select();
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

    setRows((currentRows) => {
      const alreadyExists = currentRows.some(
        (row) =>
          row.id !== rowId &&
          row.committed &&
          row.variantId === rowToCommit.variantId,
      );

      const nextRows = currentRows.map((row) =>
        row.id === rowId ? createEmptyRow() : row,
      );

      if (alreadyExists) {
        return nextRows;
      }

      return [
        { ...rowToCommit, committed: true, id: crypto.randomUUID() },
        ...nextRows,
      ];
    });
  };

  const allLoadedVariants = Object.values(variantsByProduct).flat();
  const brands = [...new Set(products.map((product) => product.brand))].sort(
    (a, b) => a.localeCompare(b, "sq"),
  );

  const selectedItems = rows
    .filter((row) => row.committed)
    .map((row) => {
      const variant = allLoadedVariants.find(
        (item) => item.id === Number(row.variantId),
      );

      if (!variant) {
        return null;
      }

      return {
        rowId: row.id,
        ...variant,
        quantity: Number(row.quantity) || 0,
      };
    })
    .filter(
      (item): item is OrderVariant & { rowId: string; quantity: number } =>
        item !== null,
    );

  const pendingRows = rows.filter((row) => !row.committed).slice(0, 1);

  const subtotal = selectedItems.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );
  const shipping = 0;
  const grandTotal = subtotal + shipping;
  const serializedItems = JSON.stringify(
    rows
      .filter((row) => row.committed)
      .map((row) => ({
        variantId: Number(row.variantId),
        quantity: Number(row.quantity),
      }))
      .filter((row) => row.variantId > 0 && row.quantity > 0),
  );

  return (
    <form
      action={action}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_312px]"
    >
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="items" value={serializedItems} />

      <div className="space-y-6">
        <section className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Burimi i Porosise
          </p>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {sourceOptions.map((option) => {
              const active = source === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSource(option.value)}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "border-emerald-200 bg-emerald-300/55 text-slate-950"
                      : "border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {getSourceIcon(option.value)}
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-5 w-5"
                >
                  <path
                    d="M4.75 5.5h10.5M6 4v3m8-3v3M4.75 7v8.25h10.5V7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7.5 10.25h5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xl font-semibold text-slate-950">
                  Detajet e Produktit
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            {pendingRows.map((row) => {
              const rowVariantId = Number(row.variantId);
              const rowQuantity = Number(row.quantity) || 0;
              const selectedProductId = Number(row.productId);
              const brandProducts = row.brand
                ? products.filter(
                    (product) =>
                      product.brand.toLowerCase() === row.brand.toLowerCase(),
                  )
                : products;
              const productVariants = selectedProductId
                ? (variantsByProduct[selectedProductId] ?? [])
                : [];
              const filteredVariants = productVariants
                .map((variant) => {
                  const reservedElsewhere =
                    (reservedByVariant.get(variant.id) ?? 0) -
                    (variant.id === rowVariantId ? rowQuantity : 0);

                  return {
                    ...variant,
                    availableStock: Math.max(
                      variant.stock - reservedElsewhere,
                      0,
                    ),
                  };
                })
                .filter(
                  (variant) =>
                    variant.availableStock > 0 || variant.id === rowVariantId,
                )
                .sort(
                  (a, b) =>
                    a.color.localeCompare(b.color, "sq", {
                      sensitivity: "base",
                    }) || a.size.localeCompare(b.size, "sq", { numeric: true }),
                );
              const selectedVariant = filteredVariants.find(
                (variant) => variant.id === Number(row.variantId),
              );
              const isLoadingVariants = selectedProductId
                ? Boolean(loadingProducts[selectedProductId])
                : false;

              return (
                <div key={row.id} className="rounded-[24px] px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(130px,0.75fr)_minmax(150px,0.95fr)_minmax(210px,1.15fr)_72px_110px_28px] md:items-end">
                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Kategoria
                      </label>
                      <select
                        value={row.brand}
                        onChange={(event) =>
                          updateRow(row.id, "brand", event.target.value)
                        }
                        className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      >
                        <option value="">Zgjidh kategorine</option>
                        {brands.map((brand) => (
                          <option key={brand} value={brand}>
                            {brand}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Produkti
                      </label>
                      <ProductModelPicker
                        products={brandProducts}
                        selectedProductId={row.productId}
                        onSelect={(value) => updateRow(row.id, "productId", value)}
                        disabled={!row.brand}
                        placeholder={!row.brand ? "Zgjidh kategorine" : "Zgjidh produktin"}
                        emptyLabel="Nuk ka produkte per kete kategori."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Varianti
                      </label>
                      <VariantColorPicker
                        variants={filteredVariants}
                        selectedVariantId={row.variantId}
                        onSelectVariant={(value) => updateRow(row.id, "variantId", value)}
                        disabled={!row.productId || isLoadingVariants}
                        placeholder={
                          !row.productId
                            ? "Zgjidh produktin"
                            : isLoadingVariants
                              ? "Duke ngarkuar..."
                              : "Zgjidh ngjyren"
                        }
                        emptyLabel="Nuk ka variante me stok."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Sasia
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(event) =>
                          updateRow(row.id, "quantity", event.target.value)
                        }
                        max={selectedVariant?.availableStock ?? undefined}
                        ref={(element) => {
                          quantityInputRefs.current[row.id] = element;
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Cmimi
                      </label>
                      <div className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-center text-sm font-semibold text-slate-900">
                        {selectedVariant
                          ? `${selectedVariant.price.toFixed(2)} EUR`
                          : "-"}
                      </div>
                    </div>

                    <div className="flex h-11 items-center justify-center">
                      <button
                        type="button"
                        onClick={() => commitRow(row.id)}
                        disabled={!row.variantId}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        aria-label="Shto ne liste"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          fill="none"
                          className="h-4 w-4"
                        >
                          <path
                            d="M10 4v12M4 10h12"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {rowErrors[row.id] ? (
                    <p className="mt-3 text-sm font-medium text-rose-600">
                      {rowErrors[row.id]}
                    </p>
                  ) : null}
                </div>
              );
            })}

            {selectedItems.length > 0 ? (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                {selectedItems.map((item) => (
                  <div
                    key={item.rowId}
                    className="flex items-center justify-between gap-4 rounded-[20px] border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          item.imagePath
                            ? setPreviewImage({
                                src: item.imagePath,
                                alt: `${item.productLabel} ${item.color}`,
                              })
                            : undefined
                        }
                        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                      >
                        {item.imagePath ? (
                          <UploadedImage
                            src={item.imagePath}
                            alt={`${item.productLabel} ${item.color}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                            IMG
                          </span>
                        )}
                      </button>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {item.productLabel}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Nr {item.size} / {item.color}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">
                        {item.price.toFixed(2)} EUR
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        x{item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRow(item.rowId)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-500 transition hover:bg-rose-50"
                        aria-label={`Hiq ${item.productLabel}`}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          fill="none"
                          className="h-4 w-4"
                        >
                          <path
                            d="M6 6l8 8M14 6l-8 8"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-5 w-5"
              >
                <path
                  d="M10 5.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM4.25 17.25v-.5A3.75 3.75 0 0 1 8 13h4a3.75 3.75 0 0 1 3.75 3.75v.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-xl font-semibold text-slate-950">
              Informacioni i Klientit
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label
                htmlFor="customerName"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Emri i Klientit
              </label>
              <input
                id="customerName"
                name="customerName"
                type="text"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                placeholder="Filan Fisteku"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Telefoni
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                placeholder="+383 4X XXX XXX"
              />
            </div>

            <div>
              <label
                htmlFor="instagram"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Username / Referenca
              </label>
              <input
                id="instagram"
                name="instagram"
                type="text"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                placeholder="@username"
              />
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-[28px] bg-[#0f256c] px-5 py-6 text-white shadow-[0_22px_40px_rgba(15,37,108,0.2)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-5 w-5"
              >
                <path
                  d="M5 5.75h10M5 10h10M5 14.25h7"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-2xl font-semibold">Përmbledhja</p>
          </div>

          <dl className="mt-6 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/70">
                Produkte ({selectedItems.length})
              </dt>
              <dd className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold">
                {selectedItems.length} items
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/70">Nëntotali</dt>
              <dd className="font-semibold">{subtotal.toFixed(2)} EUR</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/70">Transporti</dt>
              <dd className="font-semibold">{shipping.toFixed(2)} EUR</dd>
            </div>
          </dl>

          <div className="mt-8 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
            <div>
              <p className="text-sm text-white/70">Totali</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight">
                {grandTotal.toFixed(2)} EUR
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(16,185,129,0.25)] transition hover:bg-emerald-400"
          >
            Krijo Porosine
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4"
            >
              <path
                d="M4.75 10h10.5M11 6.25 14.75 10 11 13.75"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </section>

        <Link
          href="/orders"
          className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Kthehu te porosite
        </Link>
      </aside>

      {previewImage ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-xl overflow-hidden rounded-[28px] bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-slate-950"
              aria-label="Mbyll foton"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
              >
                <path
                  d="M6 6l8 8M14 6l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="overflow-hidden rounded-[22px]">
              <UploadedImage
                src={previewImage.src}
                alt={previewImage.alt}
                className="h-auto max-h-[80vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
