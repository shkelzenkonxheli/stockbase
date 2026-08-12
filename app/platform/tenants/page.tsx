import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requirePlatformAdmin } from "@/lib/auth";
import { getPasswordPolicyHint, validatePasswordStrength } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { CATALOG_TYPES, getCatalogTemplate } from "@/lib/product-taxonomy";
import { createTenantWorkspace } from "@/lib/tenants";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseManualEndDate(value: FormDataEntryValue | null) {
  const raw = value?.toString().trim();
  if (!raw) {
    return null;
  }

  const parsed = new Date(`${raw}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
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

function statusBadgeClass(status: string | null | undefined) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "TRIALING":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "SUSPENDED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "EXPIRED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "PAST_DUE":
      return "border-orange-200 bg-orange-50 text-orange-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getCreateErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Ploteso te gjitha fushat.";
    case "email-exists":
      return "Ky email ekziston tashme. Per tenant te ri perdor email tjeter.";
    case "create-failed":
      return "Krijimi i tenant-it deshtoi. Provo perseri.";
    default:
      return error ? decodeURIComponent(error) : null;
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
  redirect(`/platform/tenants?success=activated&tenant=${tenantId}`);
}

async function activateTenantUntilDate(formData: FormData) {
  "use server";

  await requirePlatformAdmin();

  const tenantId = Number(formData.get("tenantId"));
  const periodEnd = parseManualEndDate(formData.get("activeUntil"));

  if (!tenantId || !periodEnd) {
    redirect(`/platform/tenants?success=invalid-date&tenant=${tenantId || ""}`);
  }

  const now = new Date();
  if (periodEnd.getTime() <= now.getTime()) {
    redirect(`/platform/tenants?success=invalid-date&tenant=${tenantId}`);
  }

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "ACTIVE" },
    }),
    prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planCode: "cash_manual_custom",
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
      },
      update: {
        planCode: "cash_manual_custom",
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialStart: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/subscription");
  revalidatePath("/platform/tenants");
  redirect(`/platform/tenants?success=activated&tenant=${tenantId}`);
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
  redirect(`/platform/tenants?success=trial&tenant=${tenantId}`);
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
  redirect(`/platform/tenants?success=suspended&tenant=${tenantId}`);
}

async function createTenant(formData: FormData) {
  "use server";

  await requirePlatformAdmin();

  const ownerName = formData.get("ownerName")?.toString().trim();
  const ownerEmail = formData.get("ownerEmail")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  const businessName = formData.get("businessName")?.toString().trim();
  const catalogType = formData.get("catalogType")?.toString().trim() as
    | "FOOTWEAR"
    | "ELECTRONICS"
    | "HOME_GOODS"
    | "DECOR"
    | undefined;

  if (!ownerName || !ownerEmail || !businessName || !catalogType || !password) {
    redirect("/platform/tenants?create=1&error=validation");
  }

  const passwordValidationError = validatePasswordStrength(password);
  if (passwordValidationError) {
    redirect(`/platform/tenants?create=1&error=${encodeURIComponent(passwordValidationError)}`);
  }

  try {
    await createTenantWorkspace({
      ownerName,
      ownerEmail,
      password,
      businessName,
      catalogType,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      redirect("/platform/tenants?create=1&error=email-exists");
    }

    redirect("/platform/tenants?create=1&error=create-failed");
  }

  revalidatePath("/platform/tenants");
  redirect("/platform/tenants?success=created");
}

export const metadata: Metadata = {
  title: "Tenantet",
};

type PlatformTenantsPageProps = {
  searchParams?: Promise<{
    success?: string;
    tenant?: string;
    create?: string;
    error?: string;
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

  const selectedTenantId = Number(resolvedSearchParams?.tenant);
  const selectedTenant = Number.isFinite(selectedTenantId)
    ? tenants.find((tenant) => tenant.id === selectedTenantId) ?? null
    : null;
  const isCreateOpen = resolvedSearchParams?.create === "1";
  const createErrorMessage = getCreateErrorMessage(resolvedSearchParams?.error);
  const catalogOptions = CATALOG_TYPES.map((type) => ({
    value: type,
    label: getCatalogTemplate(type).label,
  }));

  const successMessage = resolvedSearchParams?.success
    ? resolvedSearchParams.success === "invalid-date"
      ? "Data nuk eshte valide. Zgjidh nje date ne te ardhmen."
      : "Veprimi u ruajt me sukses."
    : null;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        {successMessage ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              resolvedSearchParams?.success === "invalid-date"
                ? "border border-rose-200 bg-rose-50 text-rose-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {successMessage}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                {tenants.length} biznese
              </span>
              <p className="text-sm text-slate-500">Menaxhim manual i tenant-eve</p>
            </div>

            <Link
              href="/platform/tenants?create=1"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Krijo tenant
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="hidden min-w-full lg:table">
              <thead className="bg-slate-50/90">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-5 py-4">Biznesi</th>
                  <th className="px-4 py-4">Subscription</th>
                  <th className="px-4 py-4">Plani</th>
                  <th className="px-4 py-4">Aktiv deri</th>
                  <th className="px-5 py-4 text-right">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {tenant.settings?.businessName ?? tenant.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{tenant.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                          tenant.subscription?.status,
                        )}`}
                      >
                        {tenantStatusLabel(tenant.subscription?.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-slate-700">
                      {tenant.subscription?.planCode ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatDate(tenant.subscription?.currentPeriodEnd ?? null)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <Link
                          href={`/platform/tenants?tenant=${tenant.id}`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          Menaxho
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-3 p-4 lg:hidden">
              {tenants.map((tenant) => (
                <article
                  key={tenant.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {tenant.settings?.businessName ?? tenant.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{tenant.slug}</p>
                    </div>
                    <Link
                      href={`/platform/tenants?tenant=${tenant.id}`}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Menaxho
                    </Link>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-2xl bg-white px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Subscription</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {tenantStatusLabel(tenant.subscription?.status)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Plani</p>
                      <p className="mt-1 font-medium text-slate-900">{tenant.subscription?.planCode ?? "-"}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Aktiv deri</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatDate(tenant.subscription?.currentPeriodEnd ?? null)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {selectedTenant ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Menaxho tenant
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {selectedTenant.settings?.businessName ?? selectedTenant.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedTenant.slug} · {selectedTenant.catalogType}
                  </p>
                </div>
                <Link
                  href="/platform/tenants"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  x
                </Link>
              </div>

              <div className="space-y-5 px-5 py-5 sm:px-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Statusi tenant</p>
                    <p className="mt-2 font-semibold text-slate-950">{tenantStatusLabel(selectedTenant.status)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Subscription</p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {tenantStatusLabel(selectedTenant.subscription?.status)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Plani</p>
                    <p className="mt-2 font-semibold text-slate-950">{selectedTenant.subscription?.planCode ?? "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Trial deri</p>
                    <p className="mt-2 font-semibold text-slate-950">
                      {formatDate(selectedTenant.subscription?.trialEnd ?? null)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Produkte</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{selectedTenant._count.products}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Porosi</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{selectedTenant._count.orders}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Usera</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{selectedTenant._count.memberships}</p>
                  </div>
                </div>

                <form action={activateTenantUntilDate} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <input type="hidden" name="tenantId" value={selectedTenant.id} />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Aktiv deri
                      </label>
                      <input
                        type="date"
                        name="activeUntil"
                        defaultValue={selectedTenant.subscription?.currentPeriodEnd
                          ? selectedTenant.subscription.currentPeriodEnd.toISOString().slice(0, 10)
                          : ""}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Ruaj
                    </button>
                  </div>
                </form>

                <div className="grid gap-3 sm:grid-cols-3">
                  <form action={activateTenant}>
                    <input type="hidden" name="tenantId" value={selectedTenant.id} />
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      Aktivizo 30 dite
                    </button>
                  </form>
                  <form action={extendTrial}>
                    <input type="hidden" name="tenantId" value={selectedTenant.id} />
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                    >
                      Zgjat trial 14 dite
                    </button>
                  </form>
                  <form action={suspendTenant}>
                    <input type="hidden" name="tenantId" value={selectedTenant.id} />
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                    >
                      Pezullo tenant-in
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {isCreateOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Krijo tenant
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    Tenant i ri
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Owner-i krijohet me trial 14 dite.
                  </p>
                </div>
                <Link
                  href="/platform/tenants"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  x
                </Link>
              </div>

              <div className="px-5 py-5 sm:px-6">
                {createErrorMessage ? (
                  <FlashMessage
                    type="error"
                    text={createErrorMessage}
                    className="mb-4 rounded-2xl px-4 py-3 text-sm"
                  />
                ) : null}

                <form action={createTenant} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="businessName" className="block text-sm font-medium text-slate-800">
                      Emri i biznesit
                    </label>
                    <input
                      id="businessName"
                      name="businessName"
                      type="text"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="catalogType" className="block text-sm font-medium text-slate-800">
                      Lloji i katalogut
                    </label>
                    <select
                      id="catalogType"
                      name="catalogType"
                      defaultValue="ELECTRONICS"
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                    >
                      {catalogOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="ownerName" className="block text-sm font-medium text-slate-800">
                        Emri i owner-it
                      </label>
                      <input
                        id="ownerName"
                        name="ownerName"
                        type="text"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="ownerEmail" className="block text-sm font-medium text-slate-800">
                        Email i owner-it
                      </label>
                      <input
                        id="ownerEmail"
                        name="ownerEmail"
                        type="email"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-800">
                      Password i pare
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      placeholder={getPasswordPolicyHint()}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Link
                      href="/platform/tenants"
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Anulo
                    </Link>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Krijo tenant-in
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}