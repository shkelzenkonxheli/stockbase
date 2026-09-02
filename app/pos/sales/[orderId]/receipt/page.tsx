import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessPosSession, isPosEnabled } from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import { ReceiptActions } from "./receipt-actions";

type RouteProps = {
  params: Promise<{ orderId: string }>;
};

function money(value: number | string | { toString(): string }) {
  return `${Number(value.toString()).toFixed(2)} EUR`;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function PosReceiptPage({ params }: RouteProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!currentUser.tenant || !isPosEnabled(currentUser.tenant.catalogConfig)) redirect("/");

  const { orderId: rawOrderId } = await params;
  const orderId = Number(rawOrderId);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: currentUser.tenant.id, posSessionId: { not: null } },
    select: {
      id: true,
      createdAt: true,
      posSessionId: true,
      subtotal: true,
      discountAmount: true,
      tenant: { select: { name: true } },
      posSession: {
        select: {
          register: { select: { name: true, warehouse: { select: { name: true } } } },
          openedBy: { select: { name: true } },
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          variant: { select: { size: true, color: true, product: { select: { name: true } } } },
        },
      },
      posPayments: { select: { method: true, amount: true } },
    },
  });

  if (!order?.posSessionId || !order.posSession) notFound();
  const session = await canAccessPosSession(currentUser, order.posSessionId);
  if (!session) notFound();

  const itemsSubtotal = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const subtotal = Number(order.subtotal) > 0 ? Number(order.subtotal) : itemsSubtotal;
  const discountAmount = Number(order.discountAmount);
  const total = subtotal - discountAmount;
  const paymentLabel = order.posPayments.map((payment) => payment.method === "CASH" ? "Cash" : "Karta").join(" / ") || "-";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-7 print:bg-white print:p-0">
      <style>{`@page { size: 80mm auto; margin: 5mm; } @media print { body { background: white; } }`}</style>
      <div className="mx-auto max-w-[390px]">
        <ReceiptActions />
        <article className="bg-white px-5 py-6 text-slate-950 shadow-[0_18px_48px_rgba(15,23,42,0.12)] print:w-[70mm] print:px-0 print:py-0 print:shadow-none">
          <header className="border-b border-dashed border-slate-300 pb-4 text-center">
            <p className="text-lg font-bold tracking-tight">{order.tenant?.name ?? "StockBase"}</p>
          </header>

          <div className="border-b border-dashed border-slate-300 py-3 text-xs text-slate-600">
            <div className="flex justify-between gap-3"><span>Fatura</span><strong className="text-slate-950">#{order.id}</strong></div>
            <div className="mt-1 flex justify-between gap-3"><span>Data</span><span>{formatDateTime(order.createdAt)}</span></div>
            <div className="mt-1 flex justify-between gap-3"><span>Cashier</span><span>{order.posSession.openedBy.name}</span></div>
            <div className="mt-1 flex justify-between gap-3"><span>Pagesa</span><span>{paymentLabel}</span></div>
          </div>

          <div className="py-3">
            {order.items.map((item) => (
              <div key={item.id} className="mb-3 last:mb-0">
                <p className="text-sm font-semibold">{item.variant.product.name}</p>
                <p className="mt-0.5 text-xs text-slate-600">{item.variant.color} / {item.variant.size}</p>
                <div className="mt-1 flex justify-between text-xs text-slate-700">
                  <span>{item.quantity} x {money(item.unitPrice)}</span>
                  <strong>{money(Number(item.unitPrice) * item.quantity)}</strong>
                </div>
              </div>
            ))}
          </div>

          <footer className="border-t border-dashed border-slate-300 pt-3">
            {discountAmount > 0 ? <div className="mb-1 flex justify-between text-sm text-slate-600"><span>Nentotali</span><span>{money(subtotal)}</span></div> : null}
            {discountAmount > 0 ? <div className="mb-2 flex justify-between text-sm font-medium text-emerald-700"><span>Zbritje</span><span>-{money(discountAmount)}</span></div> : null}
            <div className="flex items-end justify-between gap-3"><span className="text-sm font-semibold">TOTALI</span><strong className="text-xl">{money(total)}</strong></div>
            <p className="mt-5 text-center text-[11px] text-slate-500">Faleminderit per blerjen!</p>
          </footer>
        </article>
      </div>
    </main>
  );
}
