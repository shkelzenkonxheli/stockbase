import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { getCurrentUser, hasTenantAccess, isPlatformAdmin } from "@/lib/auth";

function formatDate(date: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getStatusCopy(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const tenant = user.tenant;

  if (!tenant) {
    return {
      title: "Nuk u gjet workspace aktiv",
      description: "Ky user nuk ka tenant aktiv. Hyr perseri ose kontakto administratorin.",
    };
  }

  switch (tenant.accessBlockedReason) {
    case "SUSPENDED":
      return {
        title: "Llogaria eshte pezulluar",
        description: "Ky tenant eshte pezulluar perkohesisht. Duhet riaktivizim nga administratori i platformes.",
      };
    case "TRIAL_EXPIRED":
      return {
        title: "Free trial ka skaduar",
        description: "Per te vazhduar perdorimin, duhet aktivizuar abonimi per kete tenant.",
      };
    case "SUBSCRIPTION_INACTIVE":
      return {
        title: "Abonimi nuk eshte aktiv",
        description: "Pagesa ose rinovimi mungon. Aktivizo abonimin per te hapur perseri app-in.",
      };
    default:
      return {
        title: "Qasja eshte e kufizuar",
        description: "Statusi i tenant-it nuk lejon hyrje ne aplikacion.",
      };
  }
}

export default async function SubscriptionPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (hasTenantAccess(currentUser)) {
    redirect("/");
  }

  const tenant = currentUser.tenant;
  const copy = getStatusCopy(currentUser);
  const trialEndLabel = formatDate(tenant?.trialEnd ?? null);
  const currentPeriodEndLabel = formatDate(tenant?.currentPeriodEnd ?? null);
  const platformAdmin = isPlatformAdmin(currentUser);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fef3c7_0%,transparent_18%),radial-gradient(circle_at_top_right,#fee2e2_0%,transparent_22%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[32px] border border-slate-200/80 bg-white px-6 py-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Subscription Status
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            {copy.description}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Tenant
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {tenant?.name ?? "-"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Statusi
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {tenant?.subscriptionStatus ?? tenant?.status ?? "-"}
              </p>
            </div>
            {trialEndLabel ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Trial deri me
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{trialEndLabel}</p>
              </div>
            ) : null}
            {currentPeriodEndLabel ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Periudha aktuale
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {currentPeriodEndLabel}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-8 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
            Aktivizimi behet manualisht nga administratori i platformes. Nese klienti
            ka paguar cash, tenant-i mund te riaktivizohet nga paneli `Platforma`.
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {platformAdmin ? (
              <a
                href="/platform/tenants"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
              >
                Hape panelin e platformes
              </a>
            ) : null}
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Dil nga llogaria
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
