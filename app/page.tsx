import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasRole, hasTenantAccess, isPlatformAdmin } from "@/lib/auth";
import { LowStockModal } from "@/app/dashboard/low-stock-modal";
import { RecentMovementsModal } from "@/app/dashboard/recent-movements-modal";
import { getEffectiveReorderLevel } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { getCatalogTemplate, getPosConfig, getPurchasesConfig } from "@/lib/product-taxonomy";
import { MarketingHomepage } from "@/app/marketing/marketing-homepage";

const BUSINESS_TIME_ZONE = "Europe/Belgrade";
const movementDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

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
      className="group relative flex h-full min-h-[148px] flex-col rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_16px_34px_rgba(15,23,42,0.10)]"
    >
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm ${accent}`}>
        {icon}
      </div>
      <h2 className="text-base font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-1.5 max-w-[260px] text-sm leading-5 text-slate-500">{subtitle}</p>
      <span className="mt-auto inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
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

function PublicLandingPage() {
  return <MarketingHomepage supportEmail={getSupportEmail()} />;
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
  const posEnabled = getPosConfig(tenant.catalogConfig).enabled;
  const purchasesEnabled = getPurchasesConfig(tenant.catalogConfig).enabled;

  const today = getDateStringInTimeZone(new Date(), BUSINESS_TIME_ZONE);
  const { start: dateFrom, end: dateTo } = getTimeZoneDayBounds(today, BUSINESS_TIME_ZONE);

  const [
    totalProducts,
    stockSummaryRows,
    ordersToday,
    recentMovements,
    lowStockVariants,
    todaySalesRows,
    ordersNeedingAction,
    posPaymentsToday,
    openPurchaseOrders,
  ] =
    await Promise.all([
      prisma.product.count({ where: { tenantId } }),
      prisma.$queryRaw<Array<{ lowCount: bigint; units: bigint; value: string | number }>>`
        SELECT COUNT(*) FILTER (WHERE stock > 0 AND stock <= CASE WHEN "reorderLevel" >= 0 THEN "reorderLevel" ELSE 5 END) AS "lowCount",
               COALESCE(SUM(stock), 0) AS units,
               COALESCE(SUM(stock * price), 0) AS value
        FROM "Variant" WHERE "tenantId" = ${tenantId}
      `,
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
        take: 8,
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
      prisma.$queryRaw<Array<{ id: number; stock: number; reorderLevel: number | null; sku: string | null; color: string | null; size: string | null; productId: number; productName: string; brand: string | null; categoryName: string }>>`
        SELECT v.id, v.stock, v."reorderLevel", v.sku, v.color, v.size,
               p.id AS "productId", p.name AS "productName", p.brand, c.name AS "categoryName"
        FROM "Variant" v
        JOIN "Product" p ON p.id = v."productId"
        JOIN "Category" c ON c.id = p."categoryId"
        WHERE v."tenantId" = ${tenantId}
          AND v.stock > 0
          AND v.stock <= CASE WHEN v."reorderLevel" >= 0 THEN v."reorderLevel" ELSE 5 END
        ORDER BY v.stock ASC, v."updatedAt" ASC
      `,
      prisma.$queryRaw<Array<{ units: bigint; revenue: string | number; cost: string | number }>>`
        SELECT COALESCE(SUM(GREATEST(0, oi.quantity - oi."returnedQuantity")), 0) AS units,
               COALESCE(SUM(oi."unitPrice" * GREATEST(0, oi.quantity - oi."returnedQuantity")), 0) AS revenue,
               COALESCE(SUM(oi."unitCost" * GREATEST(0, oi.quantity - oi."returnedQuantity")), 0) AS cost
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."tenantId" = ${tenantId}
          AND o.status IN ('DONE', 'PARTIALLY_RETURNED')
          AND o."createdAt" >= ${dateFrom} AND o."createdAt" < ${dateTo}
      `,
      prisma.order.count({
        where: { tenantId, status: { in: ["NEW", "READY"] } },
      }),
      posEnabled
        ? prisma.posPayment.groupBy({
            by: ["method"],
            where: { tenantId, createdAt: { gte: dateFrom, lt: dateTo } },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
      purchasesEnabled
        ? prisma.purchaseOrder.count({
            where: { tenantId, status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] } },
          })
        : Promise.resolve(0),
    ]);

  const lowStockCount = Number(stockSummaryRows[0]?.lowCount ?? 0);
  const totalStockValue = Number(stockSummaryRows[0]?.value ?? 0);
  const totalStockUnits = Number(stockSummaryRows[0]?.units ?? 0);
  const todaySales = {
    units: Number(todaySalesRows[0]?.units ?? 0),
    revenue: Number(todaySalesRows[0]?.revenue ?? 0),
    cost: Number(todaySalesRows[0]?.cost ?? 0),
  };
  const grossProfit = todaySales.revenue - todaySales.cost;
  const profitMargin = todaySales.revenue > 0 ? (grossProfit / todaySales.revenue) * 100 : 0;
  const cashSales = Number(
    posPaymentsToday.find((payment) => payment.method === "CASH")?._sum.amount ?? 0,
  );
  const cardSales = Number(
    posPaymentsToday.find((payment) => payment.method === "CARD")?._sum.amount ?? 0,
  );
  const lowStockItems = lowStockVariants
    .map((variant) => {
      const reorderLevel = getEffectiveReorderLevel(variant.reorderLevel);

      return {
        id: variant.id,
        productId: variant.productId,
        productName: variant.productName,
        brand: variant.brand,
        categoryName: variant.categoryName,
        color: variant.color,
        size: variant.size,
        sku: variant.sku,
        stock: variant.stock,
        reorderLevel,
        missingUnits: Math.max(0, reorderLevel - variant.stock),
      };
    });
  const recentMovementItems = recentMovements.map((movement) => ({
    id: movement.id,
    productName: movement.variant.product.name,
    sku: movement.variant.sku,
    size: movement.variant.size,
    color: movement.variant.color,
    quantity: movement.quantity,
    reason: movement.reason,
    // Format on the server so Node and the browser cannot disagree during hydration.
    createdAtLabel: movementDateFormatter.format(movement.createdAt),
  }));

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
      subtitle: "Ndiq porosite dhe shitjet e dites per tenant-in aktiv.",
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
      subtitle: "Krijo shitje dhe porosi te reja pa dale nga paneli.",
      href: "/orders/create",
      accent: "bg-[linear-gradient(135deg,#db2777_0%,#f43f5e_100%)]",
      pill: "Rrjedhe operative",
      visible: canCreateOrders,
      icon: (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
    },
    {
      title: "Hyrje Stoku",
      subtitle: "Shto mallin qe hyn ne depo ose kthehet nga klienti.",
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
      subtitle: "Konfiguro tenant-in, katalogun dhe parametrat baze.",
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
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <div className="relative overflow-hidden rounded-[30px] border border-emerald-100 bg-[linear-gradient(118deg,#061b1a_0%,#0c3831_58%,#0e5a4e_100%)] px-7 py-7 text-white shadow-[0_22px_52px_rgba(6,40,35,0.18)]">
            <div className="absolute right-6 top-6 h-28 w-28 rounded-full border border-white/10 bg-white/5" />
            <div className="absolute bottom-6 right-12 h-16 w-16 rounded-2xl border border-white/10 bg-white/5" />
            <div className="relative max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Dashboard operativ</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Mire se erdhe, {currentUser.name}</h1>
              <p className="mt-4 text-sm leading-6 text-white/72">
                Inventari i tenant-it aktiv eshte i perditesuar. Keni {ordersToday} porosi
                te reja dhe {lowStockCount} variante qe duan vemendje.
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/50">{tenantLabel} / {catalogTemplate.label}</p>
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

          <div className="rounded-[30px] border border-slate-200 bg-white px-6 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vlera e stokut</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              {currency}{" "}
              {totalStockValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              {totalStockUnits.toLocaleString("sq-AL")} cope ne stok
            </p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/orders" className="rounded-[22px] border border-emerald-100 bg-emerald-50/70 p-5 shadow-[0_10px_26px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:bg-emerald-50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Shitjet sot</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{currency} {todaySales.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="mt-1 text-sm text-slate-500">{todaySales.units} artikuj te perfunduar</p>
          </Link>
          {canViewReports ? (
            <Link href="/reports" className="rounded-[22px] border border-cyan-100 bg-cyan-50/60 p-5 shadow-[0_10px_26px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:bg-cyan-50">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">Fitimi bruto</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{currency} {grossProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="mt-1 text-sm text-slate-500">Marzha {profitMargin.toFixed(1)}%</p>
            </Link>
          ) : null}
          <Link href="/orders" className="rounded-[22px] border border-amber-100 bg-amber-50/70 p-5 shadow-[0_10px_26px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:bg-amber-50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Per veprim</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{ordersNeedingAction}</p>
            <p className="mt-1 text-sm text-slate-500">Porosi NEW ose READY</p>
          </Link>
          <Link href="/products?stock=low" className="rounded-[22px] border border-rose-100 bg-rose-50/60 p-5 shadow-[0_10px_26px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:bg-rose-50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">Stok i ulet</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{lowStockCount}</p>
            <p className="mt-1 text-sm text-slate-500">Variante qe kerkojne furnizim</p>
          </Link>
        </section>

        {(posEnabled || purchasesEnabled) ? (
          <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inventari</p>
              <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
                <div><p className="text-2xl font-semibold tracking-tight text-slate-950">{totalStockUnits.toLocaleString("sq-AL")}</p><p className="mt-1 text-sm text-slate-500">Njesi ne stok</p></div>
                <div className="border-l border-slate-200 pl-6"><p className="text-2xl font-semibold text-slate-950">{totalProducts.toLocaleString("sq-AL")}</p><p className="mt-1 text-sm text-slate-500">Produkte aktive</p></div>
              </div>
            </div>
            <div className="rounded-[22px] border border-slate-800 bg-slate-950 p-5 text-white shadow-[0_10px_26px_rgba(15,23,42,0.12)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">Modulet operative</p>
              {posEnabled ? <div className="mt-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3"><div><p className="font-semibold">POS sot</p><p className="mt-1 text-xs text-white/55">Cash {currency} {cashSales.toFixed(2)} / Karte {currency} {cardSales.toFixed(2)}</p></div><Link href="/pos" className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-emerald-950">Hap POS</Link></div> : null}
              {purchasesEnabled ? <div className={posEnabled ? "pt-3" : "mt-3"}><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Purchase orders</p><p className="mt-1 text-xs text-white/55">{openPurchaseOrders} ne pritje te pranimit</p></div><Link href="/purchases" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white">Shiko</Link></div></div> : null}
            </div>
          </section>
        ) : null}

        {canManageInventory ? (
          <section className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2]"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="m10.3 4.5-7 12.1A2 2 0 0 0 5 19.5h14a2 2 0 0 0 1.7-2.9l-7-12.1a2 2 0 0 0-3.4 0Z" /></svg>
              </span>
              <div>
                <p className="font-semibold text-slate-950">Low stock / Reorder</p>
                <p className="mt-0.5 text-sm text-slate-500">Shiko variantet qe kerkojne furnizim.</p>
              </div>
            </div>
            <LowStockModal items={lowStockItems} />
          </section>
        ) : null}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Shkurtore</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Veprimet kryesore</h2>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Qasje e shpejte
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => (
              <ActionTile key={tile.title} {...tile} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2]"><path d="M12 6v6l4 2" /><circle cx="12" cy="12" r="8" /></svg>
            </span>
            <div>
              <p className="font-semibold text-slate-950">Levizjet e fundit</p>
              <p className="mt-0.5 text-sm text-slate-500">Hyrjet, kthimet dhe transferet e fundit te stokut.</p>
            </div>
          </div>
          <RecentMovementsModal movements={recentMovementItems} />
        </section>      </div>
    </main>
  );
}
