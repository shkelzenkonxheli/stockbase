import Link from "next/link";
import { hasRole, requireUser } from "@/lib/auth";

export default async function OrderCreateChoicePage() {
  const currentUser = await requireUser();
  const canCreateOrders = hasRole(currentUser, ["SUPER_ADMIN", "SELLER"]);

  if (!canCreateOrders) {
    return null;
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Porosite</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Zgjidh llojin e porosise
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Vazhdo me formen qe i pershtatet me mire ritmit te punes.
            </p>
          </div>

          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Kthehu te porosite
          </Link>
        </div>

        <section className="grid gap-5 md:grid-cols-2">
          <Link
            href="/orders/new"
            className="group rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 fill-none stroke-current stroke-[1.8]"
              >
                <path d="M8 6h8M8 12h8M8 18h5" />
                <path d="M5 4h14v16H5z" />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
              Porosi normale
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Perdore kur do te regjistrosh nje porosi me kujdes, me te dhenat
              e klientit dhe artikujt e zgjedhur nje nga nje.
            </p>
            <span className="mt-6 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
              Me e detajuar
            </span>
          </Link>

          <Link
            href="/orders/quick"
            className="group rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-fuchsia-200 hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-50 text-fuchsia-700">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 fill-none stroke-current stroke-[1.8]"
              >
                <path d="M7 7h10M7 12h7M7 17h10" />
                <path d="M17 5h2v4M15 7h4" />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">
              Porosi te shpejta
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Perdore per regjistrim te shpejte kur ke volum me te madh shitjesh
              dhe do te shtosh variante ne seri.
            </p>
            <span className="mt-6 inline-flex rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-700">
              Me e shpejte
            </span>
          </Link>
        </section>
      </div>
    </main>
  );
}
