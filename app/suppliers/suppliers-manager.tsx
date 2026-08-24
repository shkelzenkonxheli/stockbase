"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ConfirmActionForm } from "@/app/components/confirm-action-form";

type SupplierItem = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  totalOrders: number;
  totalValue: string;
  totalReceivedValue: number;
  totalReturnedValue: number;
  openOrders: number;
  averageOrderValue: number;
  lastOrderLabel: string | null;
  recentOrders: Array<{
    id: number;
    status: string;
    orderedAtLabel: string;
    totalLabel: string;
    itemCount: number;
  }>;
};

type SuppliersManagerProps = {
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  toggleAction: (formData: FormData) => void | Promise<void>;
  suppliers: SupplierItem[];
  addOpen: boolean;
  editingId: number | null;
  message?: {
    type: "error" | "success";
    text: string;
  } | null;
};

function statusClasses(isActive: boolean) {
  return isActive
    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border border-slate-200 bg-slate-100 text-slate-600";
}

function orderStatusClasses(status: string) {
  switch (status) {
    case "ORDERED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "PARTIALLY_RECEIVED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "RECEIVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PARTIALLY_RETURNED":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
    case "RETURNED":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "CANCELED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function orderStatusLabel(status: string) {
  switch (status) {
    case "ORDERED":
      return "Ordered";
    case "PARTIALLY_RECEIVED":
      return "Partial";
    case "RECEIVED":
      return "Received";
    case "PARTIALLY_RETURNED":
      return "Supplier return";
    case "RETURNED":
      return "Returned";
    case "CANCELED":
      return "Canceled";
    default:
      return "Draft";
  }
}

function formatMoney(value: number) {
  return `${value.toFixed(2)} EUR`;
}

export function SuppliersManager({
  createAction,
  updateAction,
  toggleAction,
  suppliers,
  addOpen,
  editingId,
  message,
}: SuppliersManagerProps) {
  const addDialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  const editingSupplier = useMemo(
    () => (editingId ? suppliers.find((supplier) => supplier.id === editingId) ?? null : null),
    [editingId, suppliers],
  );

  useEffect(() => {
    const dialog = addDialogRef.current;
    if (!dialog) {
      return;
    }

    if (addOpen && !dialog.open) {
      dialog.showModal();
    }

    if (!addOpen && dialog.open) {
      dialog.close();
    }
  }, [addOpen]);

  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) {
      return;
    }

    if (editingSupplier && !dialog.open) {
      dialog.showModal();
    }

    if (!editingSupplier && dialog.open) {
      dialog.close();
    }
  }, [editingSupplier]);

  const closeAddModal = () => {
    addDialogRef.current?.close();
    router.replace("/suppliers");
  };

  const closeEditModal = () => {
    editDialogRef.current?.close();
    router.replace("/suppliers");
  };

  return (
    <>
      <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-emerald-100 bg-[linear-gradient(180deg,#fcfffd_0%,#f3fbf6_100%)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Lista e furnitoreve</h2>
            <p className="mt-1 text-sm text-slate-500">
              Menaxho kontaktet dhe aktivizo ose caktivizo furnitoret nga kjo liste.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.replace("/suppliers?add=1")}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            + Shto furnitor
          </button>
        </div>

        {suppliers.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            Ende nuk ka furnitore te regjistruar.
          </div>
        ) : (
          <>
            <div className="grid gap-4 p-4 lg:hidden">
              {suppliers.map((supplier) => (
                <article
                  key={supplier.id}
                  className="rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#fbfefc_100%)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-950">
                        {supplier.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {supplier.phone || supplier.email || "Pa kontakt"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                          {supplier.totalOrders} PO
                        </span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
                          {supplier.openOrders} open
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                          {supplier.totalValue}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(supplier.isActive)}`}
                    >
                      {supplier.isActive ? "Aktiv" : "Joaktiv"}
                    </span>
                  </div>

                  {supplier.address ? (
                    <p className="mt-3 text-sm text-slate-600">{supplier.address}</p>
                  ) : null}

                  {supplier.notes ? (
                    <p className="mt-2 text-sm text-slate-500">{supplier.notes}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => router.replace(`/suppliers?edit=${supplier.id}`)}
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      Edito
                    </button>
                    <ConfirmActionForm
                      action={toggleAction}
                      hiddenFields={[
                        { name: "supplierId", value: supplier.id },
                        { name: "nextActive", value: supplier.isActive ? "false" : "true" },
                      ]}
                      confirmMessage={`A je i sigurt qe don ta ${supplier.isActive ? "caktivizosh" : "aktivizosh"} kete furnitor?`}
                      buttonLabel={supplier.isActive ? "Caktivizo" : "Aktivizo"}
                      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        supplier.isActive
                          ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    />
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-[linear-gradient(180deg,#f6fdf8_0%,#eef8f1_100%)] text-left">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                    <th className="px-5 py-4">Furnitori</th>
                    <th className="px-5 py-4">Kontakti</th>
                    <th className="px-5 py-4">Purchase orders</th>
                    <th className="px-5 py-4">Historia</th>
                    <th className="px-5 py-4">Adresa</th>
                    <th className="px-5 py-4">Statusi</th>
                    <th className="px-5 py-4 text-right">Veprime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50 bg-white">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="transition hover:bg-emerald-50/45">
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-slate-950">{supplier.name}</p>
                        {supplier.notes ? (
                          <p className="mt-1 max-w-[260px] text-xs text-slate-500">
                            {supplier.notes}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 align-top text-slate-600">
                        <div className="space-y-1">
                          <p>{supplier.phone || "-"}</p>
                          <p>{supplier.email || "-"}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top text-slate-600">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{supplier.totalOrders} PO</p>
                          <p>{supplier.totalValue}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top text-slate-600">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{supplier.openOrders} open</p>
                          <p>{supplier.lastOrderLabel ?? "Pa porosi"}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top text-slate-600">
                        <span className="block max-w-[220px] truncate" title={supplier.address ?? "-"}>
                          {supplier.address || "-"}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(supplier.isActive)}`}
                        >
                          {supplier.isActive ? "Aktiv" : "Joaktiv"}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => router.replace(`/suppliers?edit=${supplier.id}`)}
                            className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                          >
                            Edito
                          </button>
                          <ConfirmActionForm
                            action={toggleAction}
                            hiddenFields={[
                              { name: "supplierId", value: supplier.id },
                              { name: "nextActive", value: supplier.isActive ? "false" : "true" },
                            ]}
                            confirmMessage={`A je i sigurt qe don ta ${supplier.isActive ? "caktivizosh" : "aktivizosh"} kete furnitor?`}
                            buttonLabel={supplier.isActive ? "Caktivizo" : "Aktivizo"}
                            className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                              supplier.isActive
                                ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <dialog
        ref={addDialogRef}
        className="m-auto w-[min(620px,calc(100%-1.5rem))] rounded-[28px] border border-slate-200 bg-white p-0 text-left shadow-[0_28px_90px_rgba(15,23,42,0.24)] backdrop:bg-slate-950/45"
        onClose={() => router.replace("/suppliers")}
      >
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Supplier Setup
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Shto furnitor
              </h2>
            </div>

            <button
              type="button"
              onClick={closeAddModal}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Mbyll
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          {addOpen && message ? (
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                message.type === "error"
                  ? "border border-rose-200 bg-rose-50 text-rose-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <form action={createAction} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="supplier-name" className="block text-sm font-medium text-slate-800">
                Emri
              </label>
              <input
                id="supplier-name"
                name="name"
                type="text"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="supplier-phone" className="block text-sm font-medium text-slate-800">
                  Telefoni
                </label>
                <input
                  id="supplier-phone"
                  name="phone"
                  type="text"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="supplier-email" className="block text-sm font-medium text-slate-800">
                  Email
                </label>
                <input
                  id="supplier-email"
                  name="email"
                  type="email"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="supplier-address" className="block text-sm font-medium text-slate-800">
                Adresa
              </label>
              <input
                id="supplier-address"
                name="address"
                type="text"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="supplier-notes" className="block text-sm font-medium text-slate-800">
                Shenime
              </label>
              <textarea
                id="supplier-notes"
                name="notes"
                rows={4}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              />
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Shto furnitor
            </button>
          </form>
        </div>
      </dialog>

      <dialog
        ref={editDialogRef}
        className="m-auto w-[min(620px,calc(100%-1.5rem))] rounded-[28px] border border-slate-200 bg-white p-0 text-left shadow-[0_28px_90px_rgba(15,23,42,0.24)] backdrop:bg-slate-950/45"
        onClose={() => router.replace("/suppliers")}
      >
        {editingSupplier ? (
          <>
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Supplier Edit
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Edito furnitorin
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Mbyll
                </button>
              </div>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              {editingSupplier && message ? (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    message.type === "error"
                      ? "border border-rose-200 bg-rose-50 text-rose-700"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {message.text}
                </div>
              ) : null}

              <form action={updateAction} className="space-y-5">
                <input type="hidden" name="supplierId" value={editingSupplier.id} />

                <div className="space-y-2">
                  <label htmlFor="edit-supplier-name" className="block text-sm font-medium text-slate-800">
                    Emri
                  </label>
                  <input
                    id="edit-supplier-name"
                    name="name"
                    type="text"
                    defaultValue={editingSupplier.name}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="edit-supplier-phone" className="block text-sm font-medium text-slate-800">
                      Telefoni
                    </label>
                    <input
                      id="edit-supplier-phone"
                      name="phone"
                      type="text"
                      defaultValue={editingSupplier.phone ?? ""}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="edit-supplier-email" className="block text-sm font-medium text-slate-800">
                      Email
                    </label>
                    <input
                      id="edit-supplier-email"
                      name="email"
                      type="email"
                      defaultValue={editingSupplier.email ?? ""}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="edit-supplier-address" className="block text-sm font-medium text-slate-800">
                    Adresa
                  </label>
                  <input
                    id="edit-supplier-address"
                    name="address"
                    type="text"
                    defaultValue={editingSupplier.address ?? ""}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="edit-supplier-notes" className="block text-sm font-medium text-slate-800">
                    Shenime
                  </label>
                  <textarea
                    id="edit-supplier-notes"
                    name="notes"
                    rows={4}
                    defaultValue={editingSupplier.notes ?? ""}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  />
                </div>

                <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editingSupplier.isActive}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                  />
                  Furnitor aktiv
                </label>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Purchase History
                      </h3>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        {editingSupplier.totalOrders} gjithsej
                      </p>
                      <p className="mt-1 text-sm text-emerald-700">{editingSupplier.totalValue}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push(`/purchases?q=${encodeURIComponent(editingSupplier.name)}`)}
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      Shiko purchases
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Open PO</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">{editingSupplier.openOrders}</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Pranuar</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-700">{formatMoney(editingSupplier.totalReceivedValue)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Kthyer</p>
                      <p className="mt-1 text-lg font-semibold text-fuchsia-700">{formatMoney(editingSupplier.totalReturnedValue)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Mesatarja</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(editingSupplier.averageOrderValue)}</p>
                    </div>
                  </div>

                  {editingSupplier.recentOrders.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {editingSupplier.recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="rounded-2xl border border-white/80 bg-white px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-950">PO #{order.id}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {order.orderedAtLabel} / {order.itemCount} rreshta
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${orderStatusClasses(order.status)}`}
                              >
                                {orderStatusLabel(order.status)}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                                {order.totalLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      Ky furnitor ende nuk ka purchase orders.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Ruaj ndryshimet
                </button>
              </form>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
