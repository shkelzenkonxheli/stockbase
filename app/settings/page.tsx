import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { SettingsListViewEditor } from "@/app/components/settings-list-view-editor";
import { SettingsCategoryCard } from "@/app/components/settings-category-card";
import { SettingsCategoryBrowser } from "@/app/components/settings-category-browser";
import { SettingsLogoPicker } from "@/app/components/settings-logo-picker";
import { SettingsTabs } from "@/app/components/settings-tabs";
import { WarehouseManager } from "./warehouse-manager";
import { requireRole } from "@/lib/auth";
import { createTenantCategory, ensureTenantCategories } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { saveTenantLogo } from "@/lib/tenant-logo";
import { getTenantWarehouseSummaries, syncTenantWarehouses } from "@/lib/warehouses";
import {
  CATALOG_TYPES,
  createCategoryFieldKey,
  getCatalogAwareCategoryConfig,
  getOrderListViewConfig,
  getProductListViewConfig,
  getCatalogTemplate,
  getWarehouseConfig,
  ORDER_LIST_FIELD_KEYS,
  parseCategoryFieldConfig,
  sanitizeCustomVariantFields,
  parseTenantCatalogConfig,
  PRODUCT_LIST_FIELD_KEYS,
  type CatalogType,
  type OrderListFieldKey,
  type OrderListViewConfig,
  type ProductListFieldKey,
  type ProductListViewConfig,
  PRODUCT_CATEGORIES,
  type ProductCategoryName,
  type TenantCatalogConfig,
} from "@/lib/product-taxonomy";

type SettingsPageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Settings",
};

function normalizeCategoryName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isTruthyField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue === "on" || normalizedValue === "true" || normalizedValue === "1";
}

