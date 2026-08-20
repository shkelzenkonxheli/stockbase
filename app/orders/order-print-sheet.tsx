import { AutoPrintOnMount } from "@/app/reports/auto-print-on-mount";
import { UploadedImage } from "@/app/components/uploaded-image";
import { getOrderVariantSummary } from "@/lib/order-variant-display";
import type { PrintableOrder } from "@/lib/order-printing";
import { orderSourceLabels } from "@/lib/order-printing";

type OrderPrintSheetProps = {
  title: string;
  subtitle: string;
  orders: PrintableOrder[];
  autoPrint?: boolean;
};

const statusLabels: Record<PrintableOrder["status"], string> = {
  NEW: "New",
  READY: "Ready",
  DONE: "Done",
  PARTIALLY_RETURNED: "Partially returned",
  CANCELED: "Canceled",
  RETURNED: "Returned",
};

export function OrderPrintSheet({
  title,
  subtitle,
  orders,
  autoPrint = true,
}: OrderPrintSheetProps) {
  const grandTotal = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const grandQuantity = orders.reduce((sum, order) => sum + order.totalActiveQuantity, 0);

  return (
    <main className="min-h-screen bg-white text-slate-950 print:bg-white">
      {autoPrint ? <AutoPrintOnMount /> : null}

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }
          .print-break-avoid {
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="mx-auto max-w-5xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <header className="mb-6 rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f7fffb_0%,#ffffff_55%,#effaf4_100%)] px-5 py-5 shadow-sm print:rounded-none print:border print:shadow-none">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                StockBase Orders
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[280px]">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Porosi</p>
                <p className="mt-1 text-xl font-semibold">{orders.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Cope aktive</p>
                <p className="mt-1 text-xl font-semibold">{grandQuantity}</p>
              </div>
              <div className="col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Totali aktiv</p>
                <p className="mt-1 text-xl font-semibold">EUR {grandTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-4">
          {orders.map((order) => (
            <article
              key={order.id}
              className="print-break-avoid overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold">Porosia #{order.id}</h2>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                        {statusLabels[order.status]}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                        {orderSourceLabels[order.source]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {order.customerName} · {order.phone}
                      {order.instagram ? ` · ${order.instagram}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {order.createdAtDateLabel} · {order.createdAtTimeLabel}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[260px]">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Aktive</p>
                      <p className="mt-1 font-semibold">{order.totalActiveQuantity} cope</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Kthyer</p>
                      <p className="mt-1 font-semibold">{order.totalReturnedQuantity} cope</p>
                    </div>
                    <div className="col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Totali aktiv</p>
                      <p className="mt-1 font-semibold">EUR {order.totalAmount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-4 py-3">Foto</th>
                      <th className="px-4 py-3">Produkti</th>
                      <th className="px-4 py-3">Varianti</th>
                      <th className="px-4 py-3">Lokacioni</th>
                      <th className="px-4 py-3">Sasia</th>
                      <th className="px-4 py-3">Cmimi</th>
                      <th className="px-4 py-3">Totali</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => {
                      const activeQuantity = Math.max(0, item.quantity - item.returnedQuantity);
                      const location = item.warehouseName && item.locationCode
                        ? `${item.warehouseName} / ${item.locationCode}`
                        : item.warehouseName ?? item.locationCode ?? "-";

                      return (
                        <tr key={item.id} className="border-b border-slate-100 align-top">
                          <td className="px-4 py-4">
                            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                              {item.imagePath ? (
                                <UploadedImage
                                  src={item.imagePath}
                                  alt={[item.brand, item.name].filter(Boolean).join(" ")}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-950">
                              {[item.brand, item.name].filter(Boolean).join(" ")}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">{item.category}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm text-slate-700">{getOrderVariantSummary(item)}</p>
                            {item.returnedQuantity > 0 ? (
                              <p className="mt-1 text-xs font-medium text-violet-700">
                                Kthyer: {item.returnedQuantity}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">{location}</td>
                          <td className="px-4 py-4 text-sm">
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                              {activeQuantity} cope
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-slate-800">
                            EUR {item.unitPrice.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                            EUR {(activeQuantity * item.unitPrice).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {order.notes ? (
                <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Shenime</p>
                  <p className="mt-2 text-sm text-slate-700">{order.notes}</p>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
