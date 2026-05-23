import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { requirePlatformAdmin } from "@/lib/auth";
import { getPasswordPolicyHint, validatePasswordStrength } from "@/lib/password";
import { CATALOG_TYPES, getCatalogTemplate } from "@/lib/product-taxonomy";
import { createTenantWorkspace } from "@/lib/tenants";

type NewTenantPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

async function createTenant(formData: FormData) {
  "use server";

  await requirePlatformAdmin();

  const ownerName = formData.get("ownerName")?.toString().trim();
  const ownerEmail = formData.get("ownerEmail")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  const businessName = formData.get("businessName")?.toString().trim();
  const catalogType = formData.get("catalogType")?.toString().trim() as
    | "FOOTWEAR"
    | "ELECTRONICS"
    | "HOME_GOODS"
    | "DECOR"
    | undefined;

  if (!ownerName || !ownerEmail || !businessName || !catalogType || !password) {
    redirect("/platform/tenants/new?error=validation");
  }

  const passwordValidationError = validatePasswordStrength(password);
  if (passwordValidationError) {
    redirect(`/platform/tenants/new?error=${encodeURIComponent(passwordValidationError)}`);
  }

  try {
    await createTenantWorkspace({
      ownerName,
      ownerEmail,
      password,
      businessName,
      catalogType,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_EXISTS") {
      redirect("/platform/tenants/new?error=email-exists");
    }

    redirect("/platform/tenants/new?error=create-failed");
  }

  revalidatePath("/platform/tenants");
  redirect("/platform/tenants?success=created");
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Ploteso te gjitha fushat.";
    case "email-exists":
      return "Ky email ekziston tashme. Per tenant te ri perdor email tjeter.";
    case "create-failed":
      return "Krijimi i tenant-it deshtoi. Provo perseri.";
    default:
      return error ? decodeURIComponent(error) : null;
  }
}

export default async function NewTenantPage({ searchParams }: NewTenantPageProps) {
  await requirePlatformAdmin();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = getErrorMessage(resolvedSearchParams?.error);
  const catalogOptions = CATALOG_TYPES.map((type) => ({
    value: type,
    label: getCatalogTemplate(type).label,
    description: getCatalogTemplate(type).variantFocus,
  }));

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Platforma
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Krijo tenant te ri
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Sistemi krijon automatikisht biznesin, user-in kryesor, kategorite baze
                dhe i jep tenant-it `14 dite trial`.
              </p>
            </div>
            <Link
              href="/platform/tenants"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Kthehu
            </Link>
          </div>

          {errorMessage ? (
            <FlashMessage
              type="error"
              text={errorMessage}
              className="mt-6 rounded-2xl px-4 py-3 text-sm"
            />
          ) : null}

          <form action={createTenant} className="mt-8 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="businessName" className="block text-sm font-medium text-slate-800">
                  Emri i biznesit
                </label>
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  placeholder="p.sh. Cozy Home Store"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
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
                <label htmlFor="ownerName" className="block text-sm font-medium text-slate-800">
                  Emri i owner-it
                </label>
                <input
                  id="ownerName"
                  name="ownerName"
                  type="text"
                  placeholder="p.sh. Shkelzen Krasniqi"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="ownerEmail" className="block text-sm font-medium text-slate-800">
                  Email i owner-it
                </label>
                <input
                  id="ownerEmail"
                  name="ownerEmail"
                  type="email"
                  placeholder="owner@biznesi.com"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-800">
                  Password i pare
                </label>
                <input
                  id="password"
                name="password"
                type="password"
                placeholder={getPasswordPolicyHint()}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              />
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              Krijo tenant-in
            </button>
          </form>
        </section>

        <aside className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Cfare krijohet
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
            Onboarding automatik
          </h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              Krijohet tenant-i dhe `business settings`.
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              Krijohet user-i kryesor me rol `SUPER_ADMIN`.
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              Aktivizohet `14 dite trial` automatikisht.
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              Kategorite baze bootstrap-ohen sipas `catalogType`.
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
