import Image from "next/image";
import Link from "next/link";
import { AppScreenshot, BarcodePhotoSection, MarketingHero, PurchasesPhotoSection } from "./marketing-photo-sections";

const screens = [
  {
    title: "Inventory",
    description: "Products, variants and stock across your locations.",
    src: "/marketing/screenshots/inventory.webp",
    alt: "StockBase inventory with products, sizes, colors and warehouse stock",
    width: 1627,
    height: 722,
  },
  {
    title: "Point of sale",
    description: "A focused checkout connected to your stock.",
    src: "/marketing/screenshots/pos.webp",
    alt: "StockBase POS with product cards and checkout cart",
    width: 1916,
    height: 865,
  },
  {
    title: "Purchase orders",
    description: "Order from suppliers and receive into stock.",
    src: "/marketing/screenshots/purchases.webp",
    alt: "StockBase purchase orders with suppliers and receiving status",
    width: 1636,
    height: 690,
  },
  {
    title: "Workspace",
    description: "Every day-to-day operation in one place.",
    src: "/marketing/screenshots/workspace.webp",
    alt: "StockBase operational workspace with grouped actions",
    width: 1902,
    height: 862,
  },
] as const;

const menuLinks = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#features" },
  { label: "Solutions", href: "#solutions" },
  { label: "Trial", href: "#trial" },
] as const;

