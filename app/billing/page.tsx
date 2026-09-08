import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { openBillingPortal, startCheckout } from "@/app/actions/billing";
import {
  BILLING_PLANS,
  getBillingPlanLabel,
  getStripePriceIdForPlan,
  isBillingConfigured,
} from "@/lib/billing";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Billing",
};

type BillingPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

function formatDate(date: Date | null) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "ACTIVE":
      return "Aktiv";
    case "TRIALING":
      return "Trial";
    case "PAST_DUE":
      return "Ne pritje pagese";
    case "CANCELED":
      return "Anuluar";
    case "EXPIRED":
      return "Skaduar";
    default:
      return "Pa status";
  }
}

function getMessage(error?: string, success?: string) {
  if (success === "checkout-return") {
    return "Pagesa u pranua nga Stripe. Statusi rifreskohet sapo webhook-u te perpunohen.";
  }
  if (success === "portal-return") {
    return "Ndryshimet e abonimit u ruajten.";
  }
  if (error === "checkout-canceled") {
    return "Checkout u anulua. Abonimi nuk u ndryshua.";
  }
  if (error === "not-configured") {
    return "Pagesat online nuk jane konfiguruar ende per kete platforme.";
  }
  if (error === "portal-unavailable") {
    return "Portali i pagesave nuk eshte i disponueshem per kete abonim.";
  }
  if (error === "checkout-session") {
    return "Nuk u krijua sesioni i pageses. Provo perseri.";
  }
  return null;
}

function getSupportEmail() {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean) ?? "hello@stockbase.app";
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!currentUser.tenant) redirect("/login");
  if (currentUser.role !== "SUPER_ADMIN") redirect("/");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const message = getMessage(resolvedSearchParams?.error, resolvedSearchParams?.success);
  const tenant = currentUser.tenant;
  const onlineBillingEnabled = isBillingConfigured();
  const supportEmail = getSupportEmail();
  const currentPlan = getBillingPlanLabel(tenant.planCode);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.15)_0%,transparent_28%),linear-gradient(180deg,#f6fbf8_0%,#eef4f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-[linear-gradient(135deg,#f4fffa_0%,#ffffff_52%,#edf9f2_100%)] px-5 py-6 shadow-[0_20px_55px_rgba(15,23,42,0.09)] sm:px-7 sm:py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Billing Center</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Abonimi i {tenant.businessName ?? tenant.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Menaxho planin, periudhen aktive dhe pagesat e workspace-it.</p>
            </div>
            <Link href="/settings" className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
              Settings
            </Link>
          </div>
        </section>

        {message ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${resolvedSearchParams?.error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Statusi</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{statusLabel(tenant.subscriptionStatus)}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Plani aktual</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{currentPlan}</p>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Aktiv deri</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{formatDate(tenant.currentPeriodEnd ?? tenant.trialEnd)}</p>
          </article>
        </section>

        {!onlineBillingEnabled ? (
          <section className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-5 sm:p-6">
            <p className="text-base font-semibold text-amber-950">Pagesat online ende nuk jane aktive</p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900/80">Aktivizimi i abonimit behet nga administratori i StockBase. Pas pageses, plani dhe data e skadimit ruhen nga platforma.</p>
            <a href={`mailto:${supportEmail}?subject=StockBase%20Billing%20-%20${encodeURIComponent(tenant.name)}`} className="mt-4 inline-flex rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
              Kontakto per abonim
            </a>
          </section>
        ) : null}

        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Planet</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Zgjidh planin e duhur</h2>
            </div>
            {onlineBillingEnabled ? (
              <form action={openBillingPortal}>
                <button type="submit" className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">Menaxho pagesen</button>
              </form>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {BILLING_PLANS.map((plan) => {
              const planCheckoutAvailable = onlineBillingEnabled && Boolean(getStripePriceIdForPlan(plan.code));
              return (
                <article key={plan.code} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fcfa_100%)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">{plan.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{plan.monthlyPriceLabel}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Mujore</span>
                  </div>
                  <p className="mt-4 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
                  <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-700">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2 leading-5">
                        <span aria-hidden="true" className="mt-0.5 text-emerald-600">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {planCheckoutAvailable ? (
                    <form action={startCheckout} className="mt-5">
                      <input type="hidden" name="planCode" value={plan.code} />
                      <button type="submit" className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
                        Vazhdo me {plan.name}
                      </button>
                    </form>
                  ) : (
                    <p className="mt-5 rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-medium text-slate-500">Aktivizohet nga platforma</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
