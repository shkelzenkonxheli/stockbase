import { prisma } from "@/lib/prisma";

export const BUSINESS_TIME_ZONE = "Europe/Belgrade";

export function getMonthStringInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  });

  return formatter.format(date).slice(0, 7);
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
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
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

export function getTimeZoneMonthBounds(monthString: string, timeZone: string) {
  const [year, month] = monthString.split("-").map(Number);
  const startApprox = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endApprox = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const startOffset = getTimeZoneOffsetMs(startApprox, timeZone);
  const endOffset = getTimeZoneOffsetMs(endApprox, timeZone);

  return {
    start: new Date(startApprox.getTime() - startOffset),
    end: new Date(endApprox.getTime() - endOffset),
  };
}

export type MonthlySalesReport = {
  selectedMonth: string;
  monthLabel: string;
  ordersCount: number;
  totalPairs: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  averageItemsPerOrder: number;
  averageOrderValue: number;
  activeModelsCount: number;
  topSourceLabel: string | null;
  topSourceQuantity: number;
  topSourceRevenue: number;
  sourceBreakdown: Array<{
    source: string;
    label: string;
    quantity: number;
    revenue: number;
  }>;
  topModels: Array<{
    brand: string;
    name: string;
    quantity: number;
    imagePath: string | null;
    status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  }>;
  topBrands: Array<{ brand: string; quantity: number }>;
  dailySales: Array<{ date: string; quantity: number; revenue: number }>;
};

