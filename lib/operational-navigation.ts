export type OperationalLink = { label: string; href: string; description: string };
export type OperationalGroup = { id: string; title: string; description: string; links: OperationalLink[] };

type Options = {
  role: "SUPER_ADMIN" | "SELLER" | "WAREHOUSE";
  pos: boolean;
  purchases: boolean;
  barcode: boolean;
  inventoryCount: boolean;
  multiWarehouse: boolean;
  socialMedia: boolean;
};

export function getOperationalGroups(options: Options): OperationalGroup[] {
  const admin = options.role === "SUPER_ADMIN";
  const sales = admin || options.role === "SELLER";
  return [
    {
      id: "sales", title: "Shitje", description: "Porosite dhe kasa",
      links: [
        { label: "Porosite", href: "/orders", description: "Shiko dhe menaxho porosite" },
        ...(options.pos && sales ? [{ label: "POS", href: "/pos", description: "Hap kasen dhe shis" }] : []),
      ],
    },
    {
      id: "products", title: "Produkte", description: "Produktet dhe kataloget",
      links: [
        { label: "Produktet", href: "/products", description: "Shiko produktet dhe variantet" },
        ...(admin ? [{ label: "Kataloget", href: "/catalogs", description: "Krijo kataloge per klientet" }] : []),
      ],
    },
    {
      id: "stock", title: "Depo", description: "Levizjet dhe kontrolli i stokut",
      links: admin ? [
        { label: "Hyrje stoku", href: "/stock/incoming", description: "Prano stok ne depo" },
        ...(options.multiWarehouse ? [{ label: "Transfer", href: "/stock/transfer", description: "Leviz stok mes depove" }] : []),
        ...(options.inventoryCount ? [{ label: "Numerim stoku", href: "/stock/count", description: "Kontrollo sasite reale" }] : []),
        ...(options.barcode ? [{ label: "Skanim", href: "/stock/scan", description: "Kerko me barcode" }] : []),
      ] : [],
    },
    {
      id: "supply", title: "Furnizim", description: "Blerjet dhe furnitoret",
      links: admin && options.purchases ? [
        { label: "Purchase Orders", href: "/purchases", description: "Krijo dhe prano porosi blerjeje" },
        { label: "Furnitoret", href: "/suppliers", description: "Menaxho furnitoret" },
      ] : [],
    },
    {
      id: "marketing", title: "Social Media", description: "Publikime nga produktet",
      links: admin && options.socialMedia ? [
        { label: "Instagram studio", href: "/social", description: "Pergatit dhe publiko postime" },
      ] : [],
    },
    {
      id: "insights", title: "Analiza", description: "Raportet dhe aktiviteti",
      links: admin ? [
        { label: "Raportet", href: "/reports", description: "Shiko shitjet dhe performancen" },
        { label: "Aktiviteti", href: "/audit", description: "Historiku i veprimeve" },
      ] : [],
    },
    {
      id: "admin", title: "Administrim", description: "Ekipi dhe konfigurimi",
      links: admin ? [
        { label: "Perdoruesit", href: "/users", description: "Menaxho aksesin e ekipit" },
        { label: "Settings", href: "/settings", description: "Konfiguro StockBase" },
        { label: "Billing", href: "/billing", description: "Plani dhe pagesat" },
      ] : [],
    },
  ].filter((group) => group.links.length > 0);
}
