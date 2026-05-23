import Image from "next/image";
import Link from "next/link";
import { AutoPrintOnMount } from "./auto-print-on-mount";
import { TopModelsPanel } from "./top-models-panel";
import { requireRole } from "@/lib/auth";
import {
  BUSINESS_TIME_ZONE,
  getMonthStringInTimeZone,
  getMonthlySalesReport,
} from "@/lib/reports/monthly-sales-report";

type ReportsPageProps = {
  searchParams?: Promise<{
    month?: string;
    print?: string;
  }>;
};

function sourceIcon(source: string) {
  switch (source) {
    case "INSTAGRAM":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <rect x="4.5" y="4.5" width="15" height="15" rx="4" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="17.2" cy="6.8" r="0.8" className="fill-current stroke-none" />
        </svg>
      );
    case "STORE":
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M4 10h16" />
          <path d="M6 10V7.5A1.5 1.5 0 0 1 7.5 6h9A1.5 1.5 0 0 1 18 7.5V10" />
          <path d="M5.5 10h13v8h-13z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M7 8h10" />
          <path d="M7 12h10" />
          <path d="M7 16h6" />
          <path d="M5 6h14v12H5z" />
        </svg>
      );
  }
}

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) {
    return null;
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isPrint = resolvedSearchParams?.print === "1";
  const defaultMonth = getMonthStringInTimeZone(new Date(), BUSINESS_TIME_ZONE);
  const rawMonth = resolvedSearchParams?.month?.trim() || defaultMonth;
  const selectedMonth = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : defaultMonth;
  const report = await getMonthlySalesReport(selectedMonth, tenantId);

  const maxDailyQuantity =
    report.dailySales.reduce((max, item) => Math.max(max, item.quantity), 0) || 1;
  const maxBrandQuantity =
    report.topBrands.reduce((max, item) => Math.max(max, item.quantity), 0) || 1;
  const focusItem = report.topModels[0] ?? null;

  return (
    <main className="bg-[#f6f8fc] px-4 py-6 print:bg-white print:px-0 print:py-0 sm:px-6 lg:px-8">
      {isPrint ? <AutoPrintOnMount /> : null}
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] print:rounded-none print:border-none print:px-0 print:py-0 print:shadow-none sm:px-6 lg:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                Performanca mujore
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Shitjet per {report.monthLabel}
              </h1>
            </div>

            <div className={`flex flex-col gap-3 sm:flex-row sm:items-center ${isPrint ? "print:hidden" : ""}`}>
              <form className="flex items-center gap-3">
                <label className="inline-flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                    <path d="M8 4v4M16 4v4M4 10h16" />
                    <path d="M5 6h14v13H5z" />
                  </svg>
                  <input
                    type="month"
                    name="month"
                    defaultValue={selectedMonth}
                    className="bg-transparent outline-none"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Shfaq
                </button>
                <Link
                  href={`/reports?month=${selectedMonth}&print=1`}
                  target="_blank"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  title="Print"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
                    <path d="M7 9V4h10v5" />
                    <path d="M7 17H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1" />
                    <path d="M7 14h10v6H7z" />
                  </svg>
                </Link>
                <a
                  href={`/reports/pdf?month=${selectedMonth}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white transition hover:bg-slate-800"
                  title="Download PDF"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
                    <path d="M12 4v10" />
                    <path d="m8 10 4 4 4-4" />
                    <path d="M5 19h14" />
                  </svg>
                </a>
              </form>
            </div>
          </div>
        </section>

        <section className="grid gap-4 print:grid-cols-2 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm print:break-inside-avoid print:shadow-none">
            <div className="border-l-[3px] border-blue-600 pl-4">
              <p className="text-sm text-slate-500">Porosite totale</p>
              <div className="mt-3 flex items-end gap-3">
                <p className="text-4xl font-semibold tracking-tight text-slate-950">
                  {report.ordersCount}
                </p>
                <span className="pb-1 text-sm font-medium text-emerald-600">
                  +12.5%
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm print:break-inside-avoid print:shadow-none">
            <div className="border-l-[3px] border-sky-300 pl-4">
              <p className="text-sm text-slate-500">Artikujt total</p>
              <div className="mt-3 flex items-end gap-3">
                <p className="text-4xl font-semibold tracking-tight text-slate-950">
                  {report.totalPairs}
                </p>
                <span className="pb-1 text-sm font-medium text-slate-500">
                  Mes. {report.averageItemsPerOrder.toFixed(2)}/porosi
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm print:break-inside-avoid print:shadow-none">
            <div className="border-l-[3px] border-slate-500 pl-4">
              <p className="text-sm text-slate-500">Produkte aktive</p>
              <div className="mt-3 flex items-end gap-3">
                <p className="text-4xl font-semibold tracking-tight text-slate-950">
                  {report.activeModelsCount}
                </p>
                <span className="pb-1 text-sm font-medium text-emerald-600">
                  Ne stok
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm print:break-inside-avoid print:shadow-none">
            <div className="border-l-[3px] border-indigo-950 pl-4">
              <p className="text-sm text-slate-500">Burimi kryesor</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-2xl font-semibold uppercase tracking-tight text-slate-950">
                  {report.topSourceLabel ?? "-"}
                </p>
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-slate-900 stroke-[1.8]">
                  <path d="M7 17 17 7" />
                  <path d="M9 7h8v8" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div className="space-y-6">
            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.07)] print:break-inside-avoid print:shadow-none">
              <h2 className="text-[24px] font-semibold tracking-tight text-slate-950">
                Shitjet sipas burimit
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {report.sourceBreakdown.map((item) => (
                  <div
                    key={item.source}
                    className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-5 text-center"
                  >
                    <div
                      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
                        item.quantity > 0
                          ? "bg-[#11206f] text-white"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {sourceIcon(item.source)}
                    </div>
                    <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                      {item.quantity}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.07)] print:break-inside-avoid print:shadow-none">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[24px] font-semibold tracking-tight text-slate-950">
                  Ritmi ditor
                </h2>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-950" />
                    Volume
                  </span>
                </div>
              </div>

              {report.dailySales.length === 0 ? (
                <p className="mt-10 text-sm text-slate-500">Nuk ka te dhena.</p>
              ) : (
                <div className="mt-8">
                  <div className="flex h-[210px] items-end gap-2 rounded-[22px] bg-slate-50 px-4 pb-4 pt-5">
                    {report.dailySales.map((item) => (
                      <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                        <div
                          className="w-full rounded-t-[10px] bg-indigo-950/90"
                          style={{
                            height: `${Math.max(
                              12,
                              Math.round((item.quantity / maxDailyQuantity) * 180),
                            )}px`,
                          }}
                          title={`${item.date}: ${item.quantity} cope`}
                        />
                        <span className="text-[11px] font-medium tabular-nums text-slate-500">
                          {item.date.slice(0, 2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.07)] print:break-inside-avoid print:shadow-none">
              <h2 className="text-[24px] font-semibold tracking-tight text-slate-950">
                Sipas kategorise
              </h2>
              <div className="mt-8 space-y-6">
                {report.topBrands.length === 0 ? (
                  <p className="text-sm text-slate-500">Nuk ka te dhena.</p>
                ) : (
                  report.topBrands.map((item) => (
                    <div key={item.brand}>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <span className="text-[22px] font-semibold tracking-tight text-slate-950">
                          {item.brand}
                        </span>
                        <span className="text-sm text-slate-500">
                          {item.quantity} cope
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#11206f]"
                          style={{
                            width: `${Math.max(
                              8,
                              Math.round((item.quantity / maxBrandQuantity) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <TopModelsPanel models={report.topModels} />

          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.07)] print:break-inside-avoid print:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Produkti kryesor
            </p>
            {focusItem ? (
              <div className="mt-5">
                <div className="relative aspect-[1/1] overflow-hidden rounded-[20px] bg-slate-100">
                  {focusItem.imagePath ? (
                    <Image
                      src={focusItem.imagePath}
                      alt={focusItem.name}
                      fill
                      className="object-cover"
                      sizes="320px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      Pa foto
                    </div>
                  )}
                </div>
                <div className="mt-5">
                  <p className="text-2xl font-semibold tracking-tight text-slate-950">
                    {focusItem.brand} / {focusItem.name}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Top seller i ketij muaji - {focusItem.quantity} cope te shitura
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">Nuk ka shitje per kete muaj.</p>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
