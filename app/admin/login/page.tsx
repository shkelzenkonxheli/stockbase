import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { createSession, getCurrentUser, isPlatformAdmin } from "@/lib/auth";
import {
  clearLoginFailures,
  getLoginThrottleKey,
  getLoginThrottleState,
  recordLoginFailure,
} from "@/lib/login-throttle";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

type AdminLoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Admin Login",
};

async function loginPlatformAdmin(formData: FormData) {
  "use server";

  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    redirect("/admin/login?error=validation");
  }

  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const realIp = headerStore.get("x-real-ip");
  const throttleKey = getLoginThrottleKey(email, forwardedFor ?? realIp);
  const throttleState = getLoginThrottleState(throttleKey);

  if (!throttleState.allowed) {
    redirect("/admin/login?error=throttle");
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
        },
      },
    },
  });

  if (!user) {
    recordLoginFailure(throttleKey);
    redirect("/admin/login?error=credentials");
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    recordLoginFailure(throttleKey);
    redirect("/admin/login?error=credentials");
  }

  const authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenant: null,
  };

  if (!isPlatformAdmin(authUser)) {
    recordLoginFailure(throttleKey);
    redirect("/admin/login?error=platform");
  }

  clearLoginFailures(throttleKey);
  await createSession(user.id, user.memberships[0]?.tenantId ?? null);

  redirect("/platform/tenants");
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Ploteso email dhe password.";
    case "credentials":
      return "Email ose password nuk eshte i sakte.";
    case "platform":
      return "Ky login eshte vetem per platform admin.";
    case "throttle":
      return "Shume tentativa login. Provo perseri pas pak minutash.";
    default:
      return null;
  }
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    if (isPlatformAdmin(currentUser)) {
      redirect("/platform/tenants");
    }

    redirect("/");
  }

  const usersCount = await prisma.user.count();

  if (usersCount === 0) {
    redirect("/setup");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = getErrorMessage(resolvedSearchParams?.error);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/stock-app-bg.svg')" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.62)_0%,rgba(15,23,42,0.78)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16)_0%,transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12)_0%,transparent_24%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl items-center justify-center">
        <section className="w-full max-w-md rounded-[32px] border border-white/20 bg-white/96 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.34)] sm:p-8">
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
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              StockBase Admin
            </p>
          </div>

          <h1 className="mt-5 text-center text-3xl font-semibold tracking-tight text-slate-950">
            Platform Login
          </h1>
          <p className="mt-2 text-center text-sm text-slate-600">
            Hyrja e brendshme per menaxhimin e bizneseve ne platforme.
          </p>

          {errorMessage ? (
            <FlashMessage
              type="error"
              text={errorMessage}
              className="mt-6 rounded-2xl px-4 py-3 text-sm"
            />
          ) : null}

          <form action={loginPlatformAdmin} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder="owner@stockbase.app"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-800">
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
              Hyr ne platforme
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
