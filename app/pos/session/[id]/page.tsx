import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessPosSession, formatMoney, isPosEnabled } from "@/lib/pos";
import { prisma } from "@/lib/prisma";
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

  const sessionOrders = await prisma.order.findMany({
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
  });

  const expectedCash = Number(session.expectedCash ?? session.openingCash);
  const canClose = session.status === "OPEN";
  const totalOrders = sessionOrders.length;
  const totalUnits = sessionOrders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
  const totalSales = sessionOrders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce((itemSum, item) => itemSum + Number(item.unitPrice) * item.quantity, 0),
    0,
  );

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
              <Link
                href={`/orders/quick?posSessionId=${session.id}&source=STORE&warehouseId=${session.register.warehouseId}`}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                New Sale
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Statusi</p>
              <p className={`mt-1.5 font-semibold ${canClose ? "text-emerald-700" : "text-slate-700"}`}>
                {session.status}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Opening cash</p>
              <p className="mt-1.5 font-semibold text-slate-950">{formatMoney(session.openingCash)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Lokacioni</p>
              <p className="mt-1.5 font-semibold text-slate-950">{session.register.warehouse.name}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Cashier</p>
              <p className="mt-1.5 font-semibold text-slate-950">{session.openedBy.name}</p>
            </div>
          </div>
        </section>

        {resolvedSearchParams?.sale === "1" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm">
            Shitja u ruajt dhe u lidh me kete POS session.
          </div>
        ) : null}

        <CloseSessionPanel
          sessionId={session.id}
          openingCash={Number(session.openingCash)}
          expectedCash={expectedCash}
          canClose={canClose}
        />

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white/96 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.08)] sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Session Sales
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Shitjet ne kete session</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Ketu sheh sa u shit dhe cfare u shit nga ky register.
                  </p>
                </div>
                <Link
                  href={`/orders/quick?posSessionId=${session.id}&source=STORE&warehouseId=${session.register.warehouseId}`}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)]"
                >
                  Shto shitje
                </Link>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
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

              <div className="mt-5">
                {sessionOrders.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    Ende nuk ka shitje te lidhura me kete session.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessionOrders.map((order) => {
                      const orderTotal = order.items.reduce(
                        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
                        0,
                      );

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
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white/96 p-5 shadow-[0_20px_55px_rgba(15,23,42,0.08)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Selling Screen Shell
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Checkout surface gati per fazen tjeter</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="font-semibold text-slate-950">Barcode sales</p>
                <p className="mt-2 text-sm text-slate-600">Ketu do lidhet scanner, lookup dhe shtimi ne cart.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="font-semibold text-slate-950">Cart & payments</p>
                <p className="mt-2 text-sm text-slate-600">Cash / card / discount / totals do shtohen mbi kete session aktiv.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="font-semibold text-slate-950">Cash control</p>
                <p className="mt-2 text-sm text-slate-600">Cash in/out, close register dhe closing report do varen nga ky foundation.</p>
              </div>
            </div>
            </section>
          </div>

          <aside className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_20px_55px_rgba(15,23,42,0.18)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Next POS Phases
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-200">
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Barcode scan ne checkout</li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Cart dhe line items</li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Cash / card / split payments</li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Close register dhe counted cash</li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Receipts, refunds dhe POS analytics</li>
            </ul>
          </aside>
        </section>
      </div>
    </main>
  );
}
