import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function PublicCatalogPage({ params }: { params: Promise<{ publicSlug: string }> }) {
  const { publicSlug } = await params;
  const catalog = await prisma.catalog.findFirst({
    where: { publicSlug, isPublic: true, status: "ACTIVE" },
    include: {
      tenant: { include: { settings: true } },
      fields: { where: { enabled: true }, orderBy: { sortOrder: "asc" } },
      products: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            include: {
              category: true,
              variants: { orderBy: { price: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!catalog) notFound();
  const fieldKeys = new Set(catalog.fields.map((field) => field.fieldKey)); const columns = catalog.layout === "TWO_COLUMNS" ? "md:grid-cols-2" : catalog.layout === "FOUR_COLUMNS" ? "md:grid-cols-3 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"; const businessName = catalog.tenant.settings?.businessName || catalog.tenant.name;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-7xl"><header className="rounded-[28px] bg-slate-950 px-6 py-10 text-white sm:px-10"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{businessName}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{catalog.name}</h1>{catalog.description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{catalog.description}</p> : null}</header><section className={`mt-6 grid gap-4 ${columns}`}>{catalog.products.map((item) => { const product = item.product; const variants = product.variants; const price = Number(variants[0]?.price ?? 0); const stock = variants.reduce((sum, variant) => sum + variant.stock, 0); const imagePath = variants.find((variant) => variant.imagePath)?.imagePath; return <article key={item.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">{imagePath ? <img src={imagePath} alt={product.name} className="h-40 w-full rounded-xl bg-slate-100 object-contain p-2" /> : <div className="h-40 rounded-xl bg-slate-100" />}{fieldKeys.has("brand") && product.brand ? <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{product.brand}</p> : null}{fieldKeys.has("name") ? <h2 className="mt-1 font-semibold text-slate-950">{product.name}</h2> : null}{fieldKeys.has("category") ? <p className="mt-1 text-sm text-slate-500">{product.category.name}</p> : null}{catalog.priceMode === "RETAIL" ? <p className="mt-4 text-lg font-semibold text-slate-950">EUR {price.toFixed(2)}</p> : null}{catalog.priceMode === "WHOLESALE" ? <p className="mt-4 text-sm font-medium text-slate-500">Kontakto per cmim wholesale</p> : null}{catalog.stockMode === "EXACT" ? <p className="mt-2 text-sm text-slate-500">Stok: {stock}</p> : null}{catalog.stockMode === "AVAILABILITY" ? <p className={stock > 0 ? "mt-2 text-sm font-semibold text-emerald-700" : "mt-2 text-sm font-semibold text-rose-700"}>{stock > 0 ? "Ne stok" : "Jasht stokut"}</p> : null}</article>; })}</section></div></main>;
}
