import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { prisma } from "@/lib/prisma";
import { createSession, getCurrentUser } from "@/lib/auth";
import { getPasswordPolicyHint, validatePasswordStrength } from "@/lib/password";
import { CATALOG_TYPES, getCatalogTemplate } from "@/lib/product-taxonomy";
import { createTenantWorkspace } from "@/lib/tenants";

type SetupPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

async function createSuperAdmin(formData: FormData) {
  "use server";

  const name = formData.get("name")?.toString().trim();
  const businessName = formData.get("businessName")?.toString().trim();
  const catalogType = formData.get("catalogType")?.toString().trim() as
    | "FOOTWEAR"
    | "ELECTRONICS"
    | "HOME_GOODS"
    | "DECOR"
    | undefined;
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();

  if (
    !name ||
    !businessName ||
    !catalogType ||
    !email ||
    !password
  ) {
    redirect("/setup?error=validation");
  }

  const passwordValidationError = validatePasswordStrength(password);
  if (passwordValidationError) {
    redirect(`/setup?error=${encodeURIComponent(passwordValidationError)}`);
  }

  const usersCount = await prisma.user.count();

  if (usersCount > 0) {
    redirect("/login");
  }

  const result = await createTenantWorkspace({
    ownerName: name,
    ownerEmail: email,
    password,
    businessName,
    catalogType,
  });
  await createSession(result.user.id, result.tenant.id);
  redirect("/");
}

function getErrorMessage(error?: string) {
  if (error === "validation") {
    return "Ploteso te gjitha fushat.";
  }

  return error ? decodeURIComponent(error) : null;
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const usersCount = await prisma.user.count();
  const currentUser = await getCurrentUser();

  if (usersCount > 0) {
    if (currentUser) {
      redirect("/");
    }

    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = getErrorMessage(resolvedSearchParams?.error);
  const catalogOptions = CATALOG_TYPES.map((type) => ({
    value: type,
    label: getCatalogTemplate(type).label,
  }));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffedd5_0%,transparent_20%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Initial Setup
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Krijo Super Admin-in e pare
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Ky hap behet vetem nje here. Pasi krijohet Super Admin-i, hyrja
            vazhdon me login normal dhe userat e tjere krijohen nga paneli.
          </p>

          {errorMessage ? (
            <FlashMessage
              type="error"
              text={errorMessage}
              className="mt-6 rounded-2xl px-4 py-3 text-sm"
            />
          ) : null}

          <form action={createSuperAdmin} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-slate-800">
                Emri
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder="p.sh. Admin Kryesor"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="businessName" className="block text-sm font-medium text-slate-800">
                Emri i biznesit
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder="p.sh. StockBase"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="catalogType" className="block text-sm font-medium text-slate-800">
                Lloji i katalogut
              </label>
              <select
                id="catalogType"
                name="catalogType"
                defaultValue="ELECTRONICS"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              >
                {catalogOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder="admin@stockbase.app"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-800">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder={getPasswordPolicyHint()}
              />
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              Krijo Super Admin
            </button>
          </form>
        </section>

        <aside className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="rounded-[28px] bg-gradient-to-br from-orange-50 via-white to-sky-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Cfare aktivizohet
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
              Pas setup-it
            </h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4 text-sm text-slate-600">
                Super Admin krijon dhe menaxhon userat e shitjes dhe depos.
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4 text-sm text-slate-600">
                Produktet dhe variantet mund te kufizohen vetem per adminin.
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4 text-sm text-slate-600">
                Porosite dhe statuset menaxhohen sipas rolit te userit.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
