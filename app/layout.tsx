import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { logout } from "@/app/actions/auth";
import { AppShellGate } from "@/app/components/app-shell-gate";
import { WorkspaceBackLink } from "@/app/components/workspace-back-link";
import { getCurrentUser, hasTenantAccess } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "StockBase", template: "%s | StockBase" },
  description: "Menaxhimi i stokut, produkteve dhe porosive",
  icons: {
    icon: "/stock-app-logo.svg",
    shortcut: "/stock-app-logo.svg",
    apple: "/stock-app-logo.svg",
  },
};

function roleLabel(role: string) {
  switch (role) {
    case "SUPER_ADMIN": return "Super Admin";
    case "SELLER": return "Shites";
    case "WAREHOUSE": return "Depo";
    default: return role;
  }
}

function userInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await getCurrentUser();
  const hasAccess = currentUser ? hasTenantAccess(currentUser) : false;
  const tenantLabel = currentUser?.tenant?.businessName ?? currentUser?.tenant?.name ?? "StockBase";
  const primaryColor = currentUser?.tenant?.primaryColor?.trim() || "#0f172a";

  return (
    <html lang="sq" className="light" style={{ colorScheme: "light" }}>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-[linear-gradient(180deg,#ebf8f0_0%,#eef4f7_100%)] text-slate-950 antialiased`}>
        <AppShellGate enabled={Boolean(currentUser && hasAccess)} header={currentUser ? (
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-[0_4px_20px_rgba(15,45,35,0.04)] backdrop-blur print:hidden">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <WorkspaceBackLink />
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <form action={logout}>
                  <button type="submit" aria-label="Dil" title="Dil" className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 sm:w-auto sm:px-3">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                      <path d="M15 17l5-5-5-5M20 12H9M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
                    </svg>
                    <span className="hidden sm:inline">Dil</span>
                  </button>
                </form>
                <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-[#f8fbf9] pl-1 pr-1 shadow-sm sm:gap-2.5 sm:pr-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: primaryColor }}>
                    {userInitials(currentUser.name)}
                  </span>
                  <div className="hidden min-w-0 sm:block">
                    <p className="max-w-[180px] truncate text-xs font-bold leading-tight text-slate-900">{currentUser.name}</p>
                    <p className="max-w-[180px] truncate text-[10px] leading-tight text-slate-500">{tenantLabel} / {roleLabel(currentUser.role)}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>
        ) : null}>
          {children}
        </AppShellGate>
      </body>
    </html>
  );
}
