import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kerko Trial",
};

function getSupportEmail() {
  const firstPlatformEmail = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);

  return firstPlatformEmail || "hello@stockbase.app";
}

export default function TrialPage() {
  const supportEmail = getSupportEmail();
  const trialMailto = `mailto:${supportEmail}?subject=StockBase%20Trial%20Request&body=Pershendetje,%0A%0ADua%20te%20kerkoj%20nje%20trial%20per%20StockBase.%0A%0AEmri%20i%20biznesit:%0ALloji%20i%20biznesit:%0ASa%20produkte%20keni%20afersisht:%0ASa%20depo%20keni:%0A%0AFaleminderit.`;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf3_0%,#f8fafc_42%,#eef5f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="relative h-11 w-11 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
              <Image
                src="/stock-app-logo.svg"
                alt="StockBase"
                fill
                className="object-contain p-2"
                sizes="44px"
                priority
              />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight text-slate-950">StockBase</p>
              <p className="text-sm text-slate-500">Trial request</p>
            </div>
          </Link>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Login
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Kthehu
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="overflow-hidden rounded-[32px] border border-emerald-100 bg-[linear-gradient(135deg,#ffffff_0%,#f6fdf8_52%,#edf9f2_100%)] px-6 py-7 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Trial manual
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Kerko workspace me trial 14 dite.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              Per momentin trial-i aktivizohet manualisht nga platforma. Na dergo te dhenat
              bazike te biznesit dhe ne ta hapim tenant-in per testim, me konfigurim sipas llojit
              te katalogut qe perdor.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                { title: "14 dite", copy: "Trial i aktivizuar manualisht" },
                { title: "Sipas biznesit", copy: "Footwear, electronics, home goods, decor" },
                { title: "Setup i shpejte", copy: "Tenant, kategori dhe depo bazike" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-emerald-100 bg-white/95 px-4 py-4 shadow-sm"
                >
                  <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{item.copy}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[26px] border border-slate-200 bg-white/95 p-5">
              <p className="text-sm font-semibold text-slate-950">Cka duhet me na dergu:</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Emri i biznesit</li>
                <li>Lloji i biznesit: patika, elektronikë, dekor, lini shtepie, etj.</li>
                <li>Sa produkte keni afersisht</li>
                <li>Sa depo ose pika shitjeje keni</li>
                <li>Nese ju duhet barcode, inventory count ose multi-warehouse</li>
              </ul>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[30px] border border-emerald-100 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Kontakti
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Dergo kerkesen
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Kliko butonin me poshte dhe na dergo email me te dhenat e biznesit. Trial-i hapet
                manualisht nga platforma.
              </p>

              <div className="mt-5 space-y-3">
                <a
                  href={trialMailto}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(16,185,129,0.24)] transition hover:bg-emerald-500"
                >
                  Dergo kerkesen me email
                </a>
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  {supportEmail}
                </a>
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              <p className="text-sm font-semibold text-slate-950">Pas aktivizimit te trial-it</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>1. Merr login credentials per owner-in e biznesit.</p>
                <p>2. Hyn ne platforme dhe vendos kategorite, depot dhe view-at.</p>
                <p>3. Importon produktet nga Excel/CSV ose i shton manualisht.</p>
                <p>4. Fillon testimin me porosi, barcode dhe inventar.</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
