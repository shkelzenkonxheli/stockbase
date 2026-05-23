"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ConfirmActionForm } from "@/app/components/confirm-action-form";
import { UploadedImage } from "@/app/components/uploaded-image";
import { getStockTone } from "@/lib/inventory";
import type { CustomVariantField } from "@/lib/product-taxonomy";

type VariantItem = {
  id: number;
  size: string;
  color: string;
  material: string | null;
  powerWatts: string | null;
  sku: string | null;
  barcode: string | null;
  imagePath: string | null;
  stock: number;
  price: number;
  customAttributes: Record<string, string>;
};

type VariantsManagerProps = {
  productId: number;
  productName: string;
  canManageInventory: boolean;
  selectedSize: string;
  selectedColor: string;
  selectedStock: string;
  variants: VariantItem[];
  customFields: CustomVariantField[];
  deleteVariantAction: (formData: FormData) => void | Promise<void>;
  bulkDeleteAction: (formData: FormData) => void | Promise<void>;
};

export function VariantsManager({
  productId,
  productName,
  canManageInventory,
  selectedSize,
  selectedColor,
  selectedStock,
  variants,
  customFields,
  deleteVariantAction,
  bulkDeleteAction,
}: VariantsManagerProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const allSelected = useMemo(
    () => variants.length > 0 && selectedIds.length === variants.length,
    [selectedIds, variants.length],
  );

  const serializedSelectedIds = JSON.stringify(selectedIds);

  const toggleOne = (variantId: number) => {
    setSelectedIds((current) =>
      current.includes(variantId)
        ? current.filter((id) => id !== variantId)
        : [...current, variantId],
    );
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : variants.map((variant) => variant.id));
  };

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

    if (
      normalizedColor.includes("kuq") ||
      normalizedColor.includes("red")
    ) {
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

    if (
      normalizedColor.includes("roz") ||
      normalizedColor.includes("pink")
    ) {
      return "bg-pink-400";
    }

    if (
      normalizedColor.includes("vjollc") ||
      normalizedColor.includes("purple")
    ) {
      return "bg-violet-500";
    }

    if (
      normalizedColor.includes("portokall") ||
      normalizedColor.includes("orange")
    ) {
      return "bg-orange-500";
    }

    if (
      normalizedColor.includes("kafe") ||
      normalizedColor.includes("brown")
    ) {
      return "bg-amber-700";
    }

    if (normalizedColor.includes("gri") || normalizedColor.includes("gray")) {
      return "bg-slate-400";
    }

    return "bg-slate-400";
  };

  const renderActionIcons = (variantId: number) => (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/products/${productId}/variants/${variantId}/edit`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        title="Edito variantin"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M4 20h4l10-10a2.121 2.121 0 0 0-3-3L5 17v3Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
      <ConfirmActionForm
        action={deleteVariantAction}
        hiddenFields={[
          { name: "variantId", value: variantId },
          { name: "productId", value: productId },
          { name: "size", value: selectedSize },
          { name: "color", value: selectedColor },
          { name: "stock", value: selectedStock },
        ]}
        confirmMessage="A je i sigurt qe don ta fshish kete variant?"
        buttonLabel="Fshi"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M3 6h18M8 6V4h8v2m-7 4v7m6-7v7M6 6l1 14h10l1-14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ConfirmActionForm>
    </div>
  );

  const renderCustomAttributes = (variant: VariantItem) => {
    const entries = customFields
      .map((field) => ({
        label: field.label,
        value: variant.customAttributes[field.id]?.trim() || "",
      }))
      .filter((entry) => entry.value);

    if (entries.length === 0) {
      return null;
    }

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {entries.map((entry) => (
          <span
            key={`${variant.id}-${entry.label}`}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            <span className="text-slate-500">{entry.label}</span>
            <span className="text-slate-900">{entry.value}</span>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {canManageInventory && selectedIds.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
            />
            Zgjidh te gjitha
          </label>

          <ConfirmActionForm
            action={bulkDeleteAction}
            hiddenFields={[
              { name: "productId", value: productId },
              { name: "variantIds", value: serializedSelectedIds },
              { name: "size", value: selectedSize },
              { name: "color", value: selectedColor },
              { name: "stock", value: selectedStock },
            ]}
            confirmMessage="A je i sigurt qe don t'i fshish variantet e zgjedhura?"
            buttonLabel="Fshi te zgjedhurat"
            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:hidden">
        {variants.map((variant) => (
          (() => {
            const stockTone = getStockTone(variant.stock);

            return (
          <article
            key={variant.id}
            className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {canManageInventory ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(variant.id)}
                    onChange={() => toggleOne(variant.id)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                  />
                ) : null}
                <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  {variant.imagePath ? (
                    <a
                      href={variant.imagePath}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-full w-full"
                    >
                      <UploadedImage
                        src={variant.imagePath}
                        alt={`${productName} ${variant.color}`}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ) : null}
                </div>
                <span className="inline-flex min-w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-900">
                  {variant.size}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${getColorDotClassName(variant.color)}`}
                    />
                    <p className="font-medium text-slate-900">{variant.color}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Variant #{variant.id}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex min-w-16 items-center justify-center rounded-xl px-3 py-2 font-semibold ${stockTone.badgeClassName}`}
                >
                  {variant.stock}
                </span>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {stockTone.label}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <span className="font-medium text-slate-600">Cmimi</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {variant.price.toFixed(2)} EUR
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  SKU
                </p>
                <p className="mt-1 break-all font-medium text-slate-900">
                  {variant.sku || "-"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Barcode
                </p>
                <p className="mt-1 break-all font-medium text-slate-900">
                  {variant.barcode || "-"}
                </p>
              </div>
              {variant.material ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Materiali
                  </p>
                  <p className="mt-1 break-all font-medium text-slate-900">
                    {variant.material}
                  </p>
                </div>
              ) : null}
              {variant.powerWatts ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Fuqia
                  </p>
                  <p className="mt-1 break-all font-medium text-slate-900">
                    {variant.powerWatts}
                  </p>
                </div>
              ) : null}
              {renderCustomAttributes(variant)}
            </div>

            {canManageInventory ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href={`/products/${productId}/variants/${variant.id}/edit`}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Edito
                </Link>
                <ConfirmActionForm
                  action={deleteVariantAction}
                  hiddenFields={[
                    { name: "variantId", value: variant.id },
                    { name: "productId", value: productId },
                    { name: "size", value: selectedSize },
                    { name: "color", value: selectedColor },
                    { name: "stock", value: selectedStock },
                  ]}
                  confirmMessage="A je i sigurt qe don ta fshish kete variant?"
                  buttonLabel="Fshi"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-100"
                />
              </div>
            ) : null}
          </article>
            );
          })()
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:block">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Detajet e Varianteve
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              title="Filtro variantet"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              title="Shkarko listen"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  d="M12 4v10m0 0 4-4m-4 4-4-4M4 20h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {canManageInventory ? (
                  <th className="w-12 px-5 py-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                    />
                  </th>
                ) : null}
                <th className="px-5 py-4">Photo</th>
                <th className="px-5 py-4">Numri</th>
                <th className="px-5 py-4">Ngjyra</th>
                <th className="px-5 py-4">Atribute</th>
                <th className="px-5 py-4">Kodi</th>
                <th className="px-5 py-4 text-center">Stoku</th>
                <th className="px-5 py-4 text-right">Cmimi</th>
                {canManageInventory ? (
                  <th className="px-5 py-4 text-right">Veprime</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {variants.map((variant) => {
                const stockTone = getStockTone(variant.stock);

                return (
                <tr
                  key={variant.id}
                  className="transition hover:bg-slate-50/80"
                >
                  {canManageInventory ? (
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(variant.id)}
                        onChange={() => toggleOne(variant.id)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                      />
                    </td>
                  ) : null}
                  <td className="px-5 py-4">
                    <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      {variant.imagePath ? (
                        <a
                          href={variant.imagePath}
                          target="_blank"
                          rel="noreferrer"
                          className="block h-full w-full"
                          title="Hape foton"
                        >
                          <UploadedImage
                            src={variant.imagePath}
                            alt={`${productName} ${variant.color}`}
                            className="h-full w-full object-cover transition hover:scale-105"
                          />
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-semibold text-slate-900">
                      {variant.size}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${getColorDotClassName(variant.color)}`}
                      />
                      <span className="font-medium text-slate-800">
                        {variant.color}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <div className="space-y-1">
                      <p>{variant.material || variant.powerWatts || "-"}</p>
                      {customFields.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {customFields
                            .map((field) => ({
                              label: field.label,
                              value: variant.customAttributes[field.id]?.trim() || "",
                            }))
                            .filter((entry) => entry.value)
                            .map((entry) => (
                              <span
                                key={`${variant.id}-${entry.label}`}
                                className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                              >
                                {entry.label}: {entry.value}
                              </span>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="break-all text-xs font-medium tracking-[0.08em] text-slate-500">
                      {variant.sku || variant.barcode || "-"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`inline-flex min-w-16 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${stockTone.badgeClassName}`}
                    >
                      {variant.stock} {stockTone.label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="font-semibold tabular-nums text-slate-900">
                      EUR {variant.price.toFixed(2)}
                    </span>
                  </td>
                  {canManageInventory ? (
                    <td className="px-5 py-4 text-right">
                      {renderActionIcons(variant.id)}
                    </td>
                  ) : null}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-5 py-4">
          <p className="text-sm text-slate-600">
            Duke treguar <span className="font-semibold text-slate-950">1</span>{" "}
            deri <span className="font-semibold text-slate-950">{variants.length}</span>{" "}
            nga <span className="font-semibold text-slate-950">{variants.length}</span>{" "}
            variante
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Para
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Pas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
