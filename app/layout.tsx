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
  title: {
    default: "StockBase",
    template: "%s | StockBase",
  },
  description: "Menaxhimi i stokut, produkteve dhe porosive",
  icons: {
    icon: "/stock-app-logo.svg",
    shortcut: "/stock-app-logo.svg",
    apple: "/stock-app-logo.svg",
  },
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
          label: "Paneli",
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
              {
                href: "/stock/transfer",
                label: "Transfer",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
                  >
                    <path d="M7 7h10" />
                    <path d="m13 3 4 4-4 4" />
                    <path d="M17 17H7" />
                    <path d="m11 21-4-4 4-4" />
                  </svg>
                ),
              },
              {
                href: "/stock/count",
                label: "Inventory Count",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
                  >
                    <path d="M9 6h11M9 12h11M9 18h11" />
                    <path d="M4 7.5h.01M4 12h.01M4 16.5h.01" strokeLinecap="round" />
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
              {
                href: "/audit",
                label: "Aktiviteti",
                icon: (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
                  >
                    <path d="M4 12h4l2-6 4 12 2-6h4" />
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
    <html lang="sq" className="light bg-background" style={{ colorScheme: "light" }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
      >
        <div className="min-h-screen">
          {currentUser && hasAccess && !isPlatformRoute ? (
            <div className="flex min-h-screen print:block">
              <aside className="hidden w-[264px] shrink-0 flex-col border-r border-border bg-card px-4 py-5 xl:flex print:hidden">
                <Link
                  href="/"
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-secondary"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                    <Image
                      src="/stock-app-logo.svg"
                      alt="Logo"
                      fill
                      className="object-contain p-1.5"
                      sizes="40px"
                      priority
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                      {tenantLabel}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tenantTemplate?.label ?? "Menaxhimi i stokut"}
                    </p>
                  </div>
                </Link>

                <div className="mt-6 flex-1">
                  <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                    Menu
                  </p>
                  <AppShellNav items={navItems} />
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/60 px-3 py-2.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {userInitials(currentUser.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {currentUser.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {roleLabel(currentUser.role)}
                      </p>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md print:hidden">
                  <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3 xl:hidden">
                      <Link
                        href="/"
                        className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight text-foreground sm:gap-3"
                      >
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs sm:h-10 sm:w-10">
                          <Image
                            src="/stock-app-logo.svg"
                            alt="Logo"
                            fill
                            className="object-contain p-1.5 sm:p-2"
                            sizes="40px"
                            priority
                          />
                        </span>
                        <span className="max-w-[120px] truncate sm:max-w-[220px]">
                          {tenantLabel}
                        </span>
                      </Link>
                    </div>

                    <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                      <span className="hidden items-center rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline-flex">
                        {roleLabel(currentUser.role)}
                      </span>
                      <div className="hidden items-center gap-2.5 rounded-full border border-border bg-card py-1 pl-1 pr-3 shadow-xs sm:flex">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {userInitials(currentUser.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="max-w-[140px] truncate text-sm font-medium text-foreground">
                            {currentUser.name}
                          </p>
                          <p className="max-w-[140px] truncate text-xs text-muted-foreground">
                            {tenantLabel}
                          </p>
                        </div>
                      </div>
                      <form action={logout} className="print:hidden">
                        <button
                          type="submit"
                          aria-label="Dil"
                          title="Dil"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:h-9 sm:w-auto sm:gap-2 sm:px-3.5"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 fill-none stroke-current stroke-[1.8]"
                          >
                            <path d="M15 17l5-5-5-5" />
                            <path d="M20 12H9" />
                            <path d="M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
                          </svg>
                          <span className="hidden text-sm font-medium sm:inline">Dil</span>
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className="border-t border-border px-4 py-3 xl:hidden">
                    <details className="relative sm:hidden">
                      <summary className="flex h-11 w-full cursor-pointer list-none items-center justify-between rounded-xl border border-border bg-secondary px-4 text-sm font-semibold text-foreground transition hover:bg-card">
                        <span>Menu</span>
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                          className="h-4 w-4 text-muted-foreground"
                        >
                          <circle cx="4.5" cy="10" r="1.4" />
                          <circle cx="10" cy="10" r="1.4" />
                          <circle cx="15.5" cy="10" r="1.4" />
                        </svg>
                      </summary>
                      <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-lg">
                        <AppShellNav items={navItems} />
                      </div>
                    </details>
                    <div className="hidden sm:block">
                      <div className="-mx-1 overflow-x-auto pb-1 scrollbar-thin">
                        <AppShellNav items={navItems} orientation="horizontal" />
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
