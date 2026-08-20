import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getPrintableOrdersByDate,
  printableOrderStatusLabels,
  type PrintableOrderStatus,
} from "@/lib/order-printing";
import { OrderPrintSheet } from "../order-print-sheet";

type OrdersPrintPageProps = {
  searchParams?: Promise<{
    date?: string;
    status?: string;
    source?: string;
    q?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Printo porosite",
};

function getDateStringInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

export default async function OrdersPrintPage({
  searchParams,
}: OrdersPrintPageProps) {
  const currentUser = await requireUser();
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawDate = resolvedSearchParams?.date?.trim() ?? "";
  const rawStatus = resolvedSearchParams?.status?.trim() ?? "";
  const rawSource = resolvedSearchParams?.source?.trim() ?? "";
  const rawQuery = resolvedSearchParams?.q?.trim() ?? "";
  const defaultDate = getDateStringInTimeZone(new Date(), "Europe/Belgrade");
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : defaultDate;
  const selectedStatus =
    rawStatus && rawStatus in printableOrderStatusLabels
      ? (rawStatus as PrintableOrderStatus)
      : null;
  const selectedSource =
    rawSource && ["INSTAGRAM", "STORE", "WHOLESALE"].includes(rawSource)
      ? (rawSource as "INSTAGRAM" | "STORE" | "WHOLESALE")
      : null;

  const orders = await getPrintableOrdersByDate(selectedDate, tenantId, {
    status: selectedStatus,
    source: selectedSource,
    query: rawQuery || null,
  });
  const statusLabel = selectedStatus ? printableOrderStatusLabels[selectedStatus] : "Te gjitha";
  const sourceLabel = selectedSource ?? "Te gjitha";
  const queryLabel = rawQuery || "-";

  return (
    <OrderPrintSheet
      title={`Porosite e dates ${selectedDate}`}
      subtitle={`Lista e printimit per daten ${selectedDate} · Status: ${statusLabel} · Burimi: ${sourceLabel} · Search: ${queryLabel}`}
      orders={orders}
    />
  );
}
