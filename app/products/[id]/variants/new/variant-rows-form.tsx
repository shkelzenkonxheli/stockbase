"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ImageFileInput } from "@/app/components/image-file-input";
import type { CategoryConfig, CustomVariantField } from "@/lib/product-taxonomy";

type VariantRow = {
  id: string;
  imageFieldName: string;
  size: string;
  color: string;
  material: string;
  powerWatts: string;
  sku: string;
  barcode: string;
  imagePath: string;
  stock: string;
  price: string;
  customAttributes: Record<string, string>;
};

type FootwearSizeRow = {
  id: string;
  size: string;
  stock: string;
  price: string;
  customAttributes: Record<string, string>;
};

type FootwearColorGroup = {
  id: string;
  color: string;
  imageFieldName: string;
  imagePath: string;
  sizes: FootwearSizeRow[];
};

type VariantRowsFormProps = {
  productId: number;
  productName: string;
  productBrand: string;
  categoryConfig?: CategoryConfig;
  action: (formData: FormData) => void | Promise<void>;
};

const createId = () => crypto.randomUUID();

const createEmptyRow = (): VariantRow => {
  const id = createId();

  return {
    id,
    imageFieldName: `variant-image-${id}`,
    size: "",
    color: "",
    material: "",
    powerWatts: "",
    sku: "",
    barcode: "",
    imagePath: "",
    stock: "",
    price: "",
    customAttributes: {},
  };
};

const createFootwearSizeRow = (): FootwearSizeRow => ({
  id: createId(),
  size: "",
  stock: "",
  price: "",
  customAttributes: {},
});

const createFootwearColorGroup = (): FootwearColorGroup => {
  const id = createId();
  return {
    id,
    color: "",
    imageFieldName: `variant-image-${id}`,
    imagePath: "",
    sizes: [createFootwearSizeRow()],
  };
};

const incrementNumericValue = (value: string) => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return value;
  return String(Number(trimmed) + 1);
};

const getColorDotClass = (color: string) => {
  const normalized = color.trim().toLowerCase();

  if (normalized.includes("zez")) return "bg-slate-900";
  if (normalized.includes("bardh") || normalized.includes("white")) {
    return "border border-slate-300 bg-white";
  }
  if (normalized.includes("kuq") || normalized.includes("red")) return "bg-red-500";
  if (normalized.includes("blu") || normalized.includes("blue")) return "bg-blue-500";
  if (normalized.includes("gjelb") || normalized.includes("green")) return "bg-emerald-600";
  if (normalized.includes("verdh") || normalized.includes("yellow")) return "bg-amber-400";
  if (normalized.includes("roz") || normalized.includes("pink")) return "bg-rose-400";
  if (normalized.includes("vjollc") || normalized.includes("purple")) return "bg-violet-500";
  if (normalized.includes("portok") || normalized.includes("orange")) return "bg-orange-500";
  if (normalized.includes("kafe") || normalized.includes("brown")) return "bg-amber-700";
  if (normalized.includes("gri") || normalized.includes("gray") || normalized.includes("grey")) {
    return "bg-slate-400";
  }

  return "bg-slate-300";
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </span>
  );
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 ${
        props.className ?? ""
      }`}
    />
  );
}

function FieldSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 ${
        props.className ?? ""
      }`}
    />
  );
}