export async function getMonthlySalesReport(selectedMonth: string, tenantId: number) {
  const { start: monthFrom, end: monthTo } = getTimeZoneMonthBounds(
    selectedMonth,
    BUSINESS_TIME_ZONE,
  );

  const [ordersCount, orderItems] = await Promise.all([
    prisma.order.count({
      where: {
        tenantId,
        status: {
          in: ["DONE", "PARTIALLY_RETURNED"],
        },
        createdAt: {
          gte: monthFrom,
          lt: monthTo,
        },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          tenantId,
          status: {
            in: ["DONE", "PARTIALLY_RETURNED"],
          },
          createdAt: {
            gte: monthFrom,
            lt: monthTo,
          },
        },
      },
      select: {
        quantity: true,
        returnedQuantity: true,
        unitPrice: true,
        unitCost: true,
        order: {
          select: {
            source: true,
            createdAt: true,
          },
        },
        variant: {
          select: {
            imagePath: true,
            productId: true,
            product: {
              select: {
                name: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const totalPairs = orderItems.reduce(
    (sum, item) => sum + Math.max(0, item.quantity - item.returnedQuantity),
    0,
  );
  const totalRevenue = orderItems.reduce(
    (sum, item) =>
      sum + Math.max(0, item.quantity - item.returnedQuantity) * Number(item.unitPrice),
    0,
  );
  const totalCost = orderItems.reduce(
    (sum, item) =>
      sum + Math.max(0, item.quantity - item.returnedQuantity) * Number(item.unitCost),
    0,
  );
  const grossProfit = totalRevenue - totalCost;
  const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const sourceMap = orderItems.reduce(
    (acc, item) => {
      const current = acc[item.order.source] ?? { quantity: 0, revenue: 0 };
      const netQuantity = Math.max(0, item.quantity - item.returnedQuantity);
      current.quantity += netQuantity;
      current.revenue += netQuantity * Number(item.unitPrice);
      acc[item.order.source] = current;
      return acc;
    },
    {} as Record<string, { quantity: number; revenue: number }>,
  );

  const sourceLabels: Record<string, string> = {
    INSTAGRAM: "Instagram",
    STORE: "Shitore",
    WHOLESALE: "Shumice",
  };

  const topSourceEntry =
    Object.entries(sourceMap).sort((a, b) => b[1].quantity - a[1].quantity)[0] ?? null;

  const modelMap = orderItems.reduce(
    (acc, item) => {
      const key = `${item.variant.product.category.name}|||${item.variant.product.name}`;
      const current = acc.get(key) ?? {
        brand: item.variant.product.category.name,
        name: item.variant.product.name,
        quantity: 0,
        imagePath: item.variant.imagePath ?? null,
        productId: item.variant.productId,
      };
      current.quantity += Math.max(0, item.quantity - item.returnedQuantity);
      if (!current.imagePath && item.variant.imagePath) {
        current.imagePath = item.variant.imagePath;
      }
      acc.set(key, current);
      return acc;
    },
    new Map<
      string,
      {
        brand: string;
        name: string;
        quantity: number;
        imagePath: string | null;
        productId: number;
      }
    >(),
  );

  const brandMap = orderItems.reduce(
    (acc, item) => {
      const key = item.variant.product.category.name;
      acc.set(key, (acc.get(key) ?? 0) + Math.max(0, item.quantity - item.returnedQuantity));
      return acc;
    },
    new Map<string, number>(),
  );

  const dailyMap = orderItems.reduce(
    (acc, item) => {
      const key = new Intl.DateTimeFormat("sq-AL", {
        timeZone: BUSINESS_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
      }).format(item.order.createdAt);

      const current = acc.get(key) ?? { quantity: 0, revenue: 0 };
      const netQuantity = Math.max(0, item.quantity - item.returnedQuantity);
      current.quantity += netQuantity;
      current.revenue += netQuantity * Number(item.unitPrice);
      acc.set(key, current);
      return acc;
    },
    new Map<string, { quantity: number; revenue: number }>(),
  );

  const productIds = [...new Set([...modelMap.values()].map((item) => item.productId))];
  const relatedProducts = productIds.length
    ? await prisma.product.findMany({
        where: {
          tenantId,
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
          variants: {
            select: {
              stock: true,
            },
          },
        },
      })
    : [];

  const productStatusMap = new Map<
    number,
    "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"
  >(
    relatedProducts.map((product) => {
      const totalStock = product.variants.reduce(
        (sum, variant) => sum + variant.stock,
        0,
      );
      const lowStockVariants = product.variants.filter(
        (variant) => variant.stock > 0 && variant.stock <= 3,
      ).length;

      if (totalStock <= 0) {
        return [product.id, "OUT_OF_STOCK"];
      }

      if (totalStock <= 6 || lowStockVariants > 0) {
        return [product.id, "LOW_STOCK"];
      }

      return [product.id, "IN_STOCK"];
    }),
  );

  const topModels = [...modelMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .map((item) => ({
      brand: item.brand,
      name: item.name,
      quantity: item.quantity,
      imagePath: item.imagePath,
      status: productStatusMap.get(item.productId) ?? "IN_STOCK",
    }));

  const sourceBreakdown = (["INSTAGRAM", "STORE", "WHOLESALE"] as const).map(
    (source) => ({
      source,
      label: sourceLabels[source],
      quantity: sourceMap[source]?.quantity ?? 0,
      revenue: sourceMap[source]?.revenue ?? 0,
    }),
  );

  const topBrands = [...brandMap.entries()]
    .map(([brand, quantity]) => ({ brand, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const dailySales = [...dailyMap.entries()]
    .map(([date, values]) => ({
      date,
      quantity: values.quantity,
      revenue: values.revenue,
    }))
    .sort((a, b) => {
      const [aday, amonth] = a.date.split(".").map(Number);
      const [bday, bmonth] = b.date.split(".").map(Number);
      return amonth - bmonth || aday - bday;
    });

  const monthLabel = new Intl.DateTimeFormat("sq-AL", {
    timeZone: BUSINESS_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(`${selectedMonth}-01T12:00:00Z`));

  return {
    selectedMonth,
    monthLabel,
    ordersCount,
    totalPairs,
    totalRevenue,
    totalCost,
    grossProfit,
    grossMarginPercent,
    averageItemsPerOrder: ordersCount > 0 ? totalPairs / ordersCount : 0,
    averageOrderValue: ordersCount > 0 ? totalRevenue / ordersCount : 0,
    activeModelsCount: modelMap.size,
    topSourceLabel: topSourceEntry ? sourceLabels[topSourceEntry[0]] : null,
    topSourceQuantity: topSourceEntry?.[1].quantity ?? 0,
    topSourceRevenue: topSourceEntry?.[1].revenue ?? 0,
    sourceBreakdown,
    topModels,
    topBrands,
    dailySales,
  } satisfies MonthlySalesReport;
}
