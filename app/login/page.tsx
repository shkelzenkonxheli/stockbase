import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DismissiblePanel } from "@/app/components/dismissible-panel";
import { FlashMessage } from "@/app/components/flash-message";
import {
  createSession,
  getCurrentUser,
  getTenantAccessBlockedReason,
  hasTenantAccess,
  isPlatformAdmin,
} from "@/lib/auth";
import {
  clearLoginFailures,
  getLoginThrottleKey,
  getLoginThrottleState,
  recordLoginFailure,
} from "@/lib/login-throttle";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    reason?: string;
    expiredAt?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Hyrje",
};

function formatBlockedDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("sq-AL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

async function login(formData: FormData) {
  "use server";

  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    redirect("/login?error=validation");
  }

  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const realIp = headerStore.get("x-real-ip");
  const throttleKey = getLoginThrottleKey(email, forwardedFor ?? realIp);
  const throttleState = getLoginThrottleState(throttleKey);

  if (!throttleState.allowed) {
    redirect("/login?error=throttle");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          tenantId: true,
          tenant: {
            select: {
              status: true,
              subscription: {
                select: {
                  status: true,
                  trialEnd: true,
                  currentPeriodEnd: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    recordLoginFailure(throttleKey);
    redirect("/login?error=credentials");
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    recordLoginFailure(throttleKey);
    redirect("/login?error=credentials");
  }

  const authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenant: null,
  };

  if (!isPlatformAdmin(authUser)) {
    const primaryMembership = user.memberships[0];
    const blockedReason = primaryMembership
      ? getTenantAccessBlockedReason({
          tenantStatus: primaryMembership.tenant.status,
          subscriptionStatus: primaryMembership.tenant.subscription?.status ?? null,
          trialEnd: primaryMembership.tenant.subscription?.trialEnd ?? null,
          currentPeriodEnd: primaryMembership.tenant.subscription?.currentPeriodEnd ?? null,
        })
      : null;

    if (blockedReason) {
      const params = new URLSearchParams({ error: "inactive", reason: blockedReason });
      const expiredAt =
        blockedReason === "TRIAL_EXPIRED"
          ? primaryMembership?.tenant.subscription?.trialEnd
          : primaryMembership?.tenant.subscription?.currentPeriodEnd;

      if (expiredAt) {
        params.set("expiredAt", expiredAt.toISOString());
      }

      redirect(`/login?${params.toString()}`);
    }
  }

  clearLoginFailures(throttleKey);
  await createSession(user.id, user.memberships[0]?.tenantId ?? null);

  if (isPlatformAdmin(authUser)) {
    redirect("/platform/tenants");
  }

  redirect("/");
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Ploteso email dhe password.";
    case "credentials":
      return "Email ose password nuk eshte i sakte.";
    case "throttle":
      return "Shume tentativa login. Provo perseri pas pak minutash.";
    default:
      return null;
  }
}

function getBlockedAccessCopy(reason?: string, expiredAt?: string) {
  const formattedDate = formatBlockedDate(expiredAt);

  switch (reason) {
    case "TRIAL_EXPIRED":
      return {
        title: "Free trial ka skaduar",
        description: formattedDate
          ? `Qasja per kete biznes ka skaduar me ${formattedDate}. Nese don me vazhdu perdorimin, kontakto administratorin e platformes per riaktivizim.`
          : "Qasja per kete biznes ka skaduar. Nese don me vazhdu perdorimin, kontakto administratorin e platformes per riaktivizim.",
      };
    case "SUSPENDED":
      return {
        title: "Llogaria eshte pezulluar",
        description:
          "Ky biznes eshte pezulluar perkohesisht. Nese don me vazhdu perdorimin, kontakto administratorin e platformes.",
      };
    case "SUBSCRIPTION_INACTIVE":
      return {
        title: "Abonimi ka skaduar",
        description: formattedDate
          ? `Periudha aktive ka perfunduar me ${formattedDate}. Nese don me vazhdu perdorimin, kontakto administratorin e platformes per riaktivizim.`
          : "Periudha aktive ka perfunduar. Nese don me vazhdu perdorimin, kontakto administratorin e platformes per riaktivizim.",
      };
    default:
      return {
        title: "Qasja nuk eshte aktive",
        description:
          "Ky tenant nuk ka qasje aktive. Kontakto administratorin e platformes nese don me vazhdu.",
      };
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    if (isPlatformAdmin(currentUser)) {
      redirect("/platform/tenants");
    }

    if (!hasTenantAccess(currentUser)) {
      redirect("/subscription");
    }

    redirect("/");
  }

  const usersCount = await prisma.user.count();

  if (usersCount === 0) {
    redirect("/setup");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = getErrorMessage(resolvedSearchParams?.error);
  const blockedAccess =
    resolvedSearchParams?.error === "inactive"
      ? getBlockedAccessCopy(
          resolvedSearchParams.reason,
          resolvedSearchParams.expiredAt,
        )
      : null;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/stock-app-bg.svg')" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.42)_0%,rgba(15,23,42,0.58)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.18)_0%,transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.16)_0%,transparent_24%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl items-center justify-center">
        <section className="w-full max-w-md rounded-[32px] border border-white/35 bg-white/95 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
              <Image
                src="/stock-app-logo.svg"
                alt="Logo"
                fill
                className="object-contain p-2"
                sizes="64px"
                priority
              />
            </div>
            <p className="mt-3 text-sm font-medium tracking-[0.18em] text-slate-500 uppercase">
              StockBase
            </p>
          </div>
          <h1 className="mt-5 text-center text-3xl font-semibold tracking-tight text-slate-950">
            Login
          </h1>

          {errorMessage ? (
            <FlashMessage
              type="error"
              text={errorMessage}
              className="mt-6 rounded-2xl px-4 py-3 text-sm"
            />
          ) : null}

          {blockedAccess ? (
            <DismissiblePanel className="mt-6 overflow-hidden rounded-[28px] border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,1))] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="border-b border-amber-100 px-5 py-4 pr-16">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
                      <path d="M12 8v5" strokeLinecap="round" />
                      <path d="M12 16h.01" strokeLinecap="round" />
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-950">{blockedAccess.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{blockedAccess.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Per vazhdim, kontakto platform admin
                </p>
                <span className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">
                  Kontakto per riaktivizim
                </span>
              </div>
            </DismissiblePanel>
          ) : null}

          <form action={login} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-800"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder="admin@stockbase.app"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-800"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              Hyr ne panel
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
