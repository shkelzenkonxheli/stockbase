import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export function AppScreenshot({ src, alt, width, height, label }: { src: string; alt: string; width: number; height: number; label: string }) {
  return (
    <figure className="min-w-0 max-w-full overflow-hidden rounded-[22px] border border-emerald-950/10 bg-white shadow-[0_24px_70px_rgba(15,45,35,0.12)]">
      <div className="flex h-10 items-center gap-1.5 border-b border-slate-100 bg-[#f8faf8] px-4">
        <span className="h-2 w-2 rounded-full bg-rose-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-3 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">StockBase / {label}</span>
      </div>
      <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label} screenshot in full size`} className="block focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
        <Image src={src} alt={alt} width={width} height={height} sizes="(max-width: 1280px) 100vw, 1280px" className="block h-auto w-full" />
      </a>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        <span>Real StockBase interface</span>
        <a href={src} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 underline-offset-2 hover:underline">View full size</a>
      </figcaption>
    </figure>
  );
}

export function MarketingHero({ dashboard }: { dashboard: ReactNode }) {
  return (
    <section id="product" className="relative isolate scroll-mt-28 overflow-hidden bg-[#f4f7f3] lg:scroll-mt-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_5%_15%,rgba(166,220,190,0.26),transparent_36%),linear-gradient(140deg,#f8fbf8_10%,#edf4ee_100%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-9 px-5 pb-12 pt-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-12 lg:px-8 lg:pb-16 lg:pt-20">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
            <i className="h-2 w-2 rounded-full bg-emerald-600" />
            Multi-location inventory and POS
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-[#102e27] sm:text-5xl lg:text-[58px]">
            Inventory, orders and sales.
            <span className="mt-2 block text-[#007450]">One powerful platform.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-600">
            StockBase brings products, warehouses, purchases, orders and point of sale into one clear workspace for growing businesses.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/trial" className="inline-flex min-h-12 items-center rounded-xl bg-[#006c4a] px-6 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-[#005c40]">Start Free Trial</Link>
            <Link href="/trial" className="inline-flex min-h-12 items-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50">Book a Demo</Link>
          </div>
          <p className="mt-5 text-xs text-slate-500">14-day free trial / No credit card required / EU hosted</p>
        </div>
        <div className="relative min-h-[300px] overflow-hidden rounded-[28px] border border-white/70 bg-slate-200 shadow-[0_30px_80px_rgba(20,64,48,0.18)] sm:min-h-[400px] lg:min-h-[500px]">
          <Image src="/marketing/concepts/sunlit-warehouse.webp" alt="Bright warehouse with products ready for inventory operations" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#072a23]/70 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/25 bg-white/15 p-4 text-white backdrop-blur-md sm:bottom-7 sm:left-7 sm:right-auto sm:max-w-xs">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">From stockroom to sale</p>
            <p className="mt-1 text-lg font-semibold leading-snug">Every item, movement and sale in one place.</p>
          </div>
        </div>
      </div>
      <div className="relative mx-auto max-w-7xl px-5 pb-16 lg:px-8 lg:pb-20">
        <div className="mx-auto max-w-6xl">{dashboard}</div>
      </div>
    </section>
  );
}

export function BarcodePhotoSection() {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto grid max-w-7xl gap-9 px-5 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8">
        <div className="relative min-h-[280px] overflow-hidden rounded-[26px] bg-slate-100 shadow-[0_24px_65px_rgba(15,23,42,0.12)] sm:min-h-[390px]">
          <Image src="/marketing/concepts/barcode-scan.webp" alt="Barcode scanner beside a labelled shipping box" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Barcode workflow</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#102e27] sm:text-4xl">Scan. Find. Update.</h2>
          <p className="mt-4 max-w-lg leading-7 text-slate-600">Use a phone, scanner or SKU search to find the exact variant and update stock in seconds.</p>
          <div className="mt-7 grid grid-cols-2 gap-3 text-sm">
            {["Barcode and SKU lookup", "Instant stock movement", "POS-ready scanning", "Labels and print"].map((item) => (
              <div key={item} className="rounded-xl border border-emerald-100 bg-[#f4f8f4] p-4 font-medium text-slate-700">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PurchasesPhotoSection() {
  return (
    <section className="bg-[#f1f6f1] py-16">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Purchases</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#102e27] sm:text-4xl">From supplier to stock</h2>
            <p className="mt-4 max-w-lg leading-7 text-slate-600">Create purchase orders, receive partial deliveries and see purchase cost in one controlled flow.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["Supplier selected", "Products in order", "Partial receiving", "Margin updated"].map((item, index) => (
              <div key={item} className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
                <span className="text-xs font-bold text-emerald-700">0{index + 1}</span>
                <p className="mt-2 text-sm font-semibold text-slate-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-9">
          <AppScreenshot src="/marketing/screenshots/purchases.webp" alt="StockBase purchase orders with receiving totals, status and supplier details" width={1636} height={690} label="Purchase orders" />
        </div>
      </div>
    </section>
  );
}
