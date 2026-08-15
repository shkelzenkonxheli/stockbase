import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasRole, hasTenantAccess, isPlatformAdmin } from "@/lib/auth";
import { getEffectiveReorderLevel, isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { getCatalogTemplate } from "@/lib/product-taxonomy";

const BUSINESS_TIME_ZONE = "Europe/Belgrade";

export const metadata: Metadata = {
  title: "Paneli",
};

type ActionTile = {
  title: string;
  subtitle: string;
  href?: string;
  accent: string;
  pill: string;
  icon: React.ReactNode;
  visible: boolean;
};

function ActionTile({ title, subtitle, href, accent, pill, icon, visible }: ActionTile) {
  if (!visible) {
    return null;
  }

  const content = (
    <div
      className={`group relative overflow-hidden rounded-[28px] px-5 py-6 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)] ${accent}`}
    >
      <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
        {icon}
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 max-w-[240px] text-sm leading-6 text-white/80">{subtitle}</p>
      <span className="mt-5 inline-flex rounded-full bg-black/20 px-3 py-1 text-xs font-medium text-white/85 ring-1 ring-white/10">
        {pill}
      </span>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

function getDateStringInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const zonedTimeAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return zonedTimeAsUtc - date.getTime();
}

function getTimeZoneDayBounds(dateString: string, timeZone: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const startApprox = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const endApprox = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const startOffset = getTimeZoneOffsetMs(startApprox, timeZone);
  const endOffset = getTimeZoneOffsetMs(endApprox, timeZone);

  return {
    start: new Date(startApprox.getTime() - startOffset),
    end: new Date(endApprox.getTime() - endOffset),
  };
}

function getSupportEmail() {
  const firstPlatformEmail = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);

  return firstPlatformEmail || "hello@stockbase.app";
}

function LandingPreviewCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
      <div className="border-b border-emerald-100 bg-[linear-gradient(180deg,#f4fdf7_0%,#ffffff_100%)] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </article>
  );
}

