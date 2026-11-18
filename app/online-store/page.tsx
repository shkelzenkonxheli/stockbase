import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnlineStoreForm } from "./online-store-form";

export default async function OnlineStorePage() {
  const { tenant } = await requireRole(["SUPER_ADMIN"]);
  const tenantId = tenant!.id;
  const [store, categories, products, warehouses] = await Promise.all([
    prisma.onlineStore.findUnique({ where: { tenantId } }),
    prisma.category.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { tenantId }, select: { id: true, name: true, categoryId: true, variants: { where: { imagePath: { not: null } }, select: { imagePath: true }, orderBy: { id: "asc" }, take: 1 } }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    prisma.warehouse.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const categoryIdSet = new Set(categories.map(({ id }) => id));
  const productIdSet = new Set(products.map(({ id }) => id));

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Online Store</h1>
        <p className="mt-2 text-sm text-slate-600">Përgatit kategoritë, produktet dhe cilësimet për dyqanin online.</p>
      </header>
      <OnlineStoreForm
        categories={categories}
        products={products.map(({ variants, ...product }) => ({ ...product, imagePath: variants[0]?.imagePath ?? null }))}
        warehouses={warehouses}
        initial={{
          name: store?.name ?? tenant!.businessName ?? tenant!.name,
          logoUrl: store?.logoUrl ?? "",
          whatsappNumber: store?.whatsappNumber ?? "",
          warehouseId: warehouses.some(({ id }) => id === store?.warehouseId) ? store?.warehouseId : undefined,
          categoryIds: store?.categoryIds.filter((id) => categoryIdSet.has(id)) ?? [],
          productIds: store?.productIds.filter((id) => productIdSet.has(id)) ?? [],
        }}
      />
    </main>
  );
}

