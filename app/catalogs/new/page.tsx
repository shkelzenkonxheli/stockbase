import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CatalogBuilder } from "../catalog-builder";
import { saveCatalog } from "../actions";

export default async function NewCatalogPage() {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const products = await prisma.product.findMany({ where: { tenantId: currentUser.tenant!.id }, orderBy: { name: "asc" }, include: { category: { select: { name: true } }, variants: { select: { price: true } } } });
  return <main className="px-4 py-6 sm:px-6 lg:px-8"><CatalogBuilder action={saveCatalog} products={products.map((product) => ({ id: product.id, name: product.name, brand: product.brand, category: product.category.name, variants: product.variants.length, price: Number(product.variants[0]?.price ?? 0), imagePath: null }))} /></main>;
}