function PublicLandingPage() {
  const supportEmail = getSupportEmail();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf3_0%,#f8fafc_38%,#eef5f7_100%)]">
      <section className="relative overflow-hidden border-b border-emerald-100/80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16)_0%,transparent_28%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.10)_0%,transparent_20%),linear-gradient(180deg,#f7fff9_0%,#eff8f3_100%)]">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(16,185,129,0.35),transparent)]" />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="relative h-12 w-12 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
                <Image
                  src="/stock-app-logo.svg"
                  alt="StockBase"
                  fill
                  className="object-contain p-2"
                  sizes="48px"
                  priority
                />
              </span>
              <div>
                <p className="text-lg font-semibold tracking-tight text-slate-950">StockBase</p>
                <p className="text-sm text-slate-500">Inventory, orders and warehouse control</p>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                Login
              </Link>
              <Link
                href="/trial"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)] transition hover:bg-emerald-700"
              >
                Kerko Trial
              </Link>
            </div>
          </header>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:items-center">
            <div className="max-w-2xl">
              <p className="inline-flex items-center rounded-full border border-emerald-200 bg-white/88 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
                SaaS per inventar dhe shitje
              </p>
              <h1 className="mt-5 text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                Menaxho produktet, depot dhe porosite ne nje platforme te vetme.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                StockBase i ndihmon bizneset me katalog fleksibel, multi-warehouse, quick stock,
                porosi, barcode scan, inventory count dhe import nga Excel/CSV pa workflow te komplikuar.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/trial"
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(16,185,129,0.24)] transition hover:bg-emerald-500"
                >
                  Fillo kerkesen per trial
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  Hyr ne platforme
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { value: "Multi-warehouse", label: "Depo, transfer dhe lokacione" },
                  { value: "Quick Orders", label: "Shitje dhe porosi me barcode" },
                  { value: "Excel Import", label: "Import me preview dhe validim" },
                ].map((item) => (
                  <div
                    key={item.value}
                    className="rounded-[24px] border border-emerald-100 bg-white/90 px-4 py-4 shadow-sm"
                  >
                    <p className="text-sm font-semibold text-slate-950">{item.value}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-10 hidden h-28 w-28 rounded-full bg-emerald-200/40 blur-3xl lg:block" />
              <div className="absolute -right-4 bottom-8 hidden h-24 w-24 rounded-full bg-slate-300/40 blur-3xl lg:block" />
              <div className="relative overflow-hidden rounded-[34px] border border-emerald-100 bg-[#0f172a] p-4 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#172033_0%,#0f172a_100%)] p-4">
                  <div className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                        Products workspace
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">Inventory overview</p>
                    </div>
                    <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
                      Live stock
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Produkte", value: "248" },
                      { label: "Njesi", value: "4,912" },
                      { label: "Low stock", value: "17" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[26px] border border-white/10 bg-white">
                    <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#f8fdf9_0%,#eef8f2_100%)] px-4 py-3">
                      <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.9fr] gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                        <span>Produkti</span>
                        <span>Kategoria</span>
                        <span>Stoku</span>
                        <span>Veprime</span>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {[
                        { name: "Nike Air Force", category: "Patika", stock: "69" },
                        { name: "Toaster Pro", category: "Pajisje", stock: "12" },
                        { name: "Batanije Cozy", category: "Lini shtepie", stock: "7" },
                      ].map((item, index) => (
                        <div key={item.name} className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.9fr] items-center gap-3 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="relative h-11 w-11 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                              <Image
                                src={index === 0 ? "/nike.jpg" : index === 1 ? "/IMG_6366.webp" : "/bg1.jpg"}
                                alt={item.name}
                                fill
                                className="object-cover"
                                sizes="44px"
                              />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">{item.name}</p>
                              <p className="text-xs text-slate-500">Quick stock, manage, barcode</p>
                            </div>
                          </div>
                          <span className="text-sm text-slate-600">{item.category}</span>
                          <span className="text-sm font-semibold text-emerald-700">{item.stock}</span>
                          <div className="flex gap-2">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                              +
                            </span>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                              ...
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <LandingPreviewCard eyebrow="Products" title="Katalog fleksibel sipas biznesit">
          <div className="space-y-3">
            <div className="rounded-[22px] border border-emerald-100 bg-[linear-gradient(180deg,#f8fdf9_0%,#ffffff_100%)] p-4">
              <p className="text-sm font-semibold text-slate-950">Footwear, electronics, home goods, decor</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Cdo tenant konfiguron kategorite, variablat, brandet, depot dhe view-at sipas nevojes.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="font-semibold text-slate-900">Variants</p>
                <p className="mt-1">Ngjyra, numer, dimension, material, fuqi</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <p className="font-semibold text-slate-900">Barcode labels</p>
                <p className="mt-1">Print browser, PDF, A4 templates</p>
              </div>
            </div>
          </div>
        </LandingPreviewCard>

        <LandingPreviewCard eyebrow="Operations" title="Shitje, depo dhe levizje stoku">
          <div className="space-y-3">
            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Quick order / POS-like flow</p>
                  <p className="mt-1 text-sm text-slate-500">Zgjedh kategori, produkt, variant dhe perfundon porosine.</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Barcode ready
                </span>
              </div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">Incoming stock, transfer dhe inventory count</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Menaxho hyrje stoku, kalime mes depove, low stock alerts dhe numerim fizik me export.
              </p>
            </div>
          </div>
        </LandingPreviewCard>

        <LandingPreviewCard eyebrow="Import" title="Import i shpejte nga Excel / CSV">
          <div className="space-y-3">
            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-950">Preview para importit</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Shikon kolonat, mapon fushat, heq rreshta, vendos kategori/depo kur mungojne dhe pastaj importon.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Mapim", value: "Auto" },
                { label: "Validim", value: "Po" },
                { label: "Barcode", value: "Auto" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">{item.label}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </LandingPreviewCard>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[34px] border border-emerald-100 bg-[linear-gradient(135deg,#0f172a_0%,#16352c_100%)] px-6 py-8 text-white shadow-[0_26px_80px_rgba(15,23,42,0.20)] sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Gati per testim
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Kerko trial dhe provo StockBase me biznesin tend.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                Per momentin aktivizimi i trial-it behet manualisht nga platforma. Na dergo kerkesen,
                trego llojin e biznesit dhe ne ta hapim workspace-in me trial 14 dite.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/trial"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
              >
                Kerko Trial
              </Link>
              <a
                href={`mailto:${supportEmail}?subject=StockBase%20Trial%20Request`}
                className="inline-flex items-center justify-center rounded-2xl border border-white/16 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15"
              >
                {supportEmail}
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function Home() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return <PublicLandingPage />;
  }

  if (isPlatformAdmin(currentUser)) {
    redirect("/platform/tenants");
  }

  if (!hasTenantAccess(currentUser)) {
    redirect("/subscription");
  }

  const tenant = currentUser.tenant;
  const tenantId = tenant?.id;

  if (!tenantId) {
    return null;
  }

  const tenantLabel = tenant.businessName ?? tenant.name;
  const catalogTemplate = getCatalogTemplate(tenant.catalogType);
  const currency = tenant.currency || "EUR";
  const canManageInventory = hasRole(currentUser, ["SUPER_ADMIN"]);
  const canCreateOrders = hasRole(currentUser, ["SUPER_ADMIN", "SELLER"]);
  const canManageOrders = hasRole(currentUser, ["SUPER_ADMIN", "SELLER", "WAREHOUSE"]);
  const canManageUsers = hasRole(currentUser, ["SUPER_ADMIN"]);
  const canViewReports = hasRole(currentUser, ["SUPER_ADMIN"]);

  const today = getDateStringInTimeZone(new Date(), BUSINESS_TIME_ZONE);
  const { start: dateFrom, end: dateTo } = getTimeZoneDayBounds(today, BUSINESS_TIME_ZONE);

  const [totalProducts, totalStockValueData, ordersToday, recentMovements, lowStockVariants] =
    await Promise.all([
      prisma.product.count({ where: { tenantId } }),
      prisma.variant.findMany({
        where: { tenantId },
        select: { stock: true, reorderLevel: true, price: true },
      }),
      prisma.order.count({
        where: {
          tenantId,
          createdAt: {
            gte: dateFrom,
            lt: dateTo,
          },
        },
      }),
      prisma.stockMovement.findMany({
        where: { tenantId },
        take: 4,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quantity: true,
          reason: true,
          createdAt: true,
          variant: {
            select: {
              sku: true,
              size: true,
              color: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.variant.findMany({
        where: { tenantId },
        select: {
          id: true,
          stock: true,
          reorderLevel: true,
          sku: true,
          color: true,
          size: true,
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ stock: "asc" }, { updatedAt: "asc" }],
      }),
    ]);

  const lowStockCount = totalStockValueData.filter((variant) =>
    isLowStock(variant.stock, variant.reorderLevel),
  ).length;

  const totalStockValue = totalStockValueData.reduce(
    (sum, variant) => sum + Number(variant.price) * variant.stock,
    0,
  );
  const totalStockUnits = totalStockValueData.reduce((sum, variant) => sum + variant.stock, 0);
  const lowStockItems = lowStockVariants
    .filter((variant) => isLowStock(variant.stock, variant.reorderLevel))
    .slice(0, 6);

  const tiles: ActionTile[] = [
    {
      title: "Produktet",
      subtitle: "Shiko dhe menaxho katalogun e tenant-it aktiv.",
      href: "/products",
      accent: "bg-[linear-gradient(135deg,#1d4ed8_0%,#2563eb_100%)]",
      pill: `${totalProducts.toLocaleString("sq-AL")} artikuj`,
      visible: true,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="M7 4h10v4H7zM6 10h12v10H6z" />
        </svg>
      ),
    },
    {
      title: "Shto Produkt",
      subtitle: "Regjistro produkte te reja sipas template-it aktiv.",
      href: "/products/new",
      accent: "bg-[linear-gradient(135deg,#16a34a_0%,#22c55e_100%)]",
      pill: catalogTemplate.label,
      visible: canManageInventory,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
    },
    {
      title: "Porosite",
      subtitle: "Ndiq porosite dhe shitjet e ditës për tenant-in aktiv.",
      href: "/orders",
      accent: "bg-[linear-gradient(135deg,#f59e0b_0%,#fb923c_100%)]",
      pill: ordersToday > 0 ? `${ordersToday} porosi sot` : "Nuk ka porosi sot",
      visible: canManageOrders,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="M7 6h10M7 12h10M7 18h6" />
        </svg>
      ),
    },
    {
      title: "Shto Porosi",
      subtitle: "Krijo shitje dhe porosi të reja pa dalë nga paneli.",
      href: "/orders/create",
      accent: "bg-[linear-gradient(135deg,#db2777_0%,#f43f5e_100%)]",
      pill: "Rrjedhë operative",
      visible: canCreateOrders,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
    },
    {
      title: "Hyrje Stoku",
      subtitle: "Shto mallin që hyn në depo ose kthehet nga klienti.",
      href: "/stock/incoming",
      accent: "bg-[linear-gradient(135deg,#7c3aed_0%,#9333ea_100%)]",
      pill: lowStockCount > 0 ? `${lowStockCount} variante me stok te ulet` : "Inventari ne gjendje te mire",
      visible: canManageInventory,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="m12 19 6-6M12 19l-6-6M12 5v14" />
        </svg>
      ),
    },
    {
      title: "Transfer Stoku",
      subtitle: "Leviz mallin nga nje depo ne tjetren pa ndryshuar stokun total.",
      href: "/stock/transfer",
      accent: "bg-[linear-gradient(135deg,#d97706_0%,#f59e0b_100%)]",
      pill: "Levizje mes depove",
      visible: canManageInventory,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="M7 7h10" />
          <path d="m13 3 4 4-4 4" />
          <path d="M17 17H7" />
          <path d="m11 21-4-4 4-4" />
        </svg>
      ),
    },
    {
      title: "Scan Barcode",
      subtitle: "Gjej direkt variantin nga barcode ose SKU dhe hap etiketat ose menaxhimin.",
      href: "/stock/scan",
      accent: "bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)]",
      pill: "Scan & gjej variantin",
      visible: canManageOrders,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="M5 7V5h2" />
          <path d="M17 5h2v2" />
          <path d="M19 17v2h-2" />
          <path d="M7 19H5v-2" />
          <path d="M9 5v14" />
          <path d="M12 5v14" />
          <path d="M15 5v14" />
        </svg>
      ),
    },
    {
      title: "Raportet",
      subtitle: "Shiko shitjet, burimet dhe performancen e muajit aktual.",
      href: "/reports",
      accent: "bg-[linear-gradient(135deg,#0891b2_0%,#06b6d4_100%)]",
      pill: "Shitjet dhe analiza",
      visible: canViewReports,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="M4 19h16" />
          <path d="M7 16V9" />
          <path d="M12 16V5" />
          <path d="M17 16v-3" />
        </svg>
      ),
    },
    {
      title: "Settings",
      subtitle: "Konfiguro tenant-in, katalogun dhe parametrat bazë.",
      href: "/settings",
      accent: "bg-[linear-gradient(135deg,#0f172a_0%,#334155_100%)]",
      pill: tenant.catalogType,
      visible: canManageUsers,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8 0 2 2 0 0 1 0-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 0-2.8 2 2 0 0 1 2.8 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 0 2 2 0 0 1 0 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
        </svg>
      ),
    },
  ];

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <div className="relative overflow-hidden rounded-[32px] bg-[#0b0b0b] px-7 py-8 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <div className="absolute right-6 top-6 h-28 w-28 rounded-full border border-white/10 bg-white/5" />
            <div className="absolute bottom-6 right-12 h-16 w-16 rounded-2xl border border-white/10 bg-white/5" />
            <div className="relative max-w-xl">
              <p className="text-sm font-medium text-white/60">{tenantLabel}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">{catalogTemplate.label}</h1>
              <p className="mt-4 text-sm leading-6 text-white/72">
                Inventari i tenant-it aktiv është i përditësuar. Keni {ordersToday} porosi
                të reja dhe {lowStockCount} variante që duan vëmendje.
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/50">
                {catalogTemplate.variantFocus}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/orders"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Shiko porosite
                </Link>
                {canManageInventory ? (
                  <Link
                    href="/products/new"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    Shto produkt
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-blue-100 bg-white px-6 py-7 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-medium text-slate-500">Vlera totale e stokut</p>
            <p className="mt-4 text-5xl font-semibold tracking-tight text-slate-950">
              {currency}{" "}
              {totalStockValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              {totalStockUnits.toLocaleString("sq-AL")} copë në stok
            </p>
          </div>
        </section>

        {canManageInventory ? (
          <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Low Stock / Reorder
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Variantet qe jane ne ose nen pragun e furnizimit.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/products?stock=low"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Shiko te gjitha
                </Link>
                <Link
                  href="/stock/incoming"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Shto hyrje stoku
                </Link>
              </div>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-slate-500">
                Nuk ka variante me stok te ulet per momentin.
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/80 text-left">
                      <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <th className="px-6 py-4">Produkti</th>
                        <th className="px-6 py-4">Varianti</th>
                        <th className="px-6 py-4">SKU</th>
                        <th className="px-6 py-4 text-right">Stoku</th>
                        <th className="px-6 py-4 text-right">Reorder</th>
                        <th className="px-6 py-4 text-right">Mungojne</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {lowStockItems.map((variant) => {
                        const reorderLevel = getEffectiveReorderLevel(variant.reorderLevel);
                        const missingUnits = Math.max(0, reorderLevel - variant.stock);

                        return (
                          <tr key={variant.id} className="hover:bg-slate-50/60">
                            <td className="px-6 py-4">
                              <Link
                                href={`/products/${variant.product.id}`}
                                className="font-medium text-slate-900 transition hover:text-slate-700"
                              >
                                {variant.product.brand
                                  ? `${variant.product.brand} ${variant.product.name}`
                                  : variant.product.name}
                              </Link>
                              <p className="mt-1 text-xs text-slate-500">{variant.product.category.name}</p>
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {variant.color} / {variant.size}
                            </td>
                            <td className="px-6 py-4 text-slate-600">{variant.sku ?? "-"}</td>
                            <td className="px-6 py-4 text-right font-semibold text-amber-700">
                              {variant.stock}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-700">{reorderLevel}</td>
                            <td className="px-6 py-4 text-right font-semibold text-rose-700">
                              {missingUnits}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 p-4 lg:hidden">
                  {lowStockItems.map((variant) => {
                    const reorderLevel = getEffectiveReorderLevel(variant.reorderLevel);
                    const missingUnits = Math.max(0, reorderLevel - variant.stock);

                    return (
                      <Link
                        key={variant.id}
                        href={`/products/${variant.product.id}`}
                        className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-white"
                      >
                        <p className="font-semibold text-slate-950">
                          {variant.product.brand
                            ? `${variant.product.brand} ${variant.product.name}`
                            : variant.product.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{variant.product.category.name}</p>
                        <p className="mt-3 text-sm text-slate-700">
                          {variant.color} / {variant.size}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                            Stoku {variant.stock}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                            Reorder {reorderLevel}
                          </span>
                          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                            Mungojne {missingUnits}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Veprimet kryesore
            </h2>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Tenant context
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tiles.map((tile) => (
              <ActionTile key={tile.title} {...tile} />
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Levizjet e fundit
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Hyrjet më të fundit të stokut për tenant-in aktiv
              </p>
            </div>
          </div>

          {recentMovements.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              Nuk ka ende levizje stoku te regjistruara.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/80 text-left">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-6 py-4">Produkti</th>
                    <th className="px-6 py-4">Varianti</th>
                    <th className="px-6 py-4 text-right">Sasia</th>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Arsyeja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {recentMovements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-slate-50/60">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{movement.variant.product.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          SKU {movement.variant.sku || "-"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {movement.variant.size || "-"} / {movement.variant.color}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                        +{movement.quantity}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Intl.DateTimeFormat("sq-AL", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(movement.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {movement.reason === "CUSTOMER_RETURN" ? "Kthim klienti" : "Hyrje stoku"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
