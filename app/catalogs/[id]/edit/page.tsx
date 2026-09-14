import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CatalogBuilder } from "../../catalog-builder";
import { saveCatalog } from "../../actions";

export default async function EditCatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireRole(["SUPER_ADMIN"]); const { id } = await params; const catalog = await prisma.catalog.findFirst({ where: { id: Number(id), tenantId: currentUser.tenant!.id }, include: { products: true, fields: true } }); if (!catalog) notFound();
  const products = await prisma.product.findMany({ where: { tenantId: currentUser.tenant!.id }, orderBy: { name: "asc" }, include: { category: { select: { name: true } }, variants: { select: { price: true } } } });
  return <main className="px-4 py-6 sm:px-6 lg:px-8"><CatalogBuilder action={saveCatalog} products={products.map((product) => ({ id: product.id, name: product.name, brand: product.brand, category: product.category.name, variants: product.variants.length, price: Number(product.variants[0]?.price ?? 0), imagePath: null }))} initialCatalog={{ id: catalog.id, name: catalog.name, description: catalog.description ?? "", status: catalog.status, layout: catalog.layout, style: catalog.style, isPublic: catalog.isPublic, publicSlug: catalog.publicSlug ?? "", priceMode: catalog.priceMode, stockMode: catalog.stockMode, productIds: catalog.products.map((item) => item.productId), fields: catalog.fields.map((field) => ({ key: field.fieldKey, label: field.fieldKey, enabled: field.enabled, sortOrder: field.sortOrder })) }} /></main>;
}
