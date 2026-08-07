import type { Metadata } from "next";
import Link from "next/link";
import { hasRole, requireUser } from "@/lib/auth";
import { isLowStock } from "@/lib/inventory";
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
    <div className="group relative flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-ring/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}
        >
          {icon}
        </div>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 fill-none stroke-current stroke-[1.8] text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-foreground"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{subtitle}</p>
      <span className="mt-4 inline-flex w-fit items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
        {pill}
      </span>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl">
      {content}
    </Link>
  );
}

type StatCard = {
  label: string;
  value: string;
  hint: string;
  hintTone?: "neutral" | "success" | "warning";
  icon: React.ReactNode;
};

function StatCard({ label, value, hint, hintTone = "neutral", icon }: StatCard) {
  const toneClass =
    hintTone === "success"
      ? "bg-success-muted text-success-muted-foreground"
      : hintTone === "warning"
        ? "bg-warning-muted text-warning-muted-foreground"
        : "bg-secondary text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <span className={`mt-3 inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-medium ${toneClass}`}>
        {hint}
      </span>
    </div>
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

export default async function Home() {
  const currentUser = await requireUser();
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

  const [totalProducts, totalStockValueData, ordersToday, recentMovements] =
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
    ]);

  const lowStockCount = totalStockValueData.filter((variant) =>
    isLowStock(variant.stock, variant.reorderLevel),
  ).length;

  const totalStockValue = totalStockValueData.reduce(
    (sum, variant) => sum + Number(variant.price) * variant.stock,
    0,
  );
  const totalStockUnits = totalStockValueData.reduce((sum, variant) => sum + variant.stock, 0);

  const tiles: ActionTile[] = [
    {
      title: "Produktet",
      subtitle: "Shiko dhe menaxho katalogun e tenant-it aktiv.",
      href: "/products",
      accent: "bg-blue-50 text-blue-600",
      pill: `${totalProducts.toLocaleString("sq-AL")} artikuj`,
      visible: true,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M7 4h10v4H7zM6 10h12v10H6z" />
        </svg>
      ),
    },
    {
      title: "Shto Produkt",
      subtitle: "Regjistro produkte te reja sipas template-it aktiv.",
      href: "/products/new",
      accent: "bg-emerald-50 text-emerald-600",
      pill: catalogTemplate.label,
      visible: canManageInventory,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
    },
    {
      title: "Porosite",
      subtitle: "Ndiq porosite dhe shitjet e ditës për tenant-in aktiv.",
      href: "/orders",
      accent: "bg-amber-50 text-amber-600",
      pill: ordersToday > 0 ? `${ordersToday} porosi sot` : "Nuk ka porosi sot",
      visible: canManageOrders,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M7 6h10M7 12h10M7 18h6" />
        </svg>
      ),
    },
    {
      title: "Shto Porosi",
      subtitle: "Krijo shitje dhe porosi të reja pa dalë nga paneli.",
      href: "/orders/create",
      accent: "bg-rose-50 text-rose-600",
      pill: "Rrjedhë operative",
      visible: canCreateOrders,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M12 5v14M5 12h14" />
        </svg>
      ),
    },
    {
      title: "Hyrje Stoku",
      subtitle: "Shto mallin që hyn në depo ose kthehet nga klienti.",
      href: "/stock/incoming",
      accent: "bg-violet-50 text-violet-600",
      pill: lowStockCount > 0 ? `${lowStockCount} variante me stok te ulet` : "Inventari ne gjendje te mire",
      visible: canManageInventory,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="m12 19 6-6M12 19l-6-6M12 5v14" />
        </svg>
      ),
    },
    {
      title: "Transfer Stoku",
      subtitle: "Leviz mallin nga nje depo ne tjetren pa ndryshuar stokun total.",
      href: "/stock/transfer",
      accent: "bg-cyan-50 text-cyan-600",
      pill: "Levizje mes depove",
      visible: canManageInventory,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M7 7h10" />
          <path d="m13 3 4 4-4 4" />
          <path d="M17 17H7" />
          <path d="m11 21-4-4 4-4" />
        </svg>
      ),
    },
    {
      title: "Raportet",
      subtitle: "Shiko shitjet, burimet dhe performancen e muajit aktual.",
      href: "/reports",
      accent: "bg-teal-50 text-teal-600",
      pill: "Shitjet dhe analiza",
      visible: canViewReports,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
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
      accent: "bg-secondary text-foreground",
      pill: tenant.catalogType,
      visible: canManageUsers,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8 0 2 2 0 0 1 0-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 0-2.8 2 2 0 0 1 2.8 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 0 2 2 0 0 1 0 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
        </svg>
      ),
    },
  ];

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{tenantLabel}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl text-balance">
              {catalogTemplate.label}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">
              Inventari i tenant-it aktiv është i përditësuar. Keni {ordersToday} porosi
              të reja dhe {lowStockCount} variante që duan vëmendje.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Shiko porosite
            </Link>
            {canManageInventory ? (
              <Link
                href="/products/new"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Shto produkt
              </Link>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Vlera totale e stokut"
            value={`${currency} ${totalStockValue.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            hint={`${totalStockUnits.toLocaleString("sq-AL")} copë në stok`}
            hintTone="success"
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
          />
          <StatCard
            label="Produkte totale"
            value={totalProducts.toLocaleString("sq-AL")}
            hint={catalogTemplate.label}
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                <path d="M7 4h10v4H7zM6 10h12v10H6z" />
              </svg>
            }
          />
          <StatCard
            label="Porosi sot"
            value={ordersToday.toLocaleString("sq-AL")}
            hint={ordersToday > 0 ? "Aktivitet i ditës" : "Nuk ka porosi sot"}
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                <path d="M7 6h10M7 12h10M7 18h6" />
              </svg>
            }
          />
          <StatCard
            label="Stok i ulët"
            value={lowStockCount.toLocaleString("sq-AL")}
            hint={lowStockCount > 0 ? "Variante që duan vëmendje" : "Inventari në gjendje të mirë"}
            hintTone={lowStockCount > 0 ? "warning" : "success"}
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            }
          />
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Veprimet kryesore
            </h2>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tenant context
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tiles.map((tile) => (
              <ActionTile key={tile.title} {...tile} />
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Levizjet e fundit
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Hyrjet më të fundit të stokut për tenant-in aktiv
              </p>
            </div>
          </div>

          {recentMovements.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.6]">
                  <path d="M3 12h4l2-6 4 12 2-6h4" />
                </svg>
              </span>
              <p className="mt-4 text-sm font-medium text-foreground">
                Ende pa lëvizje stoku
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Sapo të regjistrohen hyrjet e para të stokut, do të shfaqen këtu.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3 sm:px-6">Produkti</th>
                    <th className="px-5 py-3 sm:px-6">Varianti</th>
                    <th className="px-5 py-3 text-right sm:px-6">Sasia</th>
                    <th className="px-5 py-3 sm:px-6">Data</th>
                    <th className="px-5 py-3 sm:px-6">Arsyeja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentMovements.map((movement) => (
                    <tr key={movement.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3.5 sm:px-6">
                        <p className="font-medium text-foreground">{movement.variant.product.name}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          SKU {movement.variant.sku || "-"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground sm:px-6">
                        {movement.variant.size || "-"} / {movement.variant.color}
                      </td>
                      <td className="px-5 py-3.5 text-right sm:px-6">
                        <span className="inline-flex items-center rounded-md bg-success-muted px-2 py-0.5 text-xs font-semibold text-success-muted-foreground">
                          +{movement.quantity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground sm:px-6">
                        {new Intl.DateTimeFormat("sq-AL", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(movement.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 sm:px-6">
                        <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {movement.reason === "CUSTOMER_RETURN" ? "Kthim klienti" : "Hyrje stoku"}
                        </span>
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
