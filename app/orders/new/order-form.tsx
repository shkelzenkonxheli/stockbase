"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { UploadedImage } from "@/app/components/uploaded-image";
import { getOrderVariantMode, getOrderVariantSummary } from "@/lib/order-variant-display";

type OrderVariant = {
  id: number;
  productId: number;
  productLabel: string;
  warehouseName?: string | null;
  category: string;
  size: string;
  color: string;
  imagePath: string | null;
  stock: number;
  price: number;
  material?: string | null;
  powerWatts?: string | null;
};

type ProductOption = {
  id: number;
  name: string;
  brand: string;
  warehouseName: string;
  category: string;
  imagePath: string | null;
};

type OrderFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  products: ProductOption[];
};

type OrderSource = "INSTAGRAM" | "STORE" | "WHOLESALE";

type OrderItemRow = {
  id: string;
  productId: string;
  variantId: string;
  quantity: string;
  unitPrice: string;
};

const sourceOptions: Array<{ value: OrderSource; label: string }> = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "STORE", label: "Dyqan" },
  { value: "WHOLESALE", label: "Shumice" },
];

function createRow(productId: number, variantId: number, unitPrice: number): OrderItemRow {
  return {
    id: crypto.randomUUID(),
    productId: String(productId),
    variantId: String(variantId),
    quantity: "1",
    unitPrice: unitPrice.toFixed(2),
  };
}

