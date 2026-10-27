import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requireMultiWarehouseAccess } from "@/lib/inventory-module-access";
import { parseTenantCatalogConfig } from "@/lib/product-taxonomy";
import { prisma } from "@/lib/prisma";
import { parseStockTransferAdjustments } from "@/lib/stock-transfer";
import { createStockTransfer, revalidateStockTransferPaths } from "@/lib/stock-transfer-write";
import { getTenantWarehouses } from "@/lib/warehouses";
import { TransferStockForm } from "./transfer-stock-form";

export const metadata: Metadata = {
  title: "Transfer Stoku",
};

type TransferStockPageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

async function createTransfer(formData: FormData) {
  "use server";

  const currentUser = await requireMultiWarehouseAccess();
  const tenantId = currentUser.tenant?.id;

  const fromWarehouseId = Number(formData.get("fromWarehouseId"));
  const toWarehouseId = Number(formData.get("toWarehouseId"));
  const adjustments = parseStockTransferAdjustments(formData.get("adjustments")?.toString() ?? null);

  if (!tenantId || !Number.isSafeInteger(fromWarehouseId) || fromWarehouseId <= 0 ||
      !Number.isSafeInteger(toWarehouseId) || toWarehouseId <= 0 || !adjustments) {
    redirect("/stock/transfer?error=validation");
  }

  const result = await createStockTransfer({
    tenantId,
    userId: currentUser.id,
    fromWarehouseId,
    toWarehouseId,
    adjustments,
  });
  if (!result.ok) redirect(`/stock/transfer?error=${result.reason}`);

  revalidateStockTransferPaths(result.productIds);
  redirect("/stock/transfer?success=1");
}

function getMessage(error?: string, success?: string) {
  if (error === "validation") {
    return {
      type: "error" as const,
      text: "Zgjedh dy depo te ndryshme dhe te pakten nje variant me sasi valide.",
    };
  }

  if (error === "warehouse") {
    return {
      type: "error" as const,
      text: "Nje nga depot nuk eshte me aktive. Rifresko faqen dhe provo perseri.",
    };
  }

  if (error === "same-warehouse") {
    return {
      type: "error" as const,
      text: "Depoja burim dhe depoja destinacion duhet te jene te ndryshme.",
    };
  }

  if (error === "stock") {
    return {
      type: "error" as const,
      text: "Nuk ka stok te mjaftueshem ne depon burim per kete transfer.",
    };
  }

  if (error === "variant") {
    return {
      type: "error" as const,
      text: "Nje nga variantet nuk u gjet me. Rifresko faqen dhe provo perseri.",
    };
  }

  if (success === "1") {
    return {
      type: "success" as const,
      text: "Transferi i stokut u ruajt me sukses.",
    };
  }

  return null;
}

export default async function TransferStockPage({
  searchParams,
}: TransferStockPageProps) {
  const currentUser = await requireMultiWarehouseAccess();
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const message = getMessage(
    resolvedSearchParams?.error,
    resolvedSearchParams?.success,
  );

  const tenantSettings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { catalogConfig: true },
  });

  const warehouses = await getTenantWarehouses(
    tenantId,
    parseTenantCatalogConfig(tenantSettings?.catalogConfig),
  );

  return (
    <main className="min-h-screen bg-[#f8faf8] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-6xl">
        <Link href="/workspace" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-950">
          <span aria-hidden="true">&larr;</span> Te veprimet
        </Link>

        <div className="border-b border-emerald-950/10 pb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800">StockBase / Inventari</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Transfer i ri stoku</h1>
              <p className="mt-2 text-sm text-slate-600">Gjej variantet, cakto sasite dhe kontrollo transferin para ruajtjes.</p>
            </div>
            <Link href="/stock/incoming" className="rounded-xl border border-emerald-950/15 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">Hyrje stoku</Link>
          </div>
        </div>

        {message ? (
          <FlashMessage
            type={message.type}
            text={message.text}
            className="mt-6 rounded-2xl px-4 py-3 text-sm shadow-sm"
          />
        ) : null}

        <TransferStockForm
          action={createTransfer}
          warehouses={warehouses.map((warehouse) => ({
            id: warehouse.id,
            name: warehouse.name,
          }))}
        />
      </section>
    </main>
  );
}
