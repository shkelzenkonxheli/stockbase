import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { logout } from "@/app/actions/auth";
import { AppShellNav } from "@/app/components/app-shell-nav";
import { getCurrentUser, hasRole, hasTenantAccess } from "@/lib/auth";
import { getCatalogTemplate } from "@/lib/product-taxonomy";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StockBase",
  description: "Menaxhimi i stokut, produkteve dhe porosive",
};

function roleLabel(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "SELLER":
      return "Shites";
    case "WAREHOUSE":
      return "Depo";
    default:
      return role;
  }
}

function userInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  const isPlatformRoute = pathname.startsWith("/platform");
  const currentUser = await getCurrentUser();
  const hasAccess = currentUser ? hasTenantAccess(currentUser) : false;
  const tenantLabel = currentUser?.tenant?.businessName ?? currentUser?.tenant?.name ?? "StockBase";
  const tenantTemplate = currentUser?.tenant
    ? getCatalogTemplate(currentUser.tenant.catalogType)
    : null;
  const primaryColor = currentUser?.tenant?.primaryColor?.trim() || "#0f172a";
  const navItems = currentUser
    ? [
        {
          href: "/",
          label: "Pulti",
          icon: (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
            >
              <path d="M4 13h6V4H4zm10 7h6V11h-6zM4 20h6v-3H4zm10-9h6V4h-6z" />
            </svg>
          ),
        },
        {
          href: "/products",
          label: "Produktet",
          icon: (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          ),
        },
        {
          href: "/orders",
          label: "Porosite",
          icon: (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
            >
              <path d="M7 6h10M7 12h10M7 18h6" />
            </svg>
          ),
        },
        ...(hasRole(currentUser, ["SUPER_ADMIN"])
          ? [
              {
                href: "/stock/incoming",
                label: "Hyrje Stoku",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
                  >
                    <path d="m12 19 6-6M12 19l-6-6M12 5v14" />
                  </svg>
                ),
              },
            ]
          : []),
        ...(hasRole(currentUser, ["SUPER_ADMIN"])
          ? [
              {
                href: "/reports",
                label: "Raportet",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
                  >
                    <path d="M4 19h16" />
                    <path d="M7 16V9" />
                    <path d="M12 16V5" />
                    <path d="M17 16v-3" />
                  </svg>
                ),
              },
            ]
          : []),
        ...(hasRole(currentUser, ["SUPER_ADMIN"])
          ? [
              {
                href: "/users",
                label: "Userat",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                    <circle cx="9.5" cy="7" r="3.5" />
                    <path d="M20 8v6M23 11h-6" />
                  </svg>
                ),
              },
              {
                href: "/settings",
                label: "Settings",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
                  >
                    <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
                    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8 0 2 2 0 0 1 0-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 0-2.8 2 2 0 0 1 2.8 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 0 2 2 0 0 1 0 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
                  </svg>
                ),
              },
            ]
          : []),
      ]
    : [];

  return (
    <html lang="sq" className="light" style={{ colorScheme: "light" }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#f3f6fb] text-slate-950 antialiased`}
      >
        <div className="min-h-screen">
          {currentUser && hasAccess && !isPlatformRoute ? (
            <div className="flex min-h-screen print:block">
              <aside className="hidden w-[248px] shrink-0 border-r border-slate-200 bg-[#edf2f8] px-5 py-6 xl:flex xl:flex-col print:hidden">
                <Link href="/" className="flex items-center gap-3">
                  <span className="relative h-11 w-11 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <Image
                      src="/stock-app-logo.svg"
                      alt="Logo"
                      fill
                      className="object-contain p-2"
                      sizes="44px"
                      priority
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold tracking-tight text-slate-950">
                      {tenantLabel}
                    </p>
                    <p className="text-xs text-slate-500">
                      {tenantTemplate?.label ?? "Menaxhimi i stokut"}
                    </p>
                  </div>
                </Link>

                <div className="mt-8">
                  <AppShellNav items={navItems} />
                </div>

                <div className="mt-auto space-y-3 border-t border-slate-200 pt-5">
                  <div className="rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Aktive
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {currentUser.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {roleLabel(currentUser.role)}
                    </p>
                  </div>
                </div>
              </aside>

              <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur print:hidden">
                  <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3 xl:hidden">
                      <Link
                        href="/"
                        className="flex min-w-0 items-center gap-3 text-lg font-semibold tracking-tight text-slate-950"
                      >
                        <span className="relative h-10 w-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <Image
                            src="/stock-app-logo.svg"
                            alt="Logo"
                            fill
                            className="object-contain p-2"
                            sizes="40px"
                            priority
                          />
                        </span>
                        <span className="truncate">{tenantLabel}</span>
                      </Link>
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                      <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 sm:inline-flex">
                        {roleLabel(currentUser.role)}
                      </span>
                      <form action={logout} className="print:hidden">
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          Dil
                        </button>
                      </form>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {userInitials(currentUser.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="max-w-[140px] truncate text-sm font-medium text-slate-900">
                            {currentUser.name}
                          </p>
                          <p className="max-w-[140px] truncate text-xs text-slate-500">
                            {tenantLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </header>

                <div className="flex-1">{children}</div>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </body>
    </html>
  );
}