export function VariantRowsForm({
  productId,
  productName,
  productBrand,
  categoryConfig,
  action,
}: VariantRowsFormProps) {
  const [rows, setRows] = useState<VariantRow[]>([createEmptyRow()]);
  const [colorGroups, setColorGroups] = useState<FootwearColorGroup[]>([createFootwearColorGroup()]);

  const sharedImageByColor = categoryConfig?.sharedVariantImageByColor ?? false;
  const showMaterialField = categoryConfig?.showMaterialField ?? true;
  const showPowerField = categoryConfig?.showPowerField ?? true;
  const sizeFieldType = categoryConfig?.sizeInputType ?? "text";
  const colorFieldType = categoryConfig?.colorInputType ?? "text";
  const materialFieldType = categoryConfig?.materialInputType ?? "text";
  const powerFieldType = categoryConfig?.powerInputType ?? "text";
  const sizeOptions = categoryConfig?.sizeOptions ?? [];
  const colorOptions = categoryConfig?.colorOptions ?? [];
  const materialOptions = categoryConfig?.materialOptions ?? [];
  const powerOptions = categoryConfig?.powerOptions ?? [];
  const customFields = useMemo(
    () => (categoryConfig?.customVariantFields ?? []).filter((field) => field.enabled),
    [categoryConfig?.customVariantFields],
  );

  const updateRow = (
    rowId: string,
    field: keyof Omit<VariantRow, "id" | "imageFieldName">,
    value: string,
  ) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
    );
  };

  const updateCustomRowField = (rowId: string, fieldId: string, value: string) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              customAttributes: {
                ...row.customAttributes,
                [fieldId]: value,
              },
            }
          : row,
      ),
    );
  };

  const addRow = () => {
    setRows((currentRows) => {
      const lastRow = currentRows[currentRows.length - 1];
      if (!lastRow) return [createEmptyRow()];

      const id = createId();
      return [
        ...currentRows,
        {
          ...lastRow,
          id,
          imageFieldName: `variant-image-${id}`,
          size: incrementNumericValue(lastRow.size),
          imagePath: "",
          customAttributes: { ...lastRow.customAttributes },
        },
      ];
    });
  };

  const removeRow = (rowId: string) => {
    setRows((currentRows) => {
      if (currentRows.length === 1) return currentRows;
      return currentRows.filter((row) => row.id !== rowId);
    });
  };

  const updateColorGroup = (
    groupId: string,
    field: keyof Pick<FootwearColorGroup, "color" | "imagePath">,
    value: string,
  ) => {
    setColorGroups((current) =>
      current.map((group) => (group.id === groupId ? { ...group, [field]: value } : group)),
    );
  };

  const updateGroupSizeRow = (
    groupId: string,
    sizeRowId: string,
    field: keyof Omit<FootwearSizeRow, "id">,
    value: string,
  ) => {
    setColorGroups((current) =>
      current.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              sizes: group.sizes.map((row) => (row.id === sizeRowId ? { ...row, [field]: value } : row)),
            },
      ),
    );
  };

  const updateGroupCustomField = (
    groupId: string,
    sizeRowId: string,
    fieldId: string,
    value: string,
  ) => {
    setColorGroups((current) =>
      current.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              sizes: group.sizes.map((row) =>
                row.id === sizeRowId
                  ? {
                      ...row,
                      customAttributes: {
                        ...row.customAttributes,
                        [fieldId]: value,
                      },
                    }
                  : row,
              ),
            },
      ),
    );
  };

  const addColorGroup = () => {
    setColorGroups((current) => [...current, createFootwearColorGroup()]);
  };

  const removeColorGroup = (groupId: string) => {
    setColorGroups((current) => (current.length === 1 ? current : current.filter((group) => group.id !== groupId)));
  };

  const addSizeRowToGroup = (groupId: string) => {
    setColorGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) return group;
        const lastSizeRow = group.sizes[group.sizes.length - 1];
        const nextSizeRow = createFootwearSizeRow();
        if (lastSizeRow) {
          nextSizeRow.size = incrementNumericValue(lastSizeRow.size);
          nextSizeRow.stock = lastSizeRow.stock;
          nextSizeRow.price = lastSizeRow.price;
          nextSizeRow.customAttributes = { ...lastSizeRow.customAttributes };
        }
        return {
          ...group,
          sizes: [...group.sizes, nextSizeRow],
        };
      }),
    );
  };

  const removeSizeRowFromGroup = (groupId: string, sizeRowId: string) => {
    setColorGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId || group.sizes.length === 1) return group;
        return {
          ...group,
          sizes: group.sizes.filter((row) => row.id !== sizeRowId),
        };
      }),
    );
  };

  const serializedRows = JSON.stringify(
    sharedImageByColor
      ? colorGroups.flatMap((group) =>
          group.sizes.map((sizeRow) => ({
            imageFieldName: group.imageFieldName,
            size: sizeRow.size,
            color: group.color,
            material: "",
            powerWatts: "",
            sku: "",
            barcode: "",
            imagePath: group.imagePath,
            stock: sizeRow.stock,
            price: sizeRow.price,
            customAttributes: sizeRow.customAttributes,
          })),
        )
      : rows.map(
          ({
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
          }) => ({
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
          }),
        ),
  );

  const validRows = useMemo(() => {
    if (sharedImageByColor) {
      return colorGroups.flatMap((group) =>
        group.sizes.filter(
          (row) => group.color.trim() && row.size.trim() && row.stock.trim() && row.price.trim(),
        ),
      );
    }

    return rows.filter(
      (row) => row.size.trim() && row.color.trim() && row.stock.trim() && row.price.trim(),
    );
  }, [colorGroups, rows, sharedImageByColor]);

  const totalRows = sharedImageByColor
    ? colorGroups.reduce((sum, group) => sum + group.sizes.length, 0)
    : rows.length;
  const totalNewStock = validRows.reduce((sum, row) => sum + (Number(row.stock) || 0), 0);
  const totalInventoryValue = validRows.reduce(
    (sum, row) => sum + (Number(row.stock) || 0) * (Number(row.price) || 0),
    0,
  );
  const isReadyToSave = validRows.length > 0 && validRows.length === totalRows;

  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rows" value={serializedRows} />

      <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 text-sm text-slate-600">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
            Produkti #{productId}
          </span>
          <span className="font-medium text-slate-950">{productName}</span>
          <span className="text-slate-400">/</span>
          <span>{productBrand}</span>
        </div>

        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xl font-semibold text-slate-950">Variantet</p>
            <p className="mt-1 text-sm text-slate-500">
              {categoryConfig?.variantHelper ?? "Ploteso atributet e varianteve."}
            </p>
          </div>

          <button
            type="button"
            onClick={sharedImageByColor ? addColorGroup : addRow}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="text-base">+</span>
            {sharedImageByColor ? "Shto ngjyre" : "Shto variant"}
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {sharedImageByColor
            ? colorGroups.map((group, groupIndex) => (
                <article key={group.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                        {groupIndex + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Ngjyra {groupIndex + 1}</p>
                        <p className="text-xs text-slate-500">
                          Nje foto per kete ngjyre, pastaj numrat me stok dhe cmim.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeColorGroup(group.id)}
                      disabled={colorGroups.length === 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Hiq ngjyren ${groupIndex + 1}`}
                    >
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <path
                          d="M5.75 6.5h8.5M8 6.5V5.25A1.25 1.25 0 0 1 9.25 4h1.5A1.25 1.25 0 0 1 12 5.25V6.5M7 8.25v5.25M10 8.25v5.25M13 8.25v5.25M6.5 6.5 7 15a1 1 0 0 0 1 .94h4a1 1 0 0 0 1-.94l.5-8.5"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[156px_minmax(0,1fr)] xl:items-start">
                    <ImageFileInput
                      id={group.imageFieldName}
                      name={group.imageFieldName}
                      label="Fotoja e ngjyres"
                      helperText="Nje foto per te gjithe numrat e kesaj ngjyre."
                      className="h-fit border-slate-200 bg-white p-2.5"
                      previewClassName="h-20 w-20 rounded-xl object-cover"
                      clearButtonLabel="Hiqe"
                      layout="compact"
                    />

                    <div className="space-y-4">
                      <label className="space-y-2">
                        <FieldLabel>{categoryConfig?.colorLabel ?? "Ngjyra"}</FieldLabel>
                        {colorFieldType === "select" ? (
                          <FieldSelect
                            value={group.color}
                            onChange={(event) => updateColorGroup(group.id, "color", event.target.value)}
                          >
                            <option value="">Zgjidh...</option>
                            {colorOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </FieldSelect>
                        ) : (
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <span className={`h-3 w-3 shrink-0 rounded-full ${getColorDotClass(group.color)}`} />
                            <input
                              type="text"
                              value={group.color}
                              onChange={(event) => updateColorGroup(group.id, "color", event.target.value)}
                              placeholder={categoryConfig?.colorPlaceholder ?? "Black"}
                              className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                            />
                          </div>
                        )}
                      </label>

                      <div className="space-y-3">
                        {group.sizes.map((sizeRow, sizeIndex) => (
                          <div
                            key={sizeRow.id}
                            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
                          >
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_140px_44px]">
                            <label className="space-y-2">
                              <FieldLabel>{categoryConfig?.sizeLabel ?? "Numri"}</FieldLabel>
                              {sizeFieldType === "select" ? (
                                <FieldSelect
                                  value={sizeRow.size}
                                  onChange={(event) =>
                                    updateGroupSizeRow(group.id, sizeRow.id, "size", event.target.value)
                                  }
                                >
                                  <option value="">Zgjidh...</option>
                                  {sizeOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </FieldSelect>
                              ) : (
                                <FieldInput
                                  type={sizeFieldType === "number" ? "number" : "text"}
                                  value={sizeRow.size}
                                  onChange={(event) =>
                                    updateGroupSizeRow(group.id, sizeRow.id, "size", event.target.value)
                                  }
                                  placeholder={categoryConfig?.sizePlaceholder ?? "42"}
                                />
                              )}
                            </label>

                            <label className="space-y-2">
                              <FieldLabel>Stoku</FieldLabel>
                              <FieldInput
                                type="number"
                                min="0"
                                value={sizeRow.stock}
                                onChange={(event) =>
                                  updateGroupSizeRow(group.id, sizeRow.id, "stock", event.target.value)
                                }
                                placeholder="0"
                              />
                            </label>

                            <label className="space-y-2">
                              <FieldLabel>Cmimi</FieldLabel>
                              <FieldInput
                                type="number"
                                min="0"
                                step="0.01"
                                value={sizeRow.price}
                                onChange={(event) =>
                                  updateGroupSizeRow(group.id, sizeRow.id, "price", event.target.value)
                                }
                                placeholder="0.00"
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => removeSizeRowFromGroup(group.id, sizeRow.id)}
                              disabled={group.sizes.length === 1}
                              className="mt-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Hiq numrin ${sizeIndex + 1}`}
                            >
                              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                                <path
                                  d="M5.75 6.5h8.5M8 6.5V5.25A1.25 1.25 0 0 1 9.25 4h1.5A1.25 1.25 0 0 1 12 5.25V6.5M7 8.25v5.25M10 8.25v5.25M13 8.25v5.25M6.5 6.5 7 15a1 1 0 0 0 1 .94h4a1 1 0 0 0 1-.94l.5-8.5"
                                  stroke="currentColor"
                                  strokeWidth="1.7"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            </div>

                            {customFields.length > 0 ? (
                              <div className="grid gap-3 md:grid-cols-2">
                                {customFields.map((field) => (
                                  <label key={`${sizeRow.id}-${field.id}`} className="space-y-2">
                                    <FieldLabel>{field.label}</FieldLabel>
                                    <FieldInput
                                      type={field.type === "number" ? "number" : "text"}
                                      value={sizeRow.customAttributes[field.id] ?? ""}
                                      onChange={(event) =>
                                        updateGroupCustomField(
                                          group.id,
                                          sizeRow.id,
                                          field.id,
                                          event.target.value,
                                        )
                                      }
                                      placeholder={field.label}
                                    />
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => addSizeRowToGroup(group.id)}
                        className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                      >
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                          <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        Shto numer
                      </button>
                    </div>
                  </div>
                </article>
              ))
            : rows.map((row, index) => (
                <article key={row.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Varianti {index + 1}</p>
                        <p className="text-xs text-slate-500">Ploteso te dhenat kryesore te variantit.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Hiq variantin ${index + 1}`}
                    >
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <path
                          d="M5.75 6.5h8.5M8 6.5V5.25A1.25 1.25 0 0 1 9.25 4h1.5A1.25 1.25 0 0 1 12 5.25V6.5M7 8.25v5.25M10 8.25v5.25M13 8.25v5.25M6.5 6.5 7 15a1 1 0 0 0 1 .94h4a1 1 0 0 0 1-.94l.5-8.5"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[156px_minmax(0,1fr)] xl:items-start">
                    <ImageFileInput
                      id={row.imageFieldName}
                      name={row.imageFieldName}
                      label="Fotoja e variantit"
                      helperText="Foto per kete variant."
                      className="h-fit border-slate-200 bg-white p-2.5"
                      previewClassName="h-20 w-20 rounded-xl object-cover"
                      clearButtonLabel="Hiqe"
                      layout="compact"
                    />

                    <div
                      className={`grid gap-4 md:grid-cols-2 ${
                        showMaterialField || showPowerField ? "xl:grid-cols-3" : "xl:grid-cols-2"
                      }`}
                    >
                      <label className="space-y-2">
                        <FieldLabel>{categoryConfig?.colorLabel ?? "Ngjyra"}</FieldLabel>
                        {colorFieldType === "select" ? (
                          <FieldSelect value={row.color} onChange={(event) => updateRow(row.id, "color", event.target.value)}>
                            <option value="">Zgjidh...</option>
                            {colorOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </FieldSelect>
                        ) : (
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <span className={`h-3 w-3 shrink-0 rounded-full ${getColorDotClass(row.color)}`} />
                            <input
                              type="text"
                              value={row.color}
                              onChange={(event) => updateRow(row.id, "color", event.target.value)}
                              placeholder={categoryConfig?.colorPlaceholder ?? "E bardhe"}
                              className="w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                            />
                          </div>
                        )}
                      </label>

                      <label className="space-y-2">
                        <FieldLabel>{categoryConfig?.sizeLabel ?? "Madhesia"}</FieldLabel>
                        {sizeFieldType === "select" ? (
                          <FieldSelect value={row.size} onChange={(event) => updateRow(row.id, "size", event.target.value)}>
                            <option value="">Zgjidh...</option>
                            {sizeOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </FieldSelect>
                        ) : (
                          <FieldInput
                            type={sizeFieldType === "number" ? "number" : "text"}
                            value={row.size}
                            onChange={(event) => updateRow(row.id, "size", event.target.value)}
                            placeholder={categoryConfig?.sizePlaceholder ?? "50x70 cm"}
                          />
                        )}
                      </label>

                      {showMaterialField ? (
                        <label className="space-y-2">
                          <FieldLabel>{categoryConfig?.materialLabel ?? "Materiali"}</FieldLabel>
                          {materialFieldType === "select" ? (
                            <FieldSelect value={row.material} onChange={(event) => updateRow(row.id, "material", event.target.value)}>
                              <option value="">Zgjidh...</option>
                              {materialOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </FieldSelect>
                          ) : (
                            <FieldInput
                              type={materialFieldType === "number" ? "number" : "text"}
                              value={row.material}
                              onChange={(event) => updateRow(row.id, "material", event.target.value)}
                              placeholder={categoryConfig?.materialPlaceholder ?? "Pambuk"}
                            />
                          )}
                        </label>
                      ) : null}

                      {showPowerField ? (
                        <label className="space-y-2">
                          <FieldLabel>{categoryConfig?.powerLabel ?? "Fuqia"}</FieldLabel>
                          {powerFieldType === "select" ? (
                            <FieldSelect value={row.powerWatts} onChange={(event) => updateRow(row.id, "powerWatts", event.target.value)}>
                              <option value="">Zgjidh...</option>
                              {powerOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </FieldSelect>
                          ) : (
                            <FieldInput
                              type={powerFieldType === "number" ? "number" : "text"}
                              value={row.powerWatts}
                              onChange={(event) => updateRow(row.id, "powerWatts", event.target.value)}
                              placeholder={categoryConfig?.powerPlaceholder ?? "800W"}
                            />
                          )}
                        </label>
                      ) : null}

                      <label className="space-y-2">
                        <FieldLabel>Stoku</FieldLabel>
                        <FieldInput type="number" min="0" value={row.stock} onChange={(event) => updateRow(row.id, "stock", event.target.value)} placeholder="0" />
                      </label>

                      <label className="space-y-2">
                        <FieldLabel>Cmimi (EUR)</FieldLabel>
                        <FieldInput type="number" min="0" step="0.01" value={row.price} onChange={(event) => updateRow(row.id, "price", event.target.value)} placeholder="0.00" />
                      </label>

                      {customFields.length > 0 ? (
                        <div className="md:col-span-2 xl:col-span-3">
                          <div className="grid gap-4 md:grid-cols-2">
                            {customFields.map((field) => (
                              <label key={`${row.id}-${field.id}`} className="space-y-2">
                                <FieldLabel>{field.label}</FieldLabel>
                                <FieldInput
                                  type={field.type === "number" ? "number" : "text"}
                                  value={row.customAttributes[field.id] ?? ""}
                                  onChange={(event) =>
                                    updateCustomRowField(row.id, field.id, event.target.value)
                                  }
                                  placeholder={field.label}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={sharedImageByColor ? addColorGroup : addRow}
            className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {sharedImageByColor ? "Shto ngjyre" : "Shto edhe nje"}
          </button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/products/${productId}`}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
            >
              Anulo
            </Link>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path
                  d="M5.75 10.25 8.5 13l5.75-5.75"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Ruaj variantet
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {sharedImageByColor ? "Ngjyra ne forme" : "Variante ne forme"}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {sharedImageByColor ? colorGroups.length : rows.length}
          </p>
        </div>
        <div className="rounded-[20px] border border-emerald-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Stoku i ri
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{totalNewStock}</p>
        </div>
        <div className="rounded-[20px] border border-blue-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Vlera e inventarit
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {totalInventoryValue.toFixed(2)} EUR
          </p>
          <div className="mt-3">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
                isReadyToSave ? "bg-emerald-900 text-emerald-50" : "bg-amber-100 text-amber-800"
              }`}
            >
              {isReadyToSave ? "Gati per ruajtje" : "Ne plotesim"}
            </span>
          </div>
        </div>
      </div>
    </form>
  );
}
