import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrintableOrderById } from "@/lib/order-printing";
import { OrderPrintSheet } from "../../order-print-sheet";

type OrderPrintPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const metadata: Metadata = {
  title: "Printo porosine",
};

export default async function OrderPrintPage({ params }: OrderPrintPageProps) {
  const currentUser = await requireUser();
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    notFound();
  }

  const resolvedParams = await params;
  const orderId = Number(resolvedParams.id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    notFound();
  }

  const order = await getPrintableOrderById(orderId, tenantId);

  if (!order) {
    notFound();
  }

  return (
    <OrderPrintSheet
      title={`Porosia #${order.id}`}
      subtitle={`${order.customerName} · ${order.createdAtDateLabel}`}
      orders={[order]}
    />
  );
}