function parseJsonArrayField(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObjectField(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseProductListViewConfig(
  value: FormDataEntryValue | null,
  fallback: ProductListViewConfig,
): ProductListViewConfig {
  const parsed = parseJsonObjectField(value);
  const visibilityInput =
    parsed && typeof parsed.visibility === "object" && parsed.visibility ? parsed.visibility : {};
  const orderInput = parsed && Array.isArray(parsed.order) ? parsed.order : [];
  const seen = new Set<ProductListFieldKey>();
  const order: ProductListFieldKey[] = [];

  for (const candidate of orderInput) {
    if (
      typeof candidate === "string" &&
      PRODUCT_LIST_FIELD_KEYS.includes(candidate as ProductListFieldKey) &&
      !seen.has(candidate as ProductListFieldKey)
    ) {
      seen.add(candidate as ProductListFieldKey);
      order.push(candidate as ProductListFieldKey);
    }
  }

  for (const key of PRODUCT_LIST_FIELD_KEYS) {
    if (!seen.has(key)) {
      order.push(key);
    }
  }

  return {
    layout:
      parsed && parsed.layout === "list"
        ? "list"
        : fallback.layout,
    density:
      parsed && parsed.density === "compact"
        ? "compact"
        : fallback.density,
    order,
    visibility: Object.fromEntries(
      PRODUCT_LIST_FIELD_KEYS.map((key) => [
        key,
        typeof (visibilityInput as Record<string, unknown>)[key] === "boolean"
          ? Boolean((visibilityInput as Record<string, unknown>)[key])
          : fallback.visibility[key],
      ]),
    ) as Record<ProductListFieldKey, boolean>,
  };
}

function parseOrderListViewConfig(
  value: FormDataEntryValue | null,
  fallback: OrderListViewConfig,
): OrderListViewConfig {
  const parsed = parseJsonObjectField(value);
  const visibilityInput =
    parsed && typeof parsed.visibility === "object" && parsed.visibility ? parsed.visibility : {};
  const orderInput = parsed && Array.isArray(parsed.order) ? parsed.order : [];
  const seen = new Set<OrderListFieldKey>();
  const order: OrderListFieldKey[] = [];

  for (const candidate of orderInput) {
    if (
      typeof candidate === "string" &&
      ORDER_LIST_FIELD_KEYS.includes(candidate as OrderListFieldKey) &&
      !seen.has(candidate as OrderListFieldKey)
    ) {
      seen.add(candidate as OrderListFieldKey);
      order.push(candidate as OrderListFieldKey);
    }
  }

  for (const key of ORDER_LIST_FIELD_KEYS) {
    if (!seen.has(key)) {
      order.push(key);
    }
  }

  return {
    layout:
      parsed && parsed.layout === "list"
        ? "list"
        : fallback.layout,
    density:
      parsed && parsed.density === "compact"
        ? "compact"
        : fallback.density,
    order,
    visibility: Object.fromEntries(
      ORDER_LIST_FIELD_KEYS.map((key) => [
        key,
        typeof (visibilityInput as Record<string, unknown>)[key] === "boolean"
          ? Boolean((visibilityInput as Record<string, unknown>)[key])
          : fallback.visibility[key],
      ]),
    ) as Record<OrderListFieldKey, boolean>,
  };
}

async function deleteCategory(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const categoryId = Number(formData.get("categoryId"));

  if (!tenantId || !categoryId) {
    redirect("/settings?error=category-action");
  }

  const category = await prisma.category.findFirst({
    where: { id: categoryId, tenantId },
    select: {
      id: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    redirect("/settings?error=category-missing");
  }

  if (category.isActive) {
    const activeCategoriesCount = await prisma.category.count({
      where: {
        tenantId,
        isActive: true,
      },
    });

    if (activeCategoriesCount <= 1) {
      redirect("/settings?error=last-active-category");
    }
  }

  if (category._count.products > 0) {
    await prisma.category.update({
      where: { id: category.id },
      data: { isActive: false },
    });

    revalidatePath("/products");
    revalidatePath("/settings");
    redirect("/settings?success=category-archived");
  }

  await prisma.category.delete({
    where: { id: category.id },
  });

  revalidatePath("/products");
  revalidatePath("/settings");
  redirect("/settings?success=category-deleted");
}

async function updateTenantSettings(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/login");
  }

  const businessName = formData.get("businessName")?.toString().trim();
  const catalogType = formData.get("catalogType")?.toString().trim() as CatalogType | undefined;
  const language = formData.get("language")?.toString().trim().toLowerCase();
  const newCategoryName = formData.get("newCategoryName")?.toString().trim();
  const newCategoryPreset = formData.get("newCategoryPreset")?.toString().trim() as
    | ProductCategoryName
    | undefined;

  if (!businessName || !catalogType || !language) {
    redirect("/settings?error=validation");
  }

  const existingSettings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { catalogConfig: true, currency: true, primaryColor: true, logoUrl: true },
  });
  const existingTenantConfig = parseTenantCatalogConfig(existingSettings?.catalogConfig);
  let logoUrl = existingSettings?.logoUrl ?? null;
  const currentProductListView = getProductListViewConfig(existingTenantConfig);
  const currentOrderListView = getOrderListViewConfig(existingTenantConfig);

  const catalogConfig: TenantCatalogConfig = {
    warehouse: {
      enabled: isTruthyField(formData.get("warehouseEnabled")),
      options: existingTenantConfig?.warehouse?.options ?? [],
    },
    pos: {
      // POS access is an entitlement managed only from the platform console.
      enabled: existingTenantConfig?.pos?.enabled ?? false,
    },
    purchases: existingTenantConfig?.purchases,
    barcode: existingTenantConfig?.barcode,
    inventoryCount: existingTenantConfig?.inventoryCount,
    multiWarehouse: existingTenantConfig?.multiWarehouse,
    productListView: parseProductListViewConfig(
      formData.get("productListViewConfig"),
      currentProductListView,
    ),
    orderListView: parseOrderListViewConfig(
      formData.get("orderListViewConfig"),
      currentOrderListView,
    ),
  };

  if (newCategoryName) {
    const existingNames = await prisma.category.findMany({ where: { tenantId }, select: { name: true } });
    if (existingNames.some((item) => normalizeCategoryName(item.name) === normalizeCategoryName(newCategoryName))) {
      redirect("/settings?error=duplicate-category");
    }
  }

  const logoFile = formData.get("businessLogo");
  if (logoFile instanceof File && logoFile.size > 0) {
    try {
      logoUrl = await saveTenantLogo(tenantId, logoFile);
    } catch (error) {
      console.error("Tenant logo upload failed", { tenantId, message: error instanceof Error ? error.message : "Unknown error" });
      redirect("/settings?error=logo-upload");
    }
  }

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: businessName,
        catalogType,
      },
    }),
    prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        businessName,
        language,
        currency: existingSettings?.currency ?? "EUR",
        primaryColor: existingSettings?.primaryColor ?? null,
        logoUrl,
        catalogConfig,
      },
      update: {
        businessName,
        language,
        currency: existingSettings?.currency ?? "EUR",
        primaryColor: existingSettings?.primaryColor ?? null,
        logoUrl,
        catalogConfig,
      },
    }),
  ]);

  await syncTenantWarehouses(tenantId, catalogConfig);

  const categoryCount = await prisma.category.count({ where: { tenantId } });
  if (categoryCount === 0 || currentUser.tenant?.catalogType !== catalogType) {
    await ensureTenantCategories(tenantId, catalogType);
  }

  if (
    newCategoryName &&
    newCategoryPreset &&
    PRODUCT_CATEGORIES.includes(newCategoryPreset)
  ) {
    await createTenantCategory({
      tenantId,
      name: newCategoryName,
      catalogType,
      presetCategoryName: newCategoryPreset,
    });
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/settings");
  redirect("/settings?success=1");
}

