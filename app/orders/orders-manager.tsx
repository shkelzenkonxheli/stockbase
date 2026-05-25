"use client";

import { useMemo, useState } from "react";
import { ConfirmActionForm } from "@/app/components/confirm-action-form";
import { UploadedImage } from "@/app/components/uploaded-image";
import { getOrderVariantSummary } from "@/lib/order-variant-display";
import type { OrderListViewConfig } from "@/lib/product-taxonomy";
import { OrderDetailsModal } from "./order-details-modal";

type OrderStatusValue = "NEW" | "READY" | "DONE" | "CANCELED";
type OrderSourceValue = "INSTAGRAM" | "STORE" | "WHOLESALE";

type OrderItem = {
  id: number;
  name: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  material?: string | null;
  powerWatts?: string | null;
  imagePath?: string | null;
  quantity: number;
};

type OrderSummary = {
  id: number;
  customerName: string;
  phone: string;
  instagram: string | null;
  source: OrderSourceValue;
  notes: string | null;
  status: OrderStatusValue;
  createdAtDateLabel: string;
  createdAtTimeLabel: string;
  itemsCount: number;
  totalQuantity: number;
  deletable: boolean;
  items: OrderItem[];
};

type OrdersManagerProps = {
  orders: OrderSummary[];
  viewConfig: OrderListViewConfig;
  canDeleteOrders: boolean;
  sourceLabels: Record<OrderSourceValue, string>;
  sourceStyles: Record<OrderSourceValue, string>;
  statusStyles: Record<OrderStatusValue, string>;
  deleteOrderAction: (formData: FormData) => void | Promise<void>;
  bulkDeleteOrdersAction: (formData: FormData) => void | Promise<void>;
};

