"use client";

import { useEffect, useMemo, useState } from "react";
import { BarcodeScanDialog } from "@/app/components/barcode-scan-dialog";
import { UploadedImage } from "@/app/components/uploaded-image";
import { getStockTone } from "@/lib/inventory";

type ProductOption = {
  id: number;
  name: string;
  brand: string;
};

type WarehouseOption = {
  id: number;
  name: string;
};

type InventoryVariant = {
  id: number;
  productId: number;
  productLabel: string;
  warehouseName?: string | null;
  locationCode?: string | null;
  size: string;
  color: string;
  imagePath: string | null;
  stock: number;
  price: number;
};

type TransferStockFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  warehouses: WarehouseOption[];
  products: ProductOption[];
};

export function TransferStockForm({
  action,
  warehouses,
  products,
}: TransferStockFormProps) {
  const [fromWarehouseId, setFromWarehouseId] = useState(
    warehouses[0] ? String(warehouses[0].id) : "",
  );
  const [toWarehouseId, setToWarehouseId] = useState(
    warehouses[1] ? String(warehouses[1].id) : warehouses[0] ? String(warehouses[0].id) : "",
  );
  const [productId, setProductId] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [variants, setVariants] = useState<InventoryVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const [pendingScannedVariantId, setPendingScannedVariantId] = useState<number | null>(null);

  useEffect(() => {
    const parsedProductId = Number(productId);
    const parsedWarehouseId = Number(fromWarehouseId);

    if (!parsedProductId || !parsedWarehouseId) {
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
          `/api/products/${parsedProductId}/inventory-variants?warehouseId=${parsedWarehouseId}`,
          { cache: "no-store" },
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
          setVariants(data.filter((variant) => variant.stock > 0));
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
  }, [productId, fromWarehouseId]);

  useEffect(() => {
    if (!scannerMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setScannerMessage(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [scannerMessage]);

  useEffect(() => {
    if (!pendingScannedVariantId || variants.length === 0) {
      return;
    }

    const matchedVariant = variants.find((variant) => variant.id === pendingScannedVariantId);

    if (!matchedVariant) {
      return;
    }

    setSelectedColor(matchedVariant.color);
    setQuantities((current) => ({
      ...current,
      [matchedVariant.id]: current[matchedVariant.id] && Number(current[matchedVariant.id]) > 0
        ? current[matchedVariant.id]
        : "1",
    }));
    setPendingScannedVariantId(null);
  }, [pendingScannedVariantId, variants]);

  const serializedAdjustments = JSON.stringify(
    Object.entries(quantities)
      .map(([variantId, quantity]) => ({
        variantId: Number(variantId),
        quantity: Number(quantity),
      }))
      .filter((item) => item.variantId > 0 && item.quantity > 0),
  );

  const totalTransferred = useMemo(
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

  const handleScanDetected = async (code: string) => {
    try {
      const response = await fetch(
        `/api/variants/lookup?code=${encodeURIComponent(code)}&warehouseId=${Number(fromWarehouseId) || ""}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        setScannerMessage("Nuk u gjet variant me kete barcode ne depon burim.");
        return;
      }

      const data = (await response.json()) as {
        variant: InventoryVariant;
        product: ProductOption;
      };

      if (!data.variant || !data.product) {
        setScannerMessage("Lookup-u nuk ktheu variant valid.");
        return;
      }

      if (data.variant.stock <= 0) {
        setScannerMessage("Varianti ekziston, por nuk ka stok ne depon burim.");
        return;
      }

      setSelectedBrand(data.product.brand ?? "");
      setProductId(String(data.product.id));
      setPendingScannedVariantId(data.variant.id);
      setScannerMessage(`U lexua: ${data.product.name} / ${data.variant.color} / ${data.variant.size}`);
    } catch {
      setScannerMessage("Skanimi u lexua, por lookup deshtoi. Provo perseri.");
    }
  };

  const visibleVariants = useMemo(
    () =>
      selectedColor
        ? variants.filter((variant) => variant.color === selectedColor)
        : variants,
    [selectedColor, variants],
  );

  const getColorDotClassName = (color: string) => {
    const normalizedColor = color.trim().toLowerCase();
    if (normalizedColor.includes("bardh") || normalizedColor.includes("white")) {
      return "border border-slate-300 bg-white";
    }
    if (normalizedColor.includes("zi") || normalizedColor.includes("black")) return "bg-black";
    if (normalizedColor.includes("kuq") || normalizedColor.includes("red")) return "bg-red-500";
    if (normalizedColor.includes("gjelb") || normalizedColor.includes("green")) return "bg-emerald-500";
    if (normalizedColor.includes("blu") || normalizedColor.includes("blue")) return "bg-blue-500";
    if (normalizedColor.includes("verdh") || normalizedColor.includes("yellow")) return "bg-amber-400";
    return "bg-slate-400";
  };

  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="fromWarehouseId" value={fromWarehouseId} />
      <input type="hidden" name="toWarehouseId" value={toWarehouseId} />
      <input type="hidden" name="adjustments" value={serializedAdjustments} />

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="grid gap-4 lg:grid-cols-5">
          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Nga depoja
            </span>
            <select
              value={fromWarehouseId}
              onChange={(event) => {
                const nextValue = event.target.value;
                setFromWarehouseId(nextValue);
                if (nextValue === toWarehouseId) {
                  const fallback = warehouses.find((warehouse) => String(warehouse.id) !== nextValue);
                  setToWarehouseId(fallback ? String(fallback.id) : nextValue);
                }
                setProductId("");
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Te depoja
            </span>
            <select
              value={toWarehouseId}
              onChange={(event) => setToWarehouseId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
            >
              {warehouses.map((warehouse) => (
                <option
                  key={warehouse.id}
                  value={warehouse.id}
                  disabled={String(warehouse.id) === fromWarehouseId}
                >
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Kategoria
            </span>
            <select
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

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Variante ne burim
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {visibleVariants.length}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-600">
              Pale qe transferohen
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-amber-600">
              {totalTransferred}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Drejtimi
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {warehouses.find((warehouse) => String(warehouse.id) === fromWarehouseId)?.name ?? "-"}{" "}
              -&gt;{" "}
              {warehouses.find((warehouse) => String(warehouse.id) === toWarehouseId)?.name ?? "-"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Scan barcode
          </button>
          {scannerMessage ? (
            <span className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {scannerMessage}
            </span>
          ) : null}
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
            Ky produkt nuk ka stok ne depon burim
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
                          {variant.size} / {variant.color}
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
                      Transfero
                    </label>
                    <input
                      id={`variant-${variant.id}`}
                      type="number"
                      min="0"
                      max={variant.stock}
                      value={quantities[variant.id] ?? ""}
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [variant.id]: event.target.value,
                        }))
                      }
                      placeholder="0"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
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
                    <th className="px-4 py-3.5">Lokacioni</th>
                    <th className="px-4 py-3.5 text-right">Stoku burim</th>
                    <th className="px-4 py-3.5 text-right">Transfero</th>
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
                      <td className="px-4 py-4 font-medium text-slate-900">{variant.size}</td>
                      <td className="px-4 py-4 text-slate-700">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${getColorDotClassName(variant.color)}`}
                          />
                          <span>{variant.color}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {variant.locationCode ?? "-"}
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
                          max={variant.stock}
                          value={quantities[variant.id] ?? ""}
                          onChange={(event) =>
                            setQuantities((current) => ({
                              ...current,
                              [variant.id]: event.target.value,
                            }))
                          }
                          placeholder="0"
                          className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
        >
          Ruaj transferin
        </button>
      </div>

      <BarcodeScanDialog
        open={scannerOpen}
        title="Skano per transfer stoku"
        description="Barcode-i kerkohet ne depon burim. Varianti i lexuar zgjedhet automatikisht dhe vendoset me sasi 1."
        onClose={() => setScannerOpen(false)}
        onDetected={(detectedCode) => {
          void handleScanDetected(detectedCode);
        }}
      />
    </form>
  );
}
