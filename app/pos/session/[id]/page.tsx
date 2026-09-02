import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessPosSession, formatMoney, isPosEnabled } from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import { CashMovementPanel } from "./cash-movement-panel";
import { CloseSessionPanel } from "./close-session-panel";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    sale?: string;
  }>;
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: `POS Session #${resolvedParams.id}`,
  };
}

export default async function PosSessionPage({ params, searchParams }: RouteProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!currentUser.tenant || !isPosEnabled(currentUser.tenant.catalogConfig)) {
    redirect("/");
  }

  const resolvedParams = await params;
  const sessionId = Number(resolvedParams.id);
  if (!sessionId) {
    notFound();
  }

  const session = await canAccessPosSession(currentUser, sessionId);
  if (!session) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const [sessionOrders, orderMetrics, paymentTotals, cashMovementTotals, recentCashMovements] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenantId: currentUser.tenant.id,
        posSessionId: session.id,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
      id: true,
      createdAt: true,
      source: true,
      customerName: true,
      quantity: true,
      subtotal: true,
      discountAmount: true,
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          variant: {
            select: {
              size: true,
              color: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      },
    }),
    prisma.order.aggregate({
      where: { tenantId: currentUser.tenant.id, posSessionId: session.id },
      _count: { id: true },
      _sum: { quantity: true },
    }),
    prisma.posPayment.groupBy({
      by: ["method"],
      where: { tenantId: currentUser.tenant.id, posSessionId: session.id },
      _sum: { amount: true },
    }),
    prisma.posCashMovement.groupBy({
      by: ["type"],
      where: { tenantId: currentUser.tenant.id, posSessionId: session.id },
      _sum: { amount: true },
    }),
    prisma.posCashMovement.findMany({
      where: { tenantId: currentUser.tenant.id, posSessionId: session.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        type: true,
        amount: true,
        note: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const cashSales = Number(paymentTotals.find((payment) => payment.method === "CASH")?._sum.amount ?? 0);
  const cardSales = Number(paymentTotals.find((payment) => payment.method === "CARD")?._sum.amount ?? 0);
  const cashIn = Number(cashMovementTotals.find((movement) => movement.type === "CASH_IN")?._sum.amount ?? 0);
  const cashOut = Number(cashMovementTotals.find((movement) => movement.type === "CASH_OUT")?._sum.amount ?? 0);
  const expectedCash = session.status === "CLOSED" && session.expectedCash !== null
    ? Number(session.expectedCash)
    : Number(session.openingCash) + cashSales + cashIn - cashOut;
  const canClose = session.status === "OPEN";
  const totalOrders = orderMetrics._count.id;
  const totalUnits = orderMetrics._sum.quantity ?? 0;
  const totalSales = cashSales + cardSales;

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-[linear-gradient(180deg,#f0fbf5_0%,#eff5f9_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-emerald-100 bg-white/96 px-5 py-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Active POS Session
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {session.register.name}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {session.register.warehouse.name} | {session.openedBy.name} | hapur me {formatDateTime(session.openedAt)}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {currentUser.role === "SUPER_ADMIN" ? (
                <Link
                  href="/pos/registers"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Registers
                </Link>
              ) : null}
              {canClose ? (
                <Link
                  href={`/pos/session/${session.id}/checkout`}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  New Sale
                </Link>
              ) : (
                <Link
                  href="/pos/open"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Open Register
                </Link>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className={`rounded-full px-3 py-1.5 font-semibold ${canClose ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-slate-200 bg-slate-50 text-slate-600"}`}>{canClose ? "Session aktiv" : "Session i mbyllur"}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">{session.register.warehouse.name}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">{session.openedBy.name}</span>
          </div>
        </section>

        {resolvedSearchParams?.sale === "1" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">
            Shitja u ruajt dhe u lidh me kete POS session.
          </div>
        ) : null}

        {canClose ? (
          <details className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white/96 shadow-[0_14px_38px_rgba(15,23,42,0.07)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-slate-900 marker:content-none sm:px-6"><span>Mbyll register-in</span><span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500 transition group-open:rotate-45">+</span></summary>
            <div className="border-t border-slate-100"><CloseSessionPanel sessionId={session.id} openingCash={Number(session.openingCash)} expectedCash={expectedCash} canClose={canClose} /></div>
          </details>
        ) : null}

        <CashMovementPanel sessionId={session.id} canManage={canClose} />

        <section className="rounded-[28px] border border-slate-200 bg-white/96 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Session report</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Raporti i arkës</h2>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${canClose ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-slate-200 bg-slate-50 text-slate-600"}`}>
              {canClose ? "Live" : "Mbyllur"}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {[
              ["Opening", Number(session.openingCash), "slate"],
              ["Cash sales", cashSales, "emerald"],
              ["Card sales", cardSales, "sky"],
              ["Cash in", cashIn, "emerald"],
              ["Cash out", cashOut, "amber"],
              ["Expected cash", expectedCash, "navy"],
            ].map(([label, amount, tone]) => (
              <div key={String(label)} className={`rounded-2xl border px-3 py-3 ${tone === "emerald" ? "border-emerald-200 bg-emerald-50/70" : tone === "amber" ? "border-amber-200 bg-amber-50/70" : tone === "sky" ? "border-sky-200 bg-sky-50/70" : tone === "navy" ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-slate-50/70"}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.13em] ${tone === "navy" ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
                <p className={`mt-1.5 text-base font-semibold ${tone === "navy" ? "text-white" : "text-slate-950"}`}>{formatMoney(Number(amount))}</p>
              </div>
            ))}
          </div>
          {!canClose && session.countedCash !== null ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Cash i numeruar: <strong>{formatMoney(session.countedCash)}</strong> | Diferenca: <strong>{formatMoney(Number(session.countedCash) - expectedCash)}</strong>
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <details className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white/96 shadow-[0_14px_38px_rgba(15,23,42,0.07)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none sm:px-6"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">Shitjet e session-it</p><p className="mt-1 text-sm text-slate-600">{totalOrders} porosi · {totalUnits} cope · {formatMoney(totalSales)}</p></div><span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 transition group-open:rotate-45">+</span></summary>
              <div className="border-t border-slate-100 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Orders</p>
                  <p className="mt-1.5 text-2xl font-semibold text-slate-950">{totalOrders}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Units sold</p>
                  <p className="mt-1.5 text-2xl font-semibold text-slate-950">{totalUnits}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Sales total</p>
                  <p className="mt-1.5 text-2xl font-semibold text-slate-950">{formatMoney(totalSales)}</p>
                </div>
              </div>

              <div className="mt-4">
                {sessionOrders.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    Ende nuk ka shitje te lidhura me kete session.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessionOrders.map((order) => {
                      const orderSubtotal = order.items.reduce(
                        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
                        0,
                      );
                      const orderDiscount = Number(order.discountAmount);
                      const orderTotal = (Number(order.subtotal) > 0 ? Number(order.subtotal) : orderSubtotal) - orderDiscount;

                      return (
                        <div
                          key={order.id}
                          className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] px-4 py-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-base font-semibold text-slate-950">Order #{order.id}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {order.customerName} | {formatDateTime(order.createdAt)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                                {order.items.length} rreshta
                              </span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                                {order.items.reduce((sum, item) => sum + item.quantity, 0)} cope
                              </span>
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                                {formatMoney(orderTotal)}
                              </span>
                              {orderDiscount > 0 ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">Zbritje -{formatMoney(orderDiscount)}</span> : null}
                              <Link
                                href={`/pos/sales/${order.id}/receipt`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                              >
                                Printo faturen
                              </Link>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2">
                            {order.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="font-medium text-slate-900">{item.variant.product.name}</p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {item.variant.color} / {item.variant.size}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                                    {item.quantity} cope
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                                    {formatMoney(item.unitPrice)}
                                  </span>
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                                    {formatMoney(Number(item.unitPrice) * item.quantity)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              </div>
            </details>
          </div>

          <details className="group h-fit overflow-hidden rounded-[24px] border border-slate-800 bg-slate-950 text-white shadow-[0_14px_38px_rgba(15,23,42,0.16)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none sm:px-6"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300">Levizjet cash</p><p className="mt-1 text-sm text-slate-300">{recentCashMovements.length} levizje te fundit</p></div><span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 transition group-open:rotate-45">+</span></summary>
            <div className="space-y-3 border-t border-white/10 p-5 sm:p-6">
              {recentCashMovements.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-slate-300">Nuk ka cash in/out ne kete session.</div>
              ) : recentCashMovements.map((movement) => (
                <div key={movement.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm font-semibold ${movement.type === "CASH_IN" ? "text-emerald-300" : "text-amber-300"}`}>{movement.type === "CASH_IN" ? "Cash In" : "Cash Out"}</span>
                    <span className="font-semibold text-white">{formatMoney(movement.amount)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{movement.createdBy.name} | {formatDateTime(movement.createdAt)}</p>
                  {movement.note ? <p className="mt-1 text-xs text-slate-300">{movement.note}</p> : null}
                </div>
              ))}
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
