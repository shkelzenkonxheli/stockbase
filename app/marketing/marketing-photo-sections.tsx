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

export function MarketingHero() {
  return (
    <section id="product" className="relative isolate scroll-mt-24 overflow-hidden bg-[#fbfcf8]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_70%,rgba(205,234,210,0.38),transparent_38%)]" />
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-14 pt-12 sm:px-8 sm:pt-16 lg:min-h-[540px] lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-12 lg:pb-14 lg:pt-14 xl:px-12">
        <div className="relative z-10 max-w-xl">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-600" /> Inventory and POS, connected
          </p>
          <h1 className="mt-5 text-[clamp(3.2rem,5.2vw,5rem)] font-black leading-[0.99] tracking-[-0.075em] text-[#082d23]">
            Run stock and sales with clarity.
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-[#40594f] sm:text-lg sm:leading-8">
            Keep products, warehouses, purchases and checkout in one clear workspace. Know what you have and move with confidence.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/trial" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#006c4a] px-6 text-sm font-bold text-white shadow-[0_12px_26px_rgba(0,77,48,0.17)] transition hover:bg-[#075c43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Request a trial <span aria-hidden="true" className="ml-3 text-lg">&rarr;</span></Link>
            <a href="#features" className="inline-flex min-h-12 items-center text-sm font-bold text-[#0a4a35] underline decoration-emerald-400 underline-offset-4 transition hover:text-emerald-800">See how it works</a>
          </div>
          <p className="mt-5 text-xs text-slate-500">14-day trial / Activated by the StockBase team</p>
        </div>
        <div className="relative isolate min-h-[380px] overflow-hidden rounded-[28px] border border-emerald-950/10 bg-[#dbe9da] shadow-[0_30px_70px_rgba(13,52,37,0.16)] sm:min-h-[480px] lg:min-h-[460px]">
          <Image src="/marketing/concepts/sunlit-warehouse.webp" alt="Sunlit warehouse with products ready for inventory operations" fill priority sizes="(max-width: 1024px) 100vw, 56vw" className="-z-20 object-cover object-center" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-[#082d23]/30 via-transparent to-white/10" />
          <div className="absolute inset-x-4 bottom-5 overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_22px_55px_rgba(5,31,21,0.28)] sm:inset-x-6 sm:bottom-7 lg:inset-x-7">
            <div className="flex h-9 items-center gap-1.5 border-b border-slate-100 bg-[#fbfdfb] px-3">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-300" /><span className="h-1.5 w-1.5 rounded-full bg-amber-300" /><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.13em] text-emerald-900">StockBase / Inventory</span>
            </div>
            <Image src="/marketing/screenshots/inventory.webp" alt="Actual StockBase inventory screen with products, stock, sizes and colors" width={1627} height={722} priority sizes="(max-width: 1024px) 90vw, 52vw" className="block h-auto w-full" />
          </div>
        </div>
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
