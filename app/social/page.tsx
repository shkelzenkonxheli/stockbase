import type { Metadata } from "next";
import Link from "next/link";
import { SocialPublisher } from "./social-publisher";
import { requireSocialMediaAccess } from "@/lib/inventory-module-access";
import { prisma } from "@/lib/prisma";
import { parseTenantCatalogConfig } from "@/lib/product-taxonomy";

export const metadata: Metadata = {
  title: "Social Media",
};

export default async function SocialMediaPage({ searchParams }: { searchParams?: Promise<{ error?: string; success?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const currentUser = await requireSocialMediaAccess();
  const tenantId = currentUser.tenant!.id;
  const variants = await prisma.variant.findMany({
    where: {
      tenantId,
      imagePath: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      imagePath: true,
      price: true,
      color: true,
      size: true,
      product: { select: { name: true, brand: true } },
    },
  });
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { catalogConfig: true } });
  const instagram = parseTenantCatalogConfig(settings?.catalogConfig)?.socialMedia?.instagram;

  const metaConfigured = Boolean(
      process.env.INSTAGRAM_APP_ID &&
      process.env.INSTAGRAM_APP_SECRET &&
      process.env.INSTAGRAM_REDIRECT_URI,
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[28px] border border-fuchsia-100 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.14),transparent_36%),linear-gradient(135deg,#ffffff_0%,#fdf4ff_100%)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-700">Social Media</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Instagram content studio</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Zgjedh fotot reale te produkteve, pergatit caption-in dhe publiko postime ose Story nga StockBase.
            </p>
          </div>
          <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${instagram ? "border-emerald-200 bg-emerald-50 text-emerald-800" : metaConfigured ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600"}`}>
            {instagram ? `Instagram i lidhur${instagram.username ? `: @${instagram.username}` : ""}` : metaConfigured ? "Gati per lidhje Instagram" : "Kerkon konfigurim Meta"}
          </span>
        </div>
      </section>

      <section className="mt-6">
        <details className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">{instagram ? "Menaxho lidhjen Instagram" : "Lidh Instagram"}</summary>
          <div className="mt-5">
          {params.error ? <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Lidhja deshtoi. {params.error === "instagram-page" ? "Lidh Instagram Creator me nje Facebook Page dhe provo perseri." : "Kontrollo konfigurimin Meta dhe provo perseri."}</p> : null}
          <p className="text-lg font-semibold tracking-tight text-slate-950">Lidh Instagram</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Kerkohet nje llogari Instagram Business ose Creator dhe nje Meta App e verifikuar per content publishing.
          </p>
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <div className="rounded-2xl bg-slate-50 p-4"><b className="block text-slate-950">1. Meta App</b><span className="mt-1 block text-slate-500">Vendos credentials ne environment variables.</span></div>
            <div className="rounded-2xl bg-slate-50 p-4"><b className="block text-slate-950">2. Instagram Business</b><span className="mt-1 block text-slate-500">Lidhet me OAuth nga ky tenant.</span></div>
            <div className="rounded-2xl bg-slate-50 p-4"><b className="block text-slate-950">3. Post ose Story</b><span className="mt-1 block text-slate-500">Zgjedh foto, caption dhe publikon me audit log.</span></div>
          </div>
          {metaConfigured ? <div className="mt-6 grid gap-2"><Link href="/api/social/instagram/connect" className="block w-full rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800">Lidh Instagram</Link><Link href="/api/social/instagram/test-connect" className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Perdor test token</Link></div> : <button type="button" disabled className="mt-6 w-full rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500">Mungon konfigurimi Meta</button>}
          </div>
        </details>
      </section>
      <div className="mt-6"><SocialPublisher variants={variants.map((variant) => ({ id: variant.id, imagePath: variant.imagePath!, name: variant.product.name, brand: variant.product.brand, color: variant.color, size: variant.size, price: String(variant.price) }))} /></div>
    </main>
  );
}
