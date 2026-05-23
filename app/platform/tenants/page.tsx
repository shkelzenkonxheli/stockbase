import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function tenantStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "ACTIVE":
      return "Aktiv";
    case "TRIALING":
      return "Trial";
    case "SUSPENDED":
      return "Pezulluar";
    case "EXPIRED":
      return "Skaduar";
    case "PAST_DUE":
      return "Ne pritje pagese";
    case "CANCELED":
      return "Anuluar";
    default:
      return status ?? "-";
  }
}

async function activateTenant(formData: FormData) {
  "use server";

  await requirePlatformAdmin();

  const tenantId = Number(formData.get("tenantId"));
  if (!tenantId) {
    redirect("/platform/tenants");
  }

  const now = new Date();
  const periodEnd = addDays(now, 30);

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "ACTIVE" },
    }),
    prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planCode: "cash_manual",
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
      update: {
        planCode: "cash_manual",
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/subscription");
  revalidatePath("/platform/tenants");
  redirect("/platform/tenants?success=activated");
}

async function extendTrial(formData: FormData) {
  "use server";

  await requirePlatformAdmin();

  const tenantId = Number(formData.get("tenantId"));
  if (!tenantId) {
    redirect("/platform/tenants");
  }

  const now = new Date();
  const trialEnd = addDays(now, 14);

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "TRIALING" },
    }),
    prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planCode: "trial_manual",
        status: "TRIALING",
        trialStart: now,
        trialEnd,
        cancelAtPeriodEnd: false,
      },
      update: {
        planCode: "trial_manual",
        status: "TRIALING",
        trialStart: now,
        trialEnd,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/subscription");
  revalidatePath("/platform/tenants");
  redirect("/platform/tenants?success=trial");
}

async function suspendTenant(formData: FormData) {
  "use server";

  await requirePlatformAdmin();

  const tenantId = Number(formData.get("tenantId"));
  if (!tenantId) {
    redirect("/platform/tenants");
  }

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "SUSPENDED" },
    }),
    prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planCode: "cash_manual",
        status: "PAST_DUE",
      },
      update: {
        status: "PAST_DUE",
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/subscription");
  revalidatePath("/platform/tenants");
  redirect("/platform/tenants?success=suspended");
}

type PlatformTenantsPageProps = {
  searchParams?: Promise<{
    success?: string;
  }>;
};

export default async function PlatformTenantsPage({
  searchParams,
}: PlatformTenantsPageProps) {
  await requirePlatformAdmin();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const tenants = await prisma.tenant.findMany({
    include: {
      settings: true,
      subscription: true,
      _count: {
        select: {
          memberships: true,
          products: true,
          orders: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Platforma
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Menaxhimi manual i tenant-eve
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Ketu aktivizon tenant-et pasi klienti paguan cash, zgjat trial-in ose e
                pezullon qasjen pa u varur nga Stripe.
              </p>
              {resolvedSearchParams?.success ? (
                <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Veprimi u ruajt me sukses.
                </p>
              ) : null}
            </div>
            <Link
              href="/platform/tenants/new"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Krijo tenant
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          {tenants.map((tenant) => (
            <article
              key={tenant.id}
              className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                      {tenant.settings?.businessName ?? tenant.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      slug: {tenant.slug} · catalog: {tenant.catalogType}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Tenant
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {tenantStatusLabel(tenant.status)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Subscription
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {tenantStatusLabel(tenant.subscription?.status)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Plani
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {tenant.subscription?.planCode ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Trial deri
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {formatDate(tenant.subscription?.trialEnd ?? null)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Aktiv deri
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {formatDate(tenant.subscription?.currentPeriodEnd ?? null)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Volumi
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {tenant._count.products} produkte · {tenant._count.orders} porosi ·{" "}
                        {tenant._count.memberships} usera
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:w-[360px] xl:grid-cols-1">
                  <form action={activateTenant}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Aktivizo 30 dite
                    </button>
                  </form>
                  <form action={extendTrial}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Zgjat trial 14 dite
                    </button>
                  </form>
                  <form action={suspendTenant}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                    >
                      Pezullo tenant-in
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