export function MarketingHomepage({ supportEmail }: { supportEmail: string }) {
  return (
    <main className="overflow-x-clip bg-[#fbfcf8] text-[#112c23]">
      <header className="sticky top-0 z-50 border-b border-emerald-950/10 bg-[#fbfcf8]/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-17 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:min-h-20 xl:px-12">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="StockBase home">
            <Image src="/stock-app-logo.svg" alt="" width={34} height={34} priority />
            <span className="text-xl font-black tracking-[-0.05em] text-[#082d23]">StockBase</span>
          </Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-8 text-sm font-medium text-[#385247] lg:flex">
            {menuLinks.map((item) => <a key={item.href} href={item.href} className="transition hover:text-emerald-700">{item.label}</a>)}
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/login" className="hidden px-2 py-2 text-sm font-semibold text-[#173f2d] transition hover:text-emerald-700 sm:inline-flex">Log in</Link>
            <Link href="/trial" className="inline-flex min-h-10 items-center rounded-xl bg-[#006c4a] px-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#075c43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:px-4 sm:text-sm">Request a trial</Link>
            <details className="group relative lg:hidden">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-emerald-950/15 bg-white text-[#173f2d] [&::-webkit-details-marker]:hidden" aria-label="Open navigation">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></svg>
              </summary>
              <nav aria-label="Mobile navigation" className="absolute right-0 top-12 z-50 flex w-56 flex-col gap-1 rounded-2xl border border-emerald-950/10 bg-white p-2 shadow-[0_20px_45px_rgba(5,37,25,0.16)]">
                {menuLinks.map((item) => <a key={item.href} href={item.href} className="rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-emerald-50">{item.label}</a>)}
                <Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:bg-emerald-50 sm:hidden">Log in</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <MarketingHero />

      <section id="features" className="scroll-mt-24 border-t border-emerald-950/10 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 xl:px-12">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Inside the platform</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-[#082d23] sm:text-4xl">See StockBase in action.</h2>
              <p className="mt-3 text-sm leading-6 text-[#52665b] sm:text-base">Real screens from the product, not illustrations. Explore the tools your team uses every day.</p>
            </div>
            <span className="text-xs font-semibold text-emerald-800 lg:hidden">Scroll to explore on mobile</span>
          </div>
          <div className="-mx-5 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 xl:gap-5">
            {screens.map((screen, index) => (
              <article key={screen.src} className="group min-w-[min(82vw,330px)] snap-start overflow-hidden rounded-[22px] border border-emerald-950/10 bg-[#fbfcf8] shadow-[0_10px_30px_rgba(18,47,35,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(18,47,35,0.12)] lg:min-w-0">
                <a href={screen.src} target="_blank" rel="noopener noreferrer" aria-label={`Open ${screen.title} screenshot in full size`} className="block overflow-hidden border-b border-emerald-950/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700">
                  <Image src={screen.src} alt={screen.alt} width={screen.width} height={screen.height} sizes="(max-width: 1024px) 82vw, 24vw" className="aspect-[16/10] w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]" />
                </a>
                <div className="p-4 sm:p-5">
                  <p className="text-[11px] font-bold tracking-[0.16em] text-emerald-700">0{index + 1} / STOCKBASE</p>
                  <h3 className="mt-2 text-lg font-bold tracking-tight">{screen.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#52665b]">{screen.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="solutions" className="scroll-mt-24 bg-[#f3f7f0] py-18 sm:py-24">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-16 xl:px-12">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">One source of truth</p>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.045em] sm:text-4xl">Know what is in stock, wherever it is.</h2>
            <p className="mt-5 text-base leading-8 text-[#52665b]">Keep product variants, colors, sizes and warehouse quantities together. Find what you need without switching between disconnected tools.</p>
            <ul className="mt-7 space-y-3 text-sm font-semibold text-[#204838]">
              <li className="flex gap-3"><span aria-hidden="true" className="text-emerald-700">&#10003;</span> Stock by warehouse and variant</li>
              <li className="flex gap-3"><span aria-hidden="true" className="text-emerald-700">&#10003;</span> Product and barcode search</li>
              <li className="flex gap-3"><span aria-hidden="true" className="text-emerald-700">&#10003;</span> Clear stock movement history</li>
            </ul>
          </div>
          <AppScreenshot src="/marketing/screenshots/inventory.webp" alt="StockBase inventory list showing product variants and current stock" width={1627} height={722} label="Inventory" />
        </div>
      </section>

      <BarcodePhotoSection />

      <section className="bg-[#0c3328] py-18 text-white sm:py-24">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 xl:px-12">
          <div className="mb-9 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Point of sale</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] sm:text-4xl">From product shelf to checkout.</h2>
            <p className="mt-4 text-base leading-7 text-emerald-50/75">Choose the right product and variant, then complete the sale from a focused POS screen.</p>
          </div>
          <AppScreenshot src="/marketing/screenshots/pos.webp" alt="StockBase POS product selection and checkout cart" width={1916} height={865} label="Point of sale" />
        </div>
      </section>

      <PurchasesPhotoSection />

      <section id="trial" className="scroll-mt-24 bg-[#fbfcf8] px-5 py-18 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[30px] bg-[#0b3c2d] px-6 py-12 text-center text-white shadow-[0_25px_65px_rgba(8,56,38,0.18)] sm:px-10 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">See it with your own products</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-[-0.045em] sm:text-5xl">Bring your stock and sales together.</h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-emerald-50/80 sm:text-base">Request a 14-day trial. Our team will set up a workspace for your business to test StockBase.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/trial" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-[#0b3c2d] transition hover:bg-emerald-50">Request a trial</Link>
            <a href={`mailto:${supportEmail}`} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/35 px-6 text-sm font-semibold text-white transition hover:bg-white/10">Contact us</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-emerald-950/10 bg-white px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between xl:px-4">
          <div>
            <div className="flex items-center gap-2"><Image src="/stock-app-logo.svg" alt="" width={28} height={28} /><span className="text-lg font-black tracking-tight">StockBase</span></div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#52665b]">Inventory, purchases and point of sale in one clear workspace.</p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#365647]">
            <a href="#product" className="hover:text-emerald-700">Product</a>
            <a href="#features" className="hover:text-emerald-700">Screens</a>
            <Link href="/trial" className="hover:text-emerald-700">Trial</Link>
            <a href={`mailto:${supportEmail}`} className="hover:text-emerald-700">Contact</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
