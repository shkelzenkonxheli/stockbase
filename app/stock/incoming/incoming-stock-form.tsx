"use client";

import { useEffect, useMemo, useState } from "react";
import { UploadedImage } from "@/app/components/uploaded-image";
import { getStockTone } from "@/lib/inventory";

type ProductOption = {
  id: number;
  name: string;
  brand: string;
};

type InventoryVariant = {
  id: number;
  productId: number;
  productLabel: string;
  size: string;
  color: string;
  imagePath: string | null;
  stock: number;
  price: number;
};

type IncomingStockFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  products: ProductOption[];
};

export function IncomingStockForm({
  action,
  products,
}: IncomingStockFormProps) {
  const [productId, setProductId] = useState("");
  const [reason, setReason] = useState("INCOMING_STOCK");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [variants, setVariants] = useState<InventoryVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  useEffect(() => {
    const parsedProductId = Number(productId);

    if (!parsedProductId) {
      setSelectedColor("");
      setVariants([]);
      setQuantities({});
      return;
    }

    let isCancelled = false;

    const loadVariants = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/products/${parsedProductId}/inventory-variants`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          if (!isCancelled) {
            setVariants([]);
          }
          return;
        }

        const data = (await response.json()) as InventoryVariant[];

        if (!isCancelled) {
          setSelectedColor("");
          setVariants(data);
          setQuantities({});
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadVariants();

    return () => {
      isCancelled = true;
    };
  }, [productId]);

  const serializedAdjustments = JSON.stringify(
    Object.entries(quantities)
      .map(([variantId, quantity]) => ({
        variantId: Number(variantId),
        quantity: Number(quantity),
      }))
      .filter((item) => item.variantId > 0 && item.quantity > 0),
  );

  const totalAdded = useMemo(
    () =>
      Object.values(quantities).reduce((sum, quantity) => {
        const parsedQuantity = Number(quantity);
        return sum + (parsedQuantity > 0 ? parsedQuantity : 0);
      }, 0),
    [quantities],
  );

  const colors = useMemo(
    () => [...new Set(variants.map((variant) => variant.color))].sort(),
    [variants],
  );

  const brands = useMemo(
    () =>
      [...new Set(products.map((product) => product.brand))].sort((a, b) =>
        a.localeCompare(b, "sq", { sensitivity: "base" }),
      ),
    [products],
  );

  const filteredProducts = useMemo(
    () =>
      selectedBrand
        ? products.filter((product) => product.brand === selectedBrand)
        : products,
    [products, selectedBrand],
  );

  const visibleVariants = useMemo(
    () =>
      selectedColor
        ? variants.filter((variant) => variant.color === selectedColor)
        : variants,
    [selectedColor, variants],
  );

  const getColorDotClassName = (color: string) => {
    const normalizedColor = color.trim().toLowerCase();

    if (
      normalizedColor.includes("bardh") ||
      normalizedColor.includes("white")
    ) {
      return "border border-slate-300 bg-white";
    }
    if (normalizedColor.includes("zi") || normalizedColor.includes("black")) {
      return "bg-black";
    }
    if (normalizedColor.includes("kuq") || normalizedColor.includes("red")) {
      return "bg-red-500";
    }
    if (
      normalizedColor.includes("gjelb") ||
      normalizedColor.includes("green")
    ) {
      return "bg-emerald-500";
    }
    if (normalizedColor.includes("blu") || normalizedColor.includes("blue")) {
      return "bg-blue-500";
    }
    if (
      normalizedColor.includes("verdh") ||
      normalizedColor.includes("yellow")
    ) {
      return "bg-amber-400";
    }

    return "bg-slate-400";
  };

  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="adjustments" value={serializedAdjustments} />

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Arsyeja
            </span>
            <select
              id="reason"
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
            >
              <option value="INCOMING_STOCK">Hyrje stoku</option>
              <option value="CUSTOMER_RETURN">Kthim klienti</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Kategoria
            </span>
            <select
              id="brandFilter"
              value={selectedBrand}
              onChange={(event) => {
                setSelectedBrand(event.target.value);
                setProductId("");
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
            >
              <option value="">Te gjitha kategorite</option>
              {brands.map((brand, index) => (
                <option key={`${brand}-${index}`} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Produkti
            </span>
            <select
              id="productId"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
            >
              <option value="">Zgjidh produktin</option>
              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ngjyra
            </span>
            <select
              id="colorFilter"
              value={selectedColor}
              onChange={(event) => setSelectedColor(event.target.value)}
              disabled={!productId || colors.length === 0}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Te gjitha ngjyrat</option>
              {colors.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Variante aktive
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {visibleVariants.length}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Pale qe shtohen
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-600">
              +{totalAdded}
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
          Duke ngarkuar variantet...
        </div>
      ) : null}

      {!loading && productId && variants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center">
          <p className="text-base font-medium text-slate-900">
            Ky produkt nuk ka ende variante
          </p>
        </div>
      ) : null}

      {variants.length > 0 ? (
        <>
          <div className="grid gap-4 lg:hidden">
            {visibleVariants.map((variant) => {
              const stockTone = getStockTone(variant.stock);

              return (
                <article
                  key={variant.id}
                  className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {variant.imagePath ? (
                          <UploadedImage
                            src={variant.imagePath}
                            alt={`${variant.productLabel} ${variant.color}`}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          Nr {variant.size} / {variant.color}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          stok {variant.stock}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex min-w-20 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${stockTone.badgeClassName}`}
                    >
                      {stockTone.label}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <label
                      htmlFor={`variant-${variant.id}`}
                      className="block text-sm font-medium text-slate-800"
                    >
                      Shto ne stok
                    </label>
                    <input
                      id={`variant-${variant.id}`}
                      type="number"
                      min="0"
                      value={quantities[variant.id] ?? ""}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [variant.id]: event.target.value,
                        }))
                      }
                      placeholder="0"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-left">
                  <tr className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3.5">Foto</th>
                    <th className="px-4 py-3.5">Numri</th>
                    <th className="px-4 py-3.5">Ngjyra</th>
                    <th className="px-4 py-3.5 text-right">Stoku aktual</th>
                    <th className="px-4 py-3.5 text-right">Shto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visibleVariants.map((variant) => (
                    <tr key={variant.id}>
                      <td className="px-4 py-4">
                        <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          {variant.imagePath ? (
                            <UploadedImage
                              src={variant.imagePath}
                              alt={`${variant.productLabel} ${variant.color}`}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {variant.size}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${getColorDotClassName(variant.color)}`}
                          />
                          <span>{variant.color}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-semibold tabular-nums text-slate-900">
                          {variant.stock}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <input
                          type="number"
                          min="0"
                          value={quantities[variant.id] ?? ""}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [variant.id]: event.target.value,
                            }))
                          }
                          placeholder="0"
                          className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {visibleVariants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center">
              <p className="text-base font-medium text-slate-900">
                Nuk u gjet asnje variant me kete ngjyre
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="pt-1">
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
        >
          Ruaj hyrjen e stokut
        </button>
      </div>
    </form>
  );
}
