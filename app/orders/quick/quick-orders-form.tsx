"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { UploadedImage } from "@/app/components/uploaded-image";
import { getOrderVariantMode, getOrderVariantSummary } from "@/lib/order-variant-display";

type ProductOption = {
  id: number;
  name: string;
  brand: string;
  category: string;
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
  unitPrice: string;
};

const sourceOptions: Array<{ value: OrderSource; label: string }> = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "STORE", label: "Shitore" },
  { value: "WHOLESALE", label: "Shumice" },
];

function createRow(productId: number, variantId: number, unitPrice: number): QuickOrderRow {
  return {
    id: crypto.randomUUID(),
    productId: String(productId),
    variantId: String(variantId),
    quantity: "1",
    unitPrice: unitPrice.toFixed(2),
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
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  const [selectedColorKey, setSelectedColorKey] = useState("");
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

    return filteredProducts.filter((product) =>
      product.name.toLowerCase().includes(query),
    );
  }, [filteredProducts, productSearch]);

  const currentProductId = Number(selectedProductId);
  const currentProduct =
    products.find((product) => product.id === currentProductId) ?? null;
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

  const colorGroups = useMemo(() => {
    if (!isFootwearCategory) {
      return [];
    }

    const map = new Map<
      string,
      { key: string; color: string; imagePath: string | null; totalStock: number }
    >();

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

  const totalQuantity = rows.reduce(
    (sum, row) => sum + (Number(row.quantity) > 0 ? Number(row.quantity) : 0),
    0,
  );

  const addSelectedVariant = (variantIdValue: string) => {
    const productId = Number(selectedProductId);
    const variantId = Number(variantIdValue);

    if (!productId || !variantId) {
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

      const variant = currentVariants.find((item) => item.id === variantId);
      return [
        ...currentRows,
        createRow(productId, variantId, variant?.price ?? 0),
      ];
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
            value={selectedCategory}
            onChange={(event) => {
              const nextCategory = event.target.value;
              setSelectedCategory(nextCategory);
              setSelectedBrand("");
              setProductSearch("");
              setSelectedProductId("");
              setProductModalOpen(Boolean(nextCategory) && getOrderVariantMode(nextCategory) !== "footwear");
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
          <div className="mt-5 flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
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
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Zgjidh modelin
            </button>
          </div>
        ) : null}
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
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(160px,1fr)_120px_120px_80px] gap-5 border-b border-slate-100 pb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 lg:grid">
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
                  className="rounded-[20px] border border-slate-200 bg-slate-50/60 px-4 py-4"
                >
                  <div className="space-y-4 lg:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
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
                    <div className="lg:col-span-5">
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
                        if (isFootwearCategory) {
                          setVariantModalOpen(true);
                        } else {
                          setVariantModalOpen(true);
                        }
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
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">IMG</span>
                        )}
                      </span>
                      <span className="block min-w-0 px-2 py-2">
                        <span className="block line-clamp-2 text-[10px] font-semibold text-slate-950 sm:text-[11px]">
                          {group.color}
                        </span>
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
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">IMG</span>
                        )}
                      </span>
                      <span className="block min-w-0 px-2 py-2">
                        <span className="block line-clamp-2 text-[10px] font-semibold text-slate-950 sm:text-[11px]">
                          {getOrderVariantSummary(variant)}
                        </span>
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