function getMessage(success?: string, error?: string) {
  if (success === "category-saved") {
    return { type: "success" as const, text: "Kategoria dhe variablat u ruajten me sukses." };
  }
  if (success === "1") {
    return {
      type: "success" as const,
      text: "Konfigurimi u ruajt me sukses.",
    };
  }

  if (error === "validation") {
    return {
      type: "error" as const,
      text: "Ploteso emrin e biznesit, llojin e katalogut dhe gjuhen.",
    };
  }

  if (error === "logo-upload") {
    return { type: "error" as const, text: "Logoja nuk u ngarkua. Perdore JPG, PNG ose WebP deri ne 2 MB dhe provo perseri." };
  }

  if (success === "category-deleted") {
    return {
      type: "success" as const,
      text: "Kategoria u fshi me sukses.",
    };
  }

  if (success === "category-archived") {
    return {
      type: "success" as const,
      text: "Kategoria u arkivua me sukses.",
    };
  }

  if (error === "last-active-category") {
    return {
      type: "error" as const,
      text: "Duhet te mbetet te pakten nje kategori aktive.",
    };
  }

  if (error === "category-missing") {
    return {
      type: "error" as const,
      text: "Kategoria nuk u gjet.",
    };
  }

  if (error === "category-action") {
    return {
      type: "error" as const,
      text: "Veprimi mbi kategorine deshtoi.",
    };
  }

  if (error === "category-name-required") {
    return { type: "error" as const, text: "Shkruaj emrin e kategorise." };
  }

  if (error === "duplicate-category") {
    return { type: "error" as const, text: "Nje kategori me kete emer ekziston tashme." };
  }

  return null;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;

  if (!tenantId) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const message = getMessage(resolvedSearchParams?.success, resolvedSearchParams?.error);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      settings: true,
      subscription: true,
    },
  });

  if (!tenant) {
    redirect("/login");
  }

  const existingCategoriesCount = await prisma.category.count({
    where: { tenantId },
  });

  if (existingCategoriesCount === 0) {
    await ensureTenantCategories(tenantId, tenant.catalogType);
  }

  const tenantCatalogConfig = parseTenantCatalogConfig(tenant.settings?.catalogConfig);
  const productListView = getProductListViewConfig(tenantCatalogConfig);
  const orderListView = getOrderListViewConfig(tenantCatalogConfig);
  const warehouseConfig = getWarehouseConfig(tenantCatalogConfig);
  const catalogOptions = CATALOG_TYPES.map((type) => ({
    value: type,
    label: getCatalogTemplate(type).label,
    description: getCatalogTemplate(type).variantFocus,
  }));
  const categories = await prisma.category.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
      config: true,
      _count: {
        select: {
          products: true,
        },
      },
      products: {
        where: { variants: { some: { imagePath: { not: null } } } },
        take: 1,
        select: { variants: { where: { imagePath: { not: null } }, take: 1, select: { imagePath: true } } },
      },
    },
  });

  const categoryConfigs = categories.map((category) => ({
    id: category.id,
    categoryName: category.name,
    isActive: category.isActive,
    productCount: category._count.products,
    imagePath: category.products[0]?.variants[0]?.imagePath ?? null,
    fieldKey: createCategoryFieldKey(category.name),
    config: getCatalogAwareCategoryConfig(
      tenant.catalogType,
      category.name,
      tenantCatalogConfig,
      parseCategoryFieldConfig(category.config),
    ),
  }));
  const warehouseSummaries = await getTenantWarehouseSummaries(tenantId, tenantCatalogConfig);
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7faf8_0%,#eef5f1_100%)] px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="px-1 pb-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">StockBase / Konfigurimi</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">Menaxho biznesin, katalogun, depot dhe menyren si shfaqen te dhenat.</p>
        </section>

        {message ? (
          <FlashMessage
            type={message.type}
            text={message.text}
            className="rounded-2xl px-4 py-3 text-sm shadow-sm"
          />
        ) : null}

        <section aria-label="Konfigurimi i biznesit">
          <form
            action={updateTenantSettings}
            className="overflow-clip rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
          >
              <SettingsTabs
                settings={
                  <div className="mx-auto max-w-4xl space-y-7">
                    <section id="settings-profile" className="scroll-mt-24 border-b border-slate-200 pb-7">
                      <h2 className="text-lg font-bold tracking-tight text-slate-950">Profili i biznesit</h2>
                      <p className="mt-1 text-sm text-slate-600">Te dhenat baze qe perdoren ne StockBase.</p>
                      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_240px]">
                        <div className="space-y-5">
                        <div className="min-w-0 space-y-2">
                          <label htmlFor="businessName" className="block text-sm font-medium text-slate-800">
                            Emri i biznesit
                          </label>
                          <input
                            id="businessName"
                            name="businessName"
                            type="text"
                            defaultValue={tenant.settings?.businessName ?? tenant.name}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                          />
                        </div>

                        <div className="min-w-0 space-y-2">
                          <label htmlFor="catalogType" className="block text-sm font-medium text-slate-800">
                            Lloji i katalogut
                          </label>
                          <select
                            id="catalogType"
                            name="catalogType"
                            defaultValue={tenant.catalogType}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                          >
                            {catalogOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        </div>
                        <SettingsLogoPicker logoUrl={tenant.settings?.logoUrl ?? null} />
                      </div>
                    </section>

                    <section id="settings-language" className="scroll-mt-24 border-b border-slate-200 pb-7">
                      <h2 className="text-lg font-bold tracking-tight text-slate-950">Gjuha</h2>
                      <p className="mt-1 text-sm text-slate-600">Zgjidh gjuhen e paracaktuar te biznesit.</p>
                      <div className="mt-5 max-w-sm space-y-2">
                          <label htmlFor="language" className="block text-sm font-medium text-slate-800">
                            Gjuha
                          </label>
                          <select
                            id="language"
                            name="language"
                            defaultValue={tenant.settings?.language ?? "sq"}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                          >
                            <option value="sq">Shqip</option>
                            <option value="en">English</option>
                          </select>
                      </div>
                    </section>

                    <section id="settings-catalog" className="scroll-mt-24 border-b border-slate-200 pb-7">
                      <h2 className="text-lg font-bold tracking-tight text-slate-950">Konfigurimi i katalogut</h2>
                      <p className="mt-1 text-sm text-slate-600">Organizimi i produkteve dhe perdorimi i depove.</p>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">Depoja</p>
                              <p className="mt-1 text-sm text-slate-600">
                                Aktivizo zgjedhjen e depos te produktet dhe shfaqe ne stok e porosi.
                              </p>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                name="warehouseEnabled"
                                value="true"
                                defaultChecked={warehouseConfig.enabled}
                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                              />
                              Shfaq depo
                            </label>
                          </div>
                        </div>

                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                          <p className="text-sm font-semibold text-slate-950">POS Module</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Leja per POS menaxhohet nga platforma. Kur aktivizohet, ketu mund te konfiguroni depot dhe register-at.
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 text-xs text-slate-500">
                        Emrat dhe statuset e depove menaxhohen te tab-i Depot. Register-at POS menaxhohen te moduli POS pasi te aktivizohet.
                      </p>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Subscription
                        </p>
                        <Link href="/billing" className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-800">
                          Menaxho billing
                        </Link>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <p>
                          <span className="font-medium text-slate-900">Statusi:</span>{" "}
                          {tenant.subscription?.status ?? "-"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">Plan:</span>{" "}
                          {tenant.subscription?.planCode ?? "Trial / pa plan"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">Trial deri:</span>{" "}
                          {tenant.subscription?.trialEnd
                            ? new Intl.DateTimeFormat("sq-AL", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              }).format(tenant.subscription.trialEnd)
                            : "-"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-900">Periudha aktive deri:</span>{" "}
                          {tenant.subscription?.currentPeriodEnd
                            ? new Intl.DateTimeFormat("sq-AL", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              }).format(tenant.subscription.currentPeriodEnd)
                            : "-"}
                        </p>
                      </div>

                      <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                        Per momentin aktivizimi behet manualisht nga platforma.
                      </p>
                    </section>
                  </div>
                }
                categories={
                  <SettingsCategoryBrowser
                    saveAction={updateCategorySettings}
                    categories={categoryConfigs.map((category) => ({ id: category.id, name: category.categoryName, productCount: category.productCount, isActive: category.isActive, imagePath: category.imagePath }))}
                    createForm={
                      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5">
                        <h3 className="text-sm font-bold text-slate-950">Kategori e re</h3>
                        <p className="mt-1 text-xs text-slate-600">Ploteso emrin dhe bazen e fushave, pastaj shtyp Ruaj ndryshimet.</p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <label className="space-y-2 text-sm font-medium text-slate-800">Emri i kategorise
                            <input name="newCategoryName" type="text" placeholder="p.sh. Lini shtepie Premium" className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-600" />
                          </label>
                          <label className="space-y-2 text-sm font-medium text-slate-800">Baza e fushave
                            <select name="newCategoryPreset" defaultValue="" className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-600">
                              <option value="" disabled>Zgjidh preset-in</option>
                              {PRODUCT_CATEGORIES.map((categoryName) => <option key={categoryName} value={categoryName}>{categoryName}</option>)}
                            </select>
                          </label>
                        </div>
                      </section>
                    }
                    details={categoryConfigs.map(({ id, categoryName, isActive, productCount, fieldKey, config }) => (
                      <div key={id} className="space-y-4">
                        <SettingsCategoryCard id={id} categoryName={categoryName} isActive={isActive} productCount={productCount} fieldKey={fieldKey} config={config} deleteCategoryAction={deleteCategory} embedded />
                        <SettingsCategoryCard id={id} categoryName={categoryName} isActive={isActive} productCount={productCount} fieldKey={fieldKey} config={config} deleteCategoryAction={deleteCategory} />
                      </div>
                    ))}
                  />
                }
                warehouses={
                  <div className="mx-auto max-w-4xl space-y-5">
                    <WarehouseManager warehouses={warehouseSummaries} />
                  </div>
                }
                view={
                  <section className="mx-auto max-w-3xl space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                    <div>
                      <p className="text-base font-semibold text-slate-950">Pamja e listave</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Terhiqe per renditje dhe zgjidh cfare shfaqet te lista e produkteve dhe te lista e porosive.
                      </p>
                    </div>

                    <SettingsListViewEditor
                      productDefaults={productListView}
                      orderDefaults={orderListView}
                    />
                  </section>
                }
                footer={
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <a href="/settings" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Anulo</a>
                    <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-950">
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]"><path d="M4 4h13l3 3v13H4V4Z" /><path d="M7 4v6h9V4M8 20v-7h8v7" /></svg>
                      Ruaj ndryshimet
                    </button>
                  </div>
                }
              />
          </form>
        </section>
      </div>
    </main>
  );
}

