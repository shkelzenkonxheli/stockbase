"use client";

import { useMemo, useState } from "react";

type SupplierOption = {
  id: number;
  name: string;
};

type WarehouseOption = {
  id: number;
  name: string;
};

type VariantOption = {
  id: number;
  label: string;
  productId: number;
  productName: string;
  categoryName: string;
  brand: string | null;
};

type PurchaseOrderFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  variants: VariantOption[];
};

type DraftRow = {
  id: string;
  variantId: string;
  quantity: string;
  unitCost: string;
  note: string;
};

function createRow(index: number): DraftRow {
  return {
    id: `row-${Date.now()}-${index}`,
    variantId: "",
    quantity: "1",
    unitCost: "0",
    note: "",
  };
}

export function PurchaseOrderForm({
  action,
  suppliers,
  warehouses,
  variants,
}: PurchaseOrderFormProps) {
  const [rows, setRows] = useState<DraftRow[]>([createRow(1)]);
  const [status, setStatus] = useState<"DRAFT" | "ORDERED">("ORDERED");
  const [search, setSearch] = useState("");

  const filteredVariants = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) {
      return variants;
    }

    return variants.filter((variant) =>
      [
        variant.productName,
        variant.label,
        variant.categoryName,
        variant.brand ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [search, variants]);

  const payload = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({
          variantId: Number(row.variantId),
          quantity: Number(row.quantity),
          unitCost: Number(row.unitCost),
          note: row.note.trim(),
        })),
      ),
    [rows],
  );

  function updateRow(id: string, field: keyof DraftRow, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
    setRows((current) => [...current, createRow(current.length + 1)]);
  }

  function removeRow(id: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  return (
    <form
      action={action}
      className="rounded-[30px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#fbfefc_100%)] px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6"
    >
      <input type="hidden" name="items" value={payload} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Purchase order i ri</h2>
          <p className="mt-1 text-sm text-slate-500">
            Zgjedh furnitorin, depon dhe variantet qe po porosit.
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
        >
          + Shto rresht
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Furnitori
          <select
            name="supplierId"
            required
            className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="">Zgjedh furnitorin</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Depoja
          <select
            name="warehouseId"
            required
            className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="">Zgjedh depon</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Statusi
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as "DRAFT" | "ORDERED")}
            className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="ORDERED">Ordered</option>
            <option value="DRAFT">Draft</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Data e porosise
          <input
            type="date"
            name="orderedAt"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
          />
        </label>
      </div>

      <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
        Shenime
        <textarea
          name="note"
          rows={3}
          className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
        />
      </label>

      <div className="mt-5 rounded-[26px] border border-emerald-100 bg-emerald-50/60 p-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Kerko variantin
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Produkt, kategori, variant..."
            className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
          />
        </label>
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="rounded-[26px] border border-emerald-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Rreshti {index + 1}</p>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Largo
              </button>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_120px_140px]">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Varianti
                <select
                  value={row.variantId}
                  onChange={(event) => updateRow(row.id, "variantId", event.target.value)}
                  className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="">Zgjedh variantin</option>
                  {filteredVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.productName} - {variant.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Sasia
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={row.quantity}
                  onChange={(event) => updateRow(row.id, "quantity", event.target.value)}
                  className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Kosto / njesi
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.unitCost}
                  onChange={(event) => updateRow(row.id, "unitCost", event.target.value)}
                  className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            </div>

            <label className="mt-4 grid gap-2 text-sm font-medium text-slate-700">
              Shenim per rreshtin
              <input
                type="text"
                value={row.note}
                onChange={(event) => updateRow(row.id, "note", event.target.value)}
                className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
          </div>
        ))}
      </div>

      <button
        type="submit"
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Ruaj purchase order
      </button>
    </form>
  );
}
