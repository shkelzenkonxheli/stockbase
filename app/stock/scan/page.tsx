import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UploadedImage } from "@/app/components/uploaded-image";
import { CameraBarcodeScanner } from "@/app/stock/scan/camera-barcode-scanner";
import { requireRole } from "@/lib/auth";
import { Code39Barcode, isCode39ValueSupported } from "@/lib/code39-barcode";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Scan Barcode",
};

type ScanPageProps = {
  searchParams?: Promise<{
    code?: string;
  }>;
};

export default async function StockScanPage({ searchParams }: ScanPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN", "SELLER", "WAREHOUSE"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const code = resolvedSearchParams?.code?.trim().toUpperCase() ?? "";

  const variant = code
    ? await prisma.variant.findFirst({
        where: {
          tenantId,
          OR: [{ barcode: code }, { sku: code }],
        },
        select: {
          id: true,
          size: true,
          color: true,
          sku: true,
          barcode: true,
          stock: true,
          imagePath: true,
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
          inventories: {
            select: {
              stock: true,
              locationCode: true,
              warehouse: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              warehouse: {
                name: "asc",
              },
            },
          },
        },
      })
    : null;

  const canRenderBarcode = variant?.barcode ? isCode39ValueSupported(variant.barcode) : false;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Stock / Scan
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Scan Barcode
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
            Perdore scanner-in si tastiere ose kamerën e telefonit: sistemi gjen
            direkt variantin sipas barcode ose SKU.
          </p>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6">
          <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px]" method="GET">
            <input
              type="text"
              name="code"
              defaultValue={code}
              autoFocus
              placeholder="Skano ose shkruaj barcode / SKU"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-300"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Kerko
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Tip: shumica e scanner-ave e dergojne kodin dhe pastaj `Enter`, prandaj kjo faqe punon pa klik.
          </p>
        </section>

        <CameraBarcodeScanner initialCode={code} />

        {code && !variant ? (
          <section className="rounded-[30px] border border-rose-200 bg-rose-50 px-5 py-6 text-sm font-medium text-rose-700 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:px-6">
            Nuk u gjet asnje variant me kodin <span className="font-semibold">{code}</span>.
          </section>
        ) : null}

        {variant ? (
          <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100">
                {variant.imagePath ? (
                  <UploadedImage
                    src={variant.imagePath}
                    alt={variant.product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                    IMG
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Rezultati
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {variant.product.brand
                      ? `${variant.product.brand} ${variant.product.name}`
                      : variant.product.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {variant.product.category.name} • {variant.color} / {variant.size}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">SKU</p>
                    <p className="mt-1 break-all font-medium text-slate-900">{variant.sku || "-"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Barcode</p>
                    <p className="mt-1 break-all font-medium text-slate-900">{variant.barcode || "-"}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Stoku total</p>
                    <p className="mt-1 text-xl font-semibold text-emerald-800">{variant.stock}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Depo / lokacion</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      {variant.inventories.length > 0 ? (
                        variant.inventories.map((inventory) => (
                          <p key={`${inventory.warehouse.name}-${inventory.locationCode ?? "none"}`}>
                            {inventory.warehouse.name}: {inventory.stock}
                            {inventory.locationCode ? ` • Lok ${inventory.locationCode}` : ""}
                          </p>
                        ))
                      ) : (
                        <p>-</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  {canRenderBarcode && variant.barcode ? (
                    <Code39Barcode
                      value={variant.barcode}
                      height={40}
                      narrowBarWidth={1}
                      wideBarWidth={2.2}
                      className="h-20 w-full"
                    />
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Barcode preview s&apos;eshte gati
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/products/${variant.product.id}`}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Hap produktin
                  </Link>
                  <Link
                    href={`/products/${variant.product.id}/variants/${variant.id}/edit`}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Edito variantin
                  </Link>
                  <Link
                    href={`/products/${variant.product.id}/variants/${variant.id}/labels`}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Printo etiketa
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
