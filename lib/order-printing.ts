import { prisma } from "@/lib/prisma";

export const ORDER_PRINT_TIME_ZONE = "Europe/Belgrade";

export type PrintableOrderItem = {
  id: number;
  name: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  material?: string | null;
  powerWatts?: string | null;
  warehouseName?: string | null;
  locationCode?: string | null;
  imagePath?: string | null;
  quantity: number;
  returnedQuantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type PrintableOrder = {
  id: number;
  customerName: string;
  phone: string;
  instagram: string | null;
  source: "INSTAGRAM" | "STORE" | "WHOLESALE";
  status: "NEW" | "READY" | "DONE" | "PARTIALLY_RETURNED" | "CANCELED" | "RETURNED";
  notes: string | null;
  createdAt: Date;
  createdAtDateLabel: string;
  createdAtTimeLabel: string;
  totalActiveQuantity: number;
  totalReturnedQuantity: number;
  totalAmount: number;
  items: PrintableOrderItem[];
};

export type PrintableOrderStatus =
  | "NEW"
  | "READY"
  | "DONE"
  | "PARTIALLY_RETURNED"
  | "CANCELED"
  | "RETURNED";

export const orderSourceLabels: Record<PrintableOrder["source"], string> = {
  INSTAGRAM: "Instagram",
  STORE: "Shitore",
  WHOLESALE: "Shumice",
};

export const printableOrderStatusLabels: Record<PrintableOrderStatus, string> = {
  NEW: "New",
  READY: "Ready",
  DONE: "Done",
  PARTIALLY_RETURNED: "Partially returned",
  CANCELED: "Canceled",
  RETURNED: "Returned",
};

type RawPrintableOrder = {
  id: number;
  customerName: string;
  phone: string;
  instagram: string | null;
  source: PrintableOrder["source"];
  status: PrintableOrder["status"];
  notes: string | null;
  createdAt: Date;
  items: Array<{
    id: number;
    quantity: number;
    returnedQuantity: number;
    unitPrice: unknown;
    variant: {
      size: string;
      color: string;
      material: string | null;
      powerWatts: string | null;
      locationCode: string | null;
      imagePath: string | null;
      product: {
        name: string;
        brand: string | null;
        warehouseName: string | null;
        category: {
          name: string;
        };
      };
    };
  }>;
};

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

export function getTimeZoneDayBounds(dateString: string, timeZone: string) {
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

function normalizeOrder(order: RawPrintableOrder): PrintableOrder {
  const dateFormatter = new Intl.DateTimeFormat("sq-AL", {
    timeZone: ORDER_PRINT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("sq-AL", {
    timeZone: ORDER_PRINT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const items = order.items.map((item) => {
    const lineTotal = item.quantity * Number(item.unitPrice);
    return {
      id: item.id,
      name: item.variant.product.name,
      brand: item.variant.product.brand ?? "",
      category: item.variant.product.category.name,
      size: item.variant.size,
      color: item.variant.color,
      material: item.variant.material,
      powerWatts: item.variant.powerWatts,
      warehouseName: item.variant.product.warehouseName ?? null,
      locationCode: item.variant.locationCode,
      imagePath: item.variant.imagePath,
      quantity: item.quantity,
      returnedQuantity: item.returnedQuantity,
      unitPrice: Number(item.unitPrice),
      lineTotal,
    } satisfies PrintableOrderItem;
  });

  return {
    id: order.id,
    customerName: order.customerName,
    phone: order.phone,
    instagram: order.instagram,
    source: order.source,
    status: order.status,
    notes: order.notes,
    createdAt: order.createdAt,
    createdAtDateLabel: dateFormatter.format(order.createdAt),
    createdAtTimeLabel: timeFormatter.format(order.createdAt),
    totalActiveQuantity: items.reduce(
      (sum, item) => sum + Math.max(0, item.quantity - item.returnedQuantity),
      0,
    ),
    totalReturnedQuantity: items.reduce((sum, item) => sum + item.returnedQuantity, 0),
    totalAmount: items.reduce(
      (sum, item) => sum + Math.max(0, item.quantity - item.returnedQuantity) * item.unitPrice,
      0,
    ),
    items,
  };
}

const orderPrintSelect = {
  id: true,
  customerName: true,
  phone: true,
  instagram: true,
  source: true,
  status: true,
  notes: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      quantity: true,
      returnedQuantity: true,
      unitPrice: true,
      variant: {
        select: {
          size: true,
          color: true,
          material: true,
          powerWatts: true,
          locationCode: true,
          imagePath: true,
          product: {
            select: {
              name: true,
              brand: true,
              warehouseName: true,
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
  },
} as const;

export async function getPrintableOrderById(orderId: number, tenantId: number) {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
      tenantId,
    },
    select: orderPrintSelect,
  });

  if (!order) {
    return null;
  }

  return normalizeOrder(order as RawPrintableOrder);
}

export async function getPrintableOrdersByDate(
  dateString: string,
  tenantId: number,
  filters?: {
    status?: PrintableOrderStatus | null;
    source?: PrintableOrder["source"] | null;
    query?: string | null;
  },
) {
  const { start, end } = getTimeZoneDayBounds(dateString, ORDER_PRINT_TIME_ZONE);
  const trimmedQuery = filters?.query?.trim() ?? "";

  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.source ? { source: filters.source } : {}),
      ...(trimmedQuery
        ? {
            OR: [
              {
                customerName: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
              {
                phone: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
              {
                instagram: {
                  contains: trimmedQuery,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
      createdAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: [{ createdAt: "asc" }],
    select: orderPrintSelect,
  });

  return orders.map((order) =>
    normalizeOrder(order as RawPrintableOrder),
  );
}