export function OrdersManager({
  orders,
  viewConfig,
  canDeleteOrders,
  sourceLabels,
  sourceStyles,
  statusStyles,
  deleteOrderAction,
  bulkDeleteOrdersAction,
}: OrdersManagerProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const deletableOrderIds = useMemo(
    () => orders.map((order) => order.id),
    [orders],
  );

  const allSelected = useMemo(
    () =>
      deletableOrderIds.length > 0 &&
      selectedIds.length === deletableOrderIds.length,
    [deletableOrderIds, selectedIds.length],
  );

  const serializedSelectedIds = JSON.stringify(selectedIds);
  const orderedDesktopFields = viewConfig.order.filter(
    (field) =>
      !["productImage", "variantSummary"].includes(field) && viewConfig.visibility[field],
  );
  const desktopFieldLabels: Record<string, string> = {
    customerName: "Klienti",
    phone: "Telefoni",
    quantity: "Cope",
    source: "Burimi",
    status: "Statusi",
    date: "Data",
  };

  const toggleOne = (orderId: number) => {
    setSelectedIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : deletableOrderIds);
  };

  const getSourceIcon = (source: OrderSourceValue) => {
    switch (source) {
      case "INSTAGRAM":
        return (
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <rect x="4.25" y="4.25" width="11.5" height="11.5" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="2.75" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="14" cy="6" r="0.9" fill="currentColor" />
          </svg>
        );
      case "STORE":
        return (
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M4 7.25 5.25 4.5h9.5L16 7.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4.25 7.25h11.5v7.5H4.25z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 10.25h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      default:
        return (
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M10 3.25 16 6.5v7L10 16.75 4 13.5v-7l6-3.25Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 3.5v13" stroke="currentColor" strokeWidth="1.5" />
            <path d="m4.25 6.75 5.75 3.25 5.75-3.25" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
    }
  };

  const renderDesktopActions = (order: OrderSummary) => (
    <div className="flex items-center justify-end gap-2">
      <OrderDetailsModal
        orderId={order.id}
        customerName={order.customerName}
        phone={order.phone}
        sourceLabel={sourceLabels[order.source]}
        createdAtDateLabel={order.createdAtDateLabel}
        createdAtTimeLabel={order.createdAtTimeLabel}
        reference={order.instagram}
        notes={order.notes}
        items={order.items}
      />

      {canDeleteOrders ? (
        <ConfirmActionForm
          action={deleteOrderAction}
          hiddenFields={[{ name: "orderId", value: order.id }]}
          confirmMessage="A je i sigurt qe don ta fshish kete porosi? Ky veprim nuk kthehet mbrapa."
          buttonLabel="Fshi"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M5.75 6.5h8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M8 6.5V5.25A1.25 1.25 0 0 1 9.25 4h1.5A1.25 1.25 0 0 1 12 5.25V6.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M7 8.25v5.25M10 8.25v5.25M13 8.25v5.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M6.5 6.5 7 15a1 1 0 0 0 1 .94h4a1 1 0 0 0 1-.94l.5-8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ConfirmActionForm>
      ) : null}
    </div>
  );

  const renderActions = (order: OrderSummary) => (
    <div className="flex flex-wrap justify-end gap-2">
      <OrderDetailsModal
        orderId={order.id}
        customerName={order.customerName}
        phone={order.phone}
        sourceLabel={sourceLabels[order.source]}
        createdAtDateLabel={order.createdAtDateLabel}
        createdAtTimeLabel={order.createdAtTimeLabel}
        reference={order.instagram}
        notes={order.notes}
        items={order.items}
      />

      {canDeleteOrders ? (
        <ConfirmActionForm
          action={deleteOrderAction}
          hiddenFields={[{ name: "orderId", value: order.id }]}
          confirmMessage="A je i sigurt qe don ta fshish kete porosi? Ky veprim nuk kthehet mbrapa."
          buttonLabel="Fshi"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
        />
      ) : null}
    </div>
  );

  const renderOrderImage = (item: OrderItem | undefined) => (
    <button
      type="button"
      onClick={() =>
        item?.imagePath
          ? setPreviewImage({
              src: item.imagePath,
              alt: `${item.brand} ${item.name}`,
            })
          : undefined
      }
      className={`h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${
        item?.imagePath ? "transition hover:border-slate-300" : ""
      }`}
      title={item?.imagePath ? "Hap foton" : "Pa foto"}
    >
      {item?.imagePath ? (
        <UploadedImage
          src={item.imagePath}
          alt={item.name}
          className="h-full w-full object-cover"
        />
      ) : null}
    </button>
  );

  return (
    <div className="space-y-4">
      {canDeleteOrders && selectedIds.length > 0 ? (
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
            action={bulkDeleteOrdersAction}
            hiddenFields={[{ name: "orderIds", value: serializedSelectedIds }]}
            confirmMessage="A je i sigurt qe don t'i fshish porosite e zgjedhura? Ky veprim nuk kthehet mbrapa."
            buttonLabel="Fshi te zgjedhurat"
            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      ) : null}

      {viewConfig.layout === "grid" ? (
      <div className="grid gap-4 p-4 sm:p-5">
        {orders.map((order) => (
          <article
            key={order.id}
            className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {canDeleteOrders ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(order.id)}
                    onChange={() => toggleOne(order.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                  />
                ) : null}
              <div className="flex items-start gap-3">
                  {viewConfig.visibility.productImage ? renderOrderImage(order.items[0]) : null}
                  <div>
                    <h2 className="font-semibold text-slate-950">
                      {order.items[0]?.brand} {order.items[0]?.name}
                    </h2>
                    {viewConfig.visibility.variantSummary ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {order.items[0]
                          ? getOrderVariantSummary(order.items[0])
                          : "Pa variant"}
                      </p>
                    ) : null}
                    {viewConfig.visibility.customerName ? (
                      <p className="mt-1 text-sm text-slate-600">{order.customerName}</p>
                    ) : null}
                    {viewConfig.visibility.phone ? (
                      <p className="mt-1 text-xs text-slate-500">{order.phone}</p>
                    ) : null}
                  </div>
                </div>
              </div>
              {viewConfig.visibility.status ? (
                <span
                  className={`inline-flex rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusStyles[order.status]}`}
                >
                  {order.status}
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {viewConfig.visibility.quantity ? (
                <span className="inline-flex min-w-8 items-center justify-center rounded-xl bg-slate-100 px-2.5 py-1.5 text-sm font-semibold text-slate-700">
                  {order.totalQuantity} cope
                </span>
              ) : null}
              {viewConfig.visibility.source ? (
                <span
                  className={`inline-flex rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${sourceStyles[order.source]}`}
                >
                  {sourceLabels[order.source]}
                </span>
              ) : null}
              {viewConfig.visibility.date ? (
                <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                  <span className="block">{order.createdAtDateLabel}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">
                    {order.createdAtTimeLabel}
                  </span>
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {renderActions(order)}
            </div>
          </article>
        ))}
      </div>
      ) : null}

      {viewConfig.layout === "list" ? (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <colgroup>
            {canDeleteOrders ? <col className="w-[70px]" /> : null}
            <col className="w-[280px]" />
            {orderedDesktopFields.map((field) => (
              <col
                key={field}
                className={
                  field === "quantity"
                    ? "w-[100px]"
                    : field === "status" || field === "source"
                      ? "w-[140px]"
                      : field === "date"
                        ? "w-[140px]"
                        : "w-[180px]"
                }
              />
            ))}
            <col className="w-[170px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50/95 text-left backdrop-blur">
            <tr className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {canDeleteOrders ? (
                <th className={`px-5 text-center ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>Select</th>
              ) : null}
              <th className={`px-5 ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>Produkti</th>
              {orderedDesktopFields.map((field) => (
                <th
                  key={field}
                  className={`px-5 ${field === "quantity" ? "text-center" : ""} ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}
                >
                  {desktopFieldLabels[field]}
                </th>
              ))}
              <th className={`px-5 text-right ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>Veprime</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {orders.map((order) => (
              <tr
                key={order.id}
                className="align-top transition hover:bg-slate-50/75"
              >
                {canDeleteOrders ? (
                  <td className={`px-5 text-center ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>
                    {canDeleteOrders ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleOne(order.id)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                      />
                    ) : null}
                  </td>
                ) : null}
                <td className={`px-5 ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>
                  <div className="flex items-start gap-3">
                    {viewConfig.visibility.productImage ? renderOrderImage(order.items[0]) : null}
                    <div>
                      <p className="truncate font-semibold text-slate-950">
                        {order.items[0]?.brand} {order.items[0]?.name}
                      </p>
                      {viewConfig.visibility.variantSummary ? (
                        <p
                          className="mt-1 truncate text-sm text-slate-500"
                          title={
                            order.items[0]
                              ? getOrderVariantSummary(order.items[0])
                              : "Pa variant"
                          }
                        >
                          {order.items[0]
                            ? getOrderVariantSummary(order.items[0])
                            : "Pa variant"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                {orderedDesktopFields.map((field) => {
                  if (field === "customerName") {
                    return (
                      <td key={field} className={`px-5 text-slate-700 ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>
                        <span className="block truncate" title={order.customerName}>
                          {order.customerName}
                        </span>
                      </td>
                    );
                  }

                  if (field === "phone") {
                    return (
                      <td key={field} className={`px-5 text-slate-600 ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>
                        <span className="block truncate" title={order.phone}>
                          {order.phone}
                        </span>
                      </td>
                    );
                  }

                  if (field === "quantity") {
                    return (
                      <td key={field} className={`px-5 text-center ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>
                        <span className="inline-flex min-w-8 items-center justify-center rounded-xl bg-slate-100 px-2.5 py-1.5 font-semibold text-slate-700">
                          {order.totalQuantity}
                        </span>
                      </td>
                    );
                  }

                  if (field === "source") {
                    return (
                      <td key={field} className={`px-5 ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>
                        <div className="inline-flex items-center gap-2 text-slate-700">
                          <span className="text-slate-400">{getSourceIcon(order.source)}</span>
                          <span className="text-sm font-medium">{sourceLabels[order.source]}</span>
                        </div>
                      </td>
                    );
                  }

                  if (field === "status") {
                    return (
                      <td key={field} className={`px-5 ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusStyles[order.status]}`}
                        >
                          {order.status}
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td key={field} className={`px-5 text-slate-600 ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>
                      <div>
                        <p className="font-medium text-slate-800">{order.createdAtDateLabel}</p>
                        <p className="mt-1 text-xs text-slate-500">{order.createdAtTimeLabel}</p>
                      </div>
                    </td>
                  );
                })}
                <td className={`px-5 ${viewConfig.density === "compact" ? "py-3" : "py-4"}`}>
                  {renderDesktopActions(order)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : null}

      {previewImage ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/75 text-white transition hover:bg-slate-950"
              aria-label="Mbyll foton"
            >
              ×
            </button>
            <div className="overflow-hidden rounded-[22px]">
              <UploadedImage
                src={previewImage.src}
                alt={previewImage.alt}
                className="h-auto max-h-[80vh] w-full object-contain bg-slate-50"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