function getSourceIcon(source: OrderSource) {
  switch (source) {
    case "INSTAGRAM":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <rect
            x="4.25"
            y="4.25"
            width="11.5"
            height="11.5"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="10" cy="10" r="2.75" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="14" cy="6" r="0.9" fill="currentColor" />
        </svg>
      );
    case "STORE":
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
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
          <path d="M8 10.25h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
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
  const [rows, setRows] = useState<OrderItemRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [variantsByProduct, setVariantsByProduct] = useState<Record<number, OrderVariant[]>>(
    {},
  );
  const [loadingProducts, setLoadingProducts] = useState<Record<number, boolean>>({});
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  const [selectedColorKey, setSelectedColorKey] = useState("");
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

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

  useEffect(() => {
    if (!selectedProductId) {
      setVariantModalOpen(false);
      setSizeModalOpen(false);
      setSelectedColorKey("");
    }
  }, [selectedProductId]);

  useEffect(() => {
    if (!selectedCategory) {
      setProductModalOpen(false);
    }
  }, [selectedCategory]);

  const categories = useMemo(
    () =>
      [...new Set(products.map((product) => product.category))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [products],
  );

  const selectedCategoryMode = getOrderVariantMode(selectedCategory);
  const isFootwearCategory = selectedCategoryMode === "footwear";

  const categoryProducts = useMemo(
    () =>
      selectedCategory
        ? products.filter((product) => product.category === selectedCategory)
        : [],
    [products, selectedCategory],
  );

  const categoryBrands = useMemo(
    () =>
      [...new Set(categoryProducts.map((product) => product.brand).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [categoryProducts],
  );

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }

    if (!isFootwearCategory) {
      return categoryProducts;
    }

    if (!selectedBrand) {
      return [];
    }

    return categoryProducts.filter((product) => product.brand === selectedBrand);
  }, [categoryProducts, isFootwearCategory, selectedBrand, selectedCategory]);

  const visibleProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    if (!query) {
      return filteredProducts;
    }

    return filteredProducts.filter((product) => product.name.toLowerCase().includes(query));
  }, [filteredProducts, productSearch]);

  const currentProductId = Number(selectedProductId);
  const currentProduct = products.find((product) => product.id === currentProductId) ?? null;
  const currentVariants = currentProductId ? variantsByProduct[currentProductId] ?? [] : [];
  const currentProductLoading = currentProductId ? Boolean(loadingProducts[currentProductId]) : false;

  const reservedByVariant = useMemo(() => {
    const totals = new Map<number, number>();

    for (const row of rows) {
      const variantId = Number(row.variantId);
      const quantity = Number(row.quantity);

      if (!variantId) {
        continue;
      }

      totals.set(variantId, (totals.get(variantId) ?? 0) + (quantity > 0 ? quantity : 0));
    }

    return totals;
  }, [rows]);

  const variantOptions = currentVariants
    .map((variant) => ({
      ...variant,
      availableStock: variant.stock - (reservedByVariant.get(variant.id) ?? 0),
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

  const colorGroups = useMemo(() => {
    if (!isFootwearCategory) {
      return [];
    }

    const map = new Map<string, { key: string; color: string; imagePath: string | null; totalStock: number }>();

    for (const variant of variantOptions) {
      const key = variant.color.trim().toLowerCase();
      const current = map.get(key);

      if (current) {
        current.totalStock += variant.availableStock;
        if (!current.imagePath && variant.imagePath) {
          current.imagePath = variant.imagePath;
        }
      } else {
        map.set(key, {
          key,
          color: variant.color,
          imagePath: variant.imagePath,
          totalStock: variant.availableStock,
        });
      }
    }

    return [...map.values()].sort((a, b) =>
      a.color.localeCompare(b.color, "sq", { sensitivity: "base" }),
    );
  }, [isFootwearCategory, variantOptions]);

  const selectedColorVariants = useMemo(() => {
    if (!selectedColorKey) {
      return [];
    }

    return variantOptions
      .filter((variant) => variant.color.trim().toLowerCase() === selectedColorKey)
      .sort((a, b) =>
        a.size.localeCompare(b.size, "sq", { numeric: true, sensitivity: "base" }),
      );
  }, [selectedColorKey, variantOptions]);

  const selectedItems = rows
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
        row: OrderItemRow;
        product: ProductOption;
        variant: OrderVariant;
      } => item !== null,
    );

  const subtotal = selectedItems.reduce(
    (sum, item) => sum + (Number(item.row.quantity) || 0) * (Number(item.row.unitPrice) || 0),
    0,
  );
  const shipping = 0;
  const grandTotal = subtotal + shipping;
  const serializedItems = JSON.stringify(
    rows
      .map((row) => ({
        variantId: Number(row.variantId),
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
      }))
      .filter(
        (row) =>
          row.variantId > 0 &&
          row.quantity > 0 &&
          !Number.isNaN(row.unitPrice) &&
          row.unitPrice >= 0,
      ),
  );

  const addSelectedVariant = (variantIdValue: string) => {
    const productId = Number(selectedProductId);
    const variantId = Number(variantIdValue);

    if (!productId || !variantId) {
      return;
    }

    setRows((currentRows) => {
      const existingRow = currentRows.find((row) => Number(row.variantId) === variantId);

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

      const variant = currentVariants.find((item) => item.id === variantId);
      return [...currentRows, createRow(productId, variantId, variant?.price ?? 0)];
    });

    setVariantModalOpen(false);
    setSizeModalOpen(false);
    setSelectedColorKey("");
  };

  const updateUnitPrice = (rowId: string, value: string) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              unitPrice: value,
            }
          : row,
      ),
    );
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
    <form action={action} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_312px]">
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
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
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
                <p className="text-xl font-semibold text-slate-950">Detajet e Produktit</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <select
                value={selectedCategory}
                onChange={(event) => {
                  const nextCategory = event.target.value;
                  setSelectedCategory(nextCategory);
                  setSelectedBrand("");
                  setProductSearch("");
                  setSelectedProductId("");
                  setProductModalOpen(
                    Boolean(nextCategory) && getOrderVariantMode(nextCategory) !== "footwear",
                  );
                  setVariantModalOpen(false);
                  setSizeModalOpen(false);
                  setSelectedColorKey("");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Zgjidh kategorine</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              {isFootwearCategory ? (
                <select
                  value={selectedBrand}
                  onChange={(event) => {
                    const nextBrand = event.target.value;
                    setSelectedBrand(nextBrand);
                    setProductSearch("");
                    setSelectedProductId("");
                    setProductModalOpen(Boolean(nextBrand));
                    setVariantModalOpen(false);
                    setSizeModalOpen(false);
                    setSelectedColorKey("");
                  }}
                  disabled={!selectedCategory}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  <option value="">Zgjidh brandin</option>
                  {categoryBrands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {selectedCategory ? (
              <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Filtri aktiv
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {isFootwearCategory && selectedBrand
                      ? `${selectedCategory} / ${selectedBrand}`
                      : selectedCategory}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isFootwearCategory || selectedBrand) {
                      setProductModalOpen(true);
                    }
                  }}
                  disabled={isFootwearCategory && !selectedBrand}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Zgjidh modelin
                </button>
              </div>
            ) : null}

            {selectedItems.length > 0 ? (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                {selectedItems.map(({ row, product, variant }) => (
                  <div
                    key={row.id}
                    className="rounded-[20px] border border-slate-200 bg-slate-50/60 px-4 py-4"
                  >
                    <div className="space-y-4 lg:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              variant.imagePath
                                ? setPreviewImage({
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
                            <p className="mt-1 text-xs text-slate-500">{product.brand}</p>
                            <div className="mt-2">
                              <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                                {getOrderVariantSummary(variant)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none text-rose-500 transition hover:bg-rose-50"
                          aria-label="Hiq"
                        >
                          ×
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="w-28">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unitPrice}
                            onChange={(event) => updateUnitPrice(row.id, event.target.value)}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                          />
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
                          <button
                            type="button"
                            onClick={() => changeQuantity(row.id, -1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-slate-700 transition hover:bg-slate-200"
                          >
                            -
                          </button>
                          <span className="min-w-7 text-center text-sm font-semibold text-slate-950">
                            {row.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(row.id, 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-base font-semibold text-white transition hover:bg-blue-500"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="hidden lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(160px,1fr)_120px_120px_80px] lg:items-center lg:gap-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            variant.imagePath
                              ? setPreviewImage({
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
                          <p className="mt-1 text-xs text-slate-500">{product.brand}</p>
                        </div>
                      </div>

                      <div>
                        <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                          {getOrderVariantSummary(variant)}
                        </span>
                      </div>

                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.unitPrice}
                          onChange={(event) => updateUnitPrice(row.id, event.target.value)}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        />
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
                    </div>

                    {rowErrors[row.id] ? (
                      <p className="mt-3 text-sm font-medium text-rose-600">{rowErrors[row.id]}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Zgjidh kategorine dhe produktin per ta shtuar ne liste.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                <path
                  d="M10 5.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM4.25 17.25v-.5A3.75 3.75 0 0 1 8 13h4a3.75 3.75 0 0 1 3.75 3.75v.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-xl font-semibold text-slate-950">Informacioni i Klientit</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label htmlFor="customerName" className="mb-2 block text-sm font-medium text-slate-700">
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
              <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-700">
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
              <label htmlFor="instagram" className="mb-2 block text-sm font-medium text-slate-700">
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
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
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
              <dt className="text-white/70">Produkte ({selectedItems.length})</dt>
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
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
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

      {productModalOpen && selectedCategory ? (
        <div className="fixed inset-0 z-[88] flex items-center justify-center bg-slate-950/55 p-4">
          <button
            type="button"
            onClick={() => setProductModalOpen(false)}
            className="absolute inset-0 cursor-default"
            aria-label="Mbyll modelet"
          />

          <div className="relative z-[89] flex w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Modelet
                </p>
                <h3 className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950">
                  {isFootwearCategory && selectedBrand
                    ? `${selectedCategory} / ${selectedBrand}`
                    : selectedCategory}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Zgjidh modelin dhe pastaj variantin me stok.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Mbyll"
              >
                ×
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Kerko modelin"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 sm:max-w-sm"
                />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {visibleProducts.length} modele
                </span>
              </div>

              {visibleProducts.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                  Nuk u gjet asnje produkt per kete kategori.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                  {visibleProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(String(product.id));
                        setProductModalOpen(false);
                        setVariantModalOpen(true);
                      }}
                      className="group overflow-hidden rounded-[20px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="aspect-square overflow-hidden bg-slate-100">
                        {product.imagePath ? (
                          <UploadedImage
                            src={product.imagePath}
                            alt={product.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                            IMG
                          </div>
                        )}
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="line-clamp-2 text-[11px] font-semibold text-slate-950 sm:text-xs">
                          {product.name}
                        </p>
                        {product.warehouseName ? (
                          <p className="mt-1 text-[10px] text-slate-500 sm:text-[11px]">
                            {product.warehouseName}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {variantModalOpen && currentProduct ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4">
          <button
            type="button"
            onClick={() => setVariantModalOpen(false)}
            className="absolute inset-0 cursor-default"
            aria-label="Mbyll variantet"
          />

          <div className="relative z-[91] flex w-full max-w-4xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {isFootwearCategory ? "Ngjyrat" : "Variantet"}
                </p>
                <h3 className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950">
                  {currentProduct.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {isFootwearCategory
                    ? "Zgjidh ngjyren dhe pastaj numrin."
                    : "Zgjidh variantin qe do ta shtosh ne porosi."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVariantModalOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Mbyll"
              >
                ×
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              {currentProductLoading ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                  Duke ngarkuar variantet...
                </div>
              ) : variantOptions.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                  Nuk ka variante me stok.
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {isFootwearCategory ? `${colorGroups.length} ngjyra` : `${variantOptions.length} variante`}
                  </span>
                </div>
              )}

              {!currentProductLoading && variantOptions.length > 0 && isFootwearCategory ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {colorGroups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => {
                        setSelectedColorKey(group.key);
                        setVariantModalOpen(false);
                        setSizeModalOpen(true);
                      }}
                      className="group overflow-hidden rounded-[18px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <span className="flex aspect-square w-full items-center justify-center overflow-hidden bg-slate-100">
                        {group.imagePath ? (
                          <UploadedImage
                            src={group.imagePath}
                            alt={`${currentProduct.name} ${group.color}`}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                            IMG
                          </span>
                        )}
                      </span>
                      <span className="block min-w-0 px-2 py-2">
                        <span className="block line-clamp-2 text-[10px] font-semibold text-slate-950 sm:text-[11px]">
                          {group.color}
                        </span>
                        {currentProduct.warehouseName ? (
                          <span className="mt-1 block text-[10px] text-slate-500">
                            {currentProduct.warehouseName}
                          </span>
                        ) : null}
                        <span className="mt-1.5 inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 sm:text-[10px]">
                          {group.totalStock} ne stok
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {!currentProductLoading && variantOptions.length > 0 && !isFootwearCategory ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {variantOptions.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => addSelectedVariant(String(variant.id))}
                      className="group overflow-hidden rounded-[18px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <span className="flex aspect-square w-full items-center justify-center overflow-hidden bg-slate-100">
                        {variant.imagePath ? (
                          <UploadedImage
                            src={variant.imagePath}
                            alt={`${currentProduct.name} ${variant.color}`}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                            IMG
                          </span>
                        )}
                      </span>
                      <span className="block min-w-0 px-2 py-2">
                        <span className="block line-clamp-2 text-[10px] font-semibold text-slate-950 sm:text-[11px]">
                          {getOrderVariantSummary(variant)}
                        </span>
                        {variant.warehouseName ? (
                          <span className="mt-1 block text-[10px] text-slate-500">
                            {variant.warehouseName}
                          </span>
                        ) : null}
                        <span className="mt-1.5 inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 sm:text-[10px]">
                          {variant.availableStock} ne stok
                        </span>
                        <span className="mt-1.5 block text-[11px] font-semibold text-slate-950 sm:text-xs">
                          €{variant.price.toFixed(2)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {sizeModalOpen && currentProduct ? (
        <div className="fixed inset-0 z-[92] flex items-center justify-center bg-slate-950/60 p-4">
          <button
            type="button"
            onClick={() => setSizeModalOpen(false)}
            className="absolute inset-0 cursor-default"
            aria-label="Mbyll numrat"
          />

          <div className="relative z-[93] flex w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Numrat
                </p>
                <h3 className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950">
                  {currentProduct.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedColorVariants[0]?.color
                    ? `Zgjidh numrin per ngjyren ${selectedColorVariants[0].color}.`
                    : "Zgjidh numrin."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSizeModalOpen(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Mbyll"
              >
                ×
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              {selectedColorVariants.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                  Nuk ka numra me stok per kete ngjyre.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {selectedColorVariants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => addSelectedVariant(String(variant.id))}
                      className="rounded-[18px] border border-slate-200 bg-white px-2 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Nr
                      </span>
                      <span className="mt-1 block text-lg font-semibold text-slate-950">
                        {variant.size}
                      </span>
                      <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 sm:text-[10px]">
                        {variant.availableStock} ne stok
                      </span>
                      <span className="mt-1.5 block text-[11px] font-semibold text-slate-950 sm:text-xs">
                        €{variant.price.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4"
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
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
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