function readCategoryConfig(formData: FormData, fieldKey: string) {
  const read = (key: string) => formData.get(`${fieldKey}__${key}`)?.toString().trim() || undefined;
  const options = (key: string) => (read(key) ?? "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  const inputType = (key: string) => read(key) as "text" | "number" | "select" | undefined;
  return {
    customVariantFields: sanitizeCustomVariantFields(parseJsonArrayField(formData.get(`${fieldKey}__customVariantFields`))),
    productNameLabel: read("productNameLabel"),
    productNamePlaceholder: read("productNamePlaceholder"),
    sizeLabel: read("sizeLabel"),
    sizePlaceholder: read("sizePlaceholder"),
    sizeInputType: inputType("sizeInputType"),
    sizeOptions: options("sizeOptions"),
    colorLabel: read("colorLabel"),
    colorPlaceholder: read("colorPlaceholder"),
    colorInputType: inputType("colorInputType"),
    colorOptions: options("colorOptions"),
    materialLabel: read("materialLabel"),
    materialPlaceholder: read("materialPlaceholder"),
    materialInputType: inputType("materialInputType"),
    materialOptions: options("materialOptions"),
    powerLabel: read("powerLabel"),
    powerPlaceholder: read("powerPlaceholder"),
    powerInputType: inputType("powerInputType"),
    powerOptions: options("powerOptions"),
    variantHelper: read("variantHelper"),
    showMaterialField: isTruthyField(formData.get(`${fieldKey}__showMaterialField`)),
    showPowerField: isTruthyField(formData.get(`${fieldKey}__showPowerField`)),
    showProductBrandField: isTruthyField(formData.get(`${fieldKey}__showProductBrandField`)),
    sharedVariantImageByColor: isTruthyField(formData.get(`${fieldKey}__sharedVariantImageByColor`)),
  };
}

async function updateCategorySettings(formData: FormData) {
  "use server";

  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const categoryId = Number(formData.get("categoryIds"));
  if (!tenantId || !Number.isInteger(categoryId) || categoryId <= 0) {
    redirect("/settings?error=category-action");
  }

  const category = await prisma.category.findFirst({
    where: { id: categoryId, tenantId },
    select: { id: true, name: true },
  });
  if (!category) redirect("/settings?error=category-missing");

  const name = formData.get(`categoryName__${categoryId}`)?.toString().trim();
  if (!name) redirect("/settings?error=category-name-required");
  const fieldKey = createCategoryFieldKey(category.name);
  if (formData.get(`categoryFieldKey__${categoryId}`) !== fieldKey) {
    redirect("/settings?error=category-action");
  }
  const isActive = isTruthyField(formData.get(`${fieldKey}__isActive`));
  const otherCategories = await prisma.category.findMany({
    where: { tenantId, id: { not: categoryId } },
    select: { name: true, isActive: true },
  });
  if (otherCategories.some((item) => normalizeCategoryName(item.name) === normalizeCategoryName(name))) {
    redirect("/settings?error=duplicate-category");
  }
  if (!isActive && !otherCategories.some((item) => item.isActive)) {
    redirect("/settings?error=last-active-category");
  }

  await prisma.category.updateMany({
    where: { id: categoryId, tenantId },
    data: { name, isActive, config: readCategoryConfig(formData, fieldKey) },
  });
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings?success=category-saved");
}
