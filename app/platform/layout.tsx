import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requirePlatformAdmin } from "@/lib/auth";

export default async function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Owner Console
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
              Platforma e menaxhimit
            </h1>
          </div>

          <nav className="flex items-center gap-3">
            <Link
              href="/platform/tenants"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Tenantet
            </Link>
            <Link
              href="/platform/tenants/new"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Krijo tenant
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Hape app-in
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Dil
              </button>
            </form>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
          Je i kycur si <span className="font-semibold text-slate-900">{currentUser.email}</span>.
          Ky panel eshte i brendshem dhe nuk shfaqet ne navigimin e klienteve.
        </div>
        {children}
      </div>
    </div>
  );
}
