type PurchaseOrderPrintSheetProps = {
  order: {
    id: number;
    supplierName: string;
    supplierPhone: string | null;
    supplierEmail: string | null;
    warehouseName: string;
    orderedAtLabel: string;
    statusLabel: string;
    totalLabel: string;
    receivedLabel: string;
    returnedLabel: string;
    outstandingLabel: string;
    itemCount: number;
    totalQuantity: number;
    note: string | null;
  };
  items: Array<{
    id: number;
    productName: string;
    variantLabel: string;
    orderedQuantity: number;
    receivedQuantity: number;
    returnedQuantity: number;
    remainingQuantity: number;
    unitCostLabel: string;
    lineTotalLabel: string;
    note: string | null;
  }>;
  autoPrint?: boolean;
};

export function PurchaseOrderPrintSheet({
  order,
  items,
  autoPrint = true,
}: PurchaseOrderPrintSheetProps) {
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                StockBase Purchase Order
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">PO #{order.id}</h1>
              <p className="mt-2 text-sm text-slate-600">
                {order.supplierName} · {order.warehouseName} · {order.orderedAtLabel}
              </p>
              {order.supplierPhone || order.supplierEmail ? (
                <p className="mt-1 text-sm text-slate-500">
                  {order.supplierPhone ? `Tel: ${order.supplierPhone}` : ""}
                  {order.supplierPhone && order.supplierEmail ? " · " : ""}
                  {order.supplierEmail ? `Email: ${order.supplierEmail}` : ""}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[320px]">
              <MetricCard label="Statusi" value={order.statusLabel} />
              <MetricCard label="Vlera" value={order.totalLabel} />
              <MetricCard label="Pranuar" value={order.receivedLabel} />
              <MetricCard label="Kthyer" value={order.returnedLabel} />
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <MetricCard label="Rreshta" value={`${order.itemCount}`} />
                <MetricCard label="Ne pritje" value={order.outstandingLabel} />
              </div>
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">Produkti</th>
                  <th className="px-4 py-3">Varianti</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Pranuar</th>
                  <th className="px-4 py-3">Kthyer</th>
                  <th className="px-4 py-3">Mbetur</th>
                  <th className="px-4 py-3">Cmimi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{item.productName}</p>
                      {item.note ? <p className="mt-1 text-xs text-slate-500">{item.note}</p> : null}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.variantLabel}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.orderedQuantity}</td>
                    <td className="px-4 py-4 text-sm text-emerald-700">{item.receivedQuantity}</td>
                    <td className="px-4 py-4 text-sm text-fuchsia-700">{item.returnedQuantity}</td>
                    <td className="px-4 py-4 text-sm text-amber-700">{item.remainingQuantity}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.unitCostLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {order.note ? (
          <section className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/70 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Shenim i porosise
            </p>
            <p className="mt-2 text-sm text-slate-700">{order.note}</p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function AutoPrintOnMount() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          window.addEventListener('load', () => {
            setTimeout(() => window.print(), 120);
          });
        `,
      }}
    />
  );
}
