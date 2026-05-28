import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FlashMessage } from "@/app/components/flash-message";
import { ConfirmActionButton } from "@/app/components/confirm-action-button";
import { SettingsListViewEditor } from "@/app/components/settings-list-view-editor";
import { SettingsCategoryCard } from "@/app/components/settings-category-card";
import { SettingsTabs } from "@/app/components/settings-tabs";
import { requireRole } from "@/lib/auth";
import { createTenantCategory, ensureTenantCategories } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import {
  CATALOG_TYPES,
  createCategoryFieldKey,
  getCatalogAllowedCategories,
  getCatalogAwareCategoryConfig,
  getOrderListViewConfig,
  getProductListViewConfig,
  getCatalogTemplate,
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
    select: { catalogConfig: true, currency: true, primaryColor: true },
  });
  const existingTenantConfig = parseTenantCatalogConfig(existingSettings?.catalogConfig);
  const currentProductListView = getProductListViewConfig(existingTenantConfig);
  const currentOrderListView = getOrderListViewConfig(existingTenantConfig);

  const categoryOverrides: Partial<TenantCatalogConfig["categoryOverrides"]> = {};
  const categoryIds = formData
    .getAll("categoryIds")
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));
  const submittedCategoryNames = new Set<string>();
  let activeCategoriesCount = 0;

  for (const categoryName of getCatalogAllowedCategories(catalogType)) {
    const fieldKey = createCategoryFieldKey(categoryName);
    const customVariantFields = sanitizeCustomVariantFields(
      parseJsonArrayField(formData.get(`${fieldKey}__customVariantFields`)),
    );
    categoryOverrides[categoryName] = {
      sizeLabel: formData.get(`${fieldKey}__sizeLabel`)?.toString().trim() || undefined,
      sizePlaceholder:
        formData.get(`${fieldKey}__sizePlaceholder`)?.toString().trim() || undefined,
      productNameLabel:
        formData.get(`${fieldKey}__productNameLabel`)?.toString().trim() || undefined,
      productNamePlaceholder:
        formData.get(`${fieldKey}__productNamePlaceholder`)?.toString().trim() || undefined,
      sizeInputType:
        (formData.get(`${fieldKey}__sizeInputType`)?.toString().trim() as
          | "text"
          | "number"
          | "select"
          | undefined) ?? undefined,
      sizeOptions: (formData.get(`${fieldKey}__sizeOptions`)?.toString() ?? "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
      colorLabel: formData.get(`${fieldKey}__colorLabel`)?.toString().trim() || undefined,
      colorPlaceholder:
        formData.get(`${fieldKey}__colorPlaceholder`)?.toString().trim() || undefined,
      colorInputType:
        (formData.get(`${fieldKey}__colorInputType`)?.toString().trim() as
          | "text"
          | "number"
          | "select"
          | undefined) ?? undefined,
      colorOptions: (formData.get(`${fieldKey}__colorOptions`)?.toString() ?? "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
      materialLabel:
        formData.get(`${fieldKey}__materialLabel`)?.toString().trim() || undefined,
      materialPlaceholder:
        formData.get(`${fieldKey}__materialPlaceholder`)?.toString().trim() || undefined,
      materialInputType:
        (formData.get(`${fieldKey}__materialInputType`)?.toString().trim() as
          | "text"
          | "number"
          | "select"
          | undefined) ?? undefined,
      materialOptions: (formData.get(`${fieldKey}__materialOptions`)?.toString() ?? "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
      powerLabel: formData.get(`${fieldKey}__powerLabel`)?.toString().trim() || undefined,
      powerPlaceholder:
        formData.get(`${fieldKey}__powerPlaceholder`)?.toString().trim() || undefined,
      powerInputType:
        (formData.get(`${fieldKey}__powerInputType`)?.toString().trim() as
          | "text"
          | "number"
          | "select"
          | undefined) ?? undefined,
      powerOptions: (formData.get(`${fieldKey}__powerOptions`)?.toString() ?? "")
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
      variantHelper:
        formData.get(`${fieldKey}__variantHelper`)?.toString().trim() || undefined,
      showMaterialField: isTruthyField(formData.get(`${fieldKey}__showMaterialField`)),
      showPowerField: isTruthyField(formData.get(`${fieldKey}__showPowerField`)),
      showProductBrandField: isTruthyField(formData.get(`${fieldKey}__showProductBrandField`)),
      sharedVariantImageByColor: isTruthyField(
        formData.get(`${fieldKey}__sharedVariantImageByColor`),
      ),
      customVariantFields,
    };
  }

  const catalogConfig: TenantCatalogConfig = {
    categoryOverrides,
    productListView: parseProductListViewConfig(
      formData.get("productListViewConfig"),
      currentProductListView,
    ),
    orderListView: parseOrderListViewConfig(
      formData.get("orderListViewConfig"),
      currentOrderListView,
    ),
  };

  for (const categoryId of categoryIds) {
    const submittedName = formData.get(`categoryName__${categoryId}`)?.toString().trim();
    const categoryFieldKey = formData.get(`categoryFieldKey__${categoryId}`)?.toString().trim();

    if (!submittedName) {
      redirect("/settings?error=category-name-required");
    }

    const normalizedName = normalizeCategoryName(submittedName);
    if (submittedCategoryNames.has(normalizedName)) {
      redirect("/settings?error=duplicate-category");
    }

    submittedCategoryNames.add(normalizedName);

    if (categoryFieldKey && isTruthyField(formData.get(`${categoryFieldKey}__isActive`))) {
      activeCategoriesCount += 1;
    }
  }

  if (newCategoryName) {
    const normalizedNewCategoryName = normalizeCategoryName(newCategoryName);
    if (submittedCategoryNames.has(normalizedNewCategoryName)) {
      redirect("/settings?error=duplicate-category");
    }
  }

  if (activeCategoriesCount === 0) {
    redirect("/settings?error=no-active-categories");
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
        catalogConfig,
      },
      update: {
        businessName,
        language,
        currency: existingSettings?.currency ?? "EUR",
        primaryColor: existingSettings?.primaryColor ?? null,
        catalogConfig,
      },
    }),
  ]);

  await ensureTenantCategories(tenantId, catalogType);

  for (const categoryId of categoryIds) {
    const categoryFieldKey = formData.get(`categoryFieldKey__${categoryId}`)?.toString().trim();
    if (!categoryFieldKey) {
      continue;
    }

    const categoryName = formData.get(`categoryName__${categoryId}`)?.toString().trim();
    if (!categoryName) {
      continue;
    }

    await prisma.category.updateMany({
      where: {
        id: categoryId,
        tenantId,
      },
      data: {
        name: categoryName,
        isActive: isTruthyField(formData.get(`${categoryFieldKey}__isActive`)),
        config: {
          customVariantFields: sanitizeCustomVariantFields(
            parseJsonArrayField(formData.get(`${categoryFieldKey}__customVariantFields`)),
          ),
          productNameLabel:
            formData.get(`${categoryFieldKey}__productNameLabel`)?.toString().trim() || undefined,
          productNamePlaceholder:
            formData.get(`${categoryFieldKey}__productNamePlaceholder`)?.toString().trim() ||
            undefined,
          sizeLabel: formData.get(`${categoryFieldKey}__sizeLabel`)?.toString().trim() || undefined,
          sizePlaceholder:
            formData.get(`${categoryFieldKey}__sizePlaceholder`)?.toString().trim() || undefined,
          sizeInputType:
            (formData.get(`${categoryFieldKey}__sizeInputType`)?.toString().trim() as
              | "text"
              | "number"
              | "select"
              | undefined) ?? undefined,
          sizeOptions: (formData.get(`${categoryFieldKey}__sizeOptions`)?.toString() ?? "")
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean),
          colorLabel:
            formData.get(`${categoryFieldKey}__colorLabel`)?.toString().trim() || undefined,
          colorPlaceholder:
            formData.get(`${categoryFieldKey}__colorPlaceholder`)?.toString().trim() || undefined,
          colorInputType:
            (formData.get(`${categoryFieldKey}__colorInputType`)?.toString().trim() as
              | "text"
              | "number"
              | "select"
              | undefined) ?? undefined,
          colorOptions: (formData.get(`${categoryFieldKey}__colorOptions`)?.toString() ?? "")
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean),
          materialLabel:
            formData.get(`${categoryFieldKey}__materialLabel`)?.toString().trim() || undefined,
          materialPlaceholder:
            formData.get(`${categoryFieldKey}__materialPlaceholder`)?.toString().trim() ||
            undefined,
          materialInputType:
            (formData.get(`${categoryFieldKey}__materialInputType`)?.toString().trim() as
              | "text"
              | "number"
              | "select"
              | undefined) ?? undefined,
          materialOptions: (formData.get(`${categoryFieldKey}__materialOptions`)?.toString() ?? "")
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean),
          powerLabel:
            formData.get(`${categoryFieldKey}__powerLabel`)?.toString().trim() || undefined,
          powerPlaceholder:
            formData.get(`${categoryFieldKey}__powerPlaceholder`)?.toString().trim() || undefined,
          powerInputType:
            (formData.get(`${categoryFieldKey}__powerInputType`)?.toString().trim() as
              | "text"
              | "number"
              | "select"
              | undefined) ?? undefined,
          powerOptions: (formData.get(`${categoryFieldKey}__powerOptions`)?.toString() ?? "")
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean),
          variantHelper:
            formData.get(`${categoryFieldKey}__variantHelper`)?.toString().trim() || undefined,
          showMaterialField: isTruthyField(formData.get(`${categoryFieldKey}__showMaterialField`)),
          showPowerField: isTruthyField(formData.get(`${categoryFieldKey}__showPowerField`)),
          showProductBrandField: isTruthyField(
            formData.get(`${categoryFieldKey}__showProductBrandField`),
          ),
          sharedVariantImageByColor: isTruthyField(
            formData.get(`${categoryFieldKey}__sharedVariantImageByColor`),
          ),
        },
      },
    });
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
    },
  });

  const categoryConfigs = categories.map((category) => ({
    id: category.id,
    categoryName: category.name,
    isActive: category.isActive,
    productCount: category._count.products,
    fieldKey: createCategoryFieldKey(category.name),
    config: getCatalogAwareCategoryConfig(
      tenant.catalogType,
      category.name,
      tenantCatalogConfig,
      parseCategoryFieldConfig(category.config),
    ),
  }));
  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Tenant Settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Konfigurimi i tenant-it
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Ketu rregullon biznesin, llojin e katalogut dhe kategorite qe klienti
            do te perdore gjate menaxhimit te produkteve.
          </p>
        </section>

        {message ? (
          <FlashMessage
            type={message.type}
            text={message.text}
            className="rounded-2xl px-4 py-3 text-sm shadow-sm"
          />
        ) : null}

        <section>
          <form
            action={updateTenantSettings}
            className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6 lg:px-8"
          >
            <div className="mx-auto max-w-3xl space-y-6">
              <SettingsTabs
                settings={
                  <div className="mx-auto max-w-2xl space-y-5">
                    <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <label htmlFor="businessName" className="block text-sm font-medium text-slate-800">
                            Emri i biznesit
                          </label>
                          <input
                            id="businessName"
                            name="businessName"
                            type="text"
                            defaultValue={tenant.settings?.businessName ?? tenant.name}
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
                            defaultValue={tenant.catalogType}
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
                          <label htmlFor="language" className="block text-sm font-medium text-slate-800">
                            Gjuha
                          </label>
                          <select
                            id="language"
                            name="language"
                            defaultValue={tenant.settings?.language ?? "sq"}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                          >
                            <option value="sq">Shqip</option>
                            <option value="en">English</option>
                          </select>
                        </div>

                      </div>
                    </section>

                    <section className="rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Subscription
                      </p>
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
                  <div className="mx-auto max-w-3xl space-y-5">
                    <section className="rounded-[24px] border border-dashed border-slate-300 bg-white p-4 sm:p-5">
                      <p className="text-base font-semibold text-slate-950">Shto kategori te re</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label htmlFor="newCategoryName" className="block text-sm font-medium text-slate-800">
                            Emri i kategorise
                          </label>
                          <input
                            id="newCategoryName"
                            name="newCategoryName"
                            type="text"
                            placeholder="p.sh. Lini shtepie Premium"
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                          />
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="newCategoryPreset" className="block text-sm font-medium text-slate-800">
                            Baza e fushave
                          </label>
                          <select
                            id="newCategoryPreset"
                            name="newCategoryPreset"
                            defaultValue=""
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                          >
                            <option value="" disabled>
                              Zgjidh preset-in
                            </option>
                            {PRODUCT_CATEGORIES.map((categoryName) => (
                              <option key={categoryName} value={categoryName}>
                                {categoryName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      {categoryConfigs.map((category) => (
                        <div
                          key={category.id}
                          className="rounded-[22px] border border-slate-200 bg-white px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-950">{category.categoryName}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {category.productCount} produkte
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                              <span
                                className={`rounded-full px-3 py-1 ${
                                  category.isActive
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {category.isActive ? "Aktive" : "Arkivuar"}
                              </span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                                Konfiguroje te tab-i Variablat
                              </span>
                              <ConfirmActionButton
                                action={deleteCategory}
                                fieldName="categoryId"
                                fieldValue={category.id}
                                confirmMessage={
                                  category.productCount > 0
                                    ? "Kjo kategori ka produkte. Do te arkivohet dhe nuk do te shfaqet per produkte te reja. Vazhdon?"
                                    : "A je i sigurt qe don ta fshish kete kategori?"
                                }
                                buttonLabel={category.productCount > 0 ? "Arkivo" : "Fshi"}
                                className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>
                  </div>
                }
                variables={
                  <div className="mx-auto max-w-3xl space-y-5">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Variablat sipas kategorise</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Ketu vendos fushat qe klienti ploteson kur shton produkt dhe variant.
                      </p>
                    </div>

                    {categoryConfigs.map(({ id, categoryName, isActive, productCount, fieldKey, config }, index) => (
                      <SettingsCategoryCard
                        key={id}
                        id={id}
                        categoryName={categoryName}
                        isActive={isActive}
                        productCount={productCount}
                        fieldKey={fieldKey}
                        config={config}
                        deleteCategoryAction={deleteCategory}
                        defaultOpen={index === 0}
                      />
                    ))}
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
              />
            </div>

            <div className="mx-auto mt-8 max-w-3xl border-t border-slate-200 pt-5">
              <div className="mx-auto max-w-2xl">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 sm:w-auto sm:min-w-[220px]"
                >
                  Ruaj ndryshimet
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}


