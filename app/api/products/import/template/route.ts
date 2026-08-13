import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantWarehouses } from "@/lib/warehouses";

function csvEscape(value: string) {
  const normalized = String(value ?? "");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function buildCsv(rows: string[][]) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function buildSampleRows(categories: string[], warehouses: string[]) {
  const warehouseA = warehouses[0] ?? "Depo 1";
  const warehouseB = warehouses[1] ?? warehouseA;
  const hasCategory = (name: string) => categories.some((category) => category.toLowerCase() === name.toLowerCase());

  const rows: string[][] = [
    [
      "Emri i produktit",
      "Brandi",
      "Kategoria",
      "Depoja",
      "Madhesia",
      "Ngjyra",
      "Stoku",
      "Cmimi",
      "Materiali",
      "Fuqia",
      "Lokacioni",
    ],
  ];

  if (hasCategory("Patika")) {
    rows.push(["Nike Air Force", "Nike", "Patika", warehouseA, "41", "Black", "5", "99.99", "", "", "A-01"]);
    rows.push(["Nike Air Force", "Nike", "Patika", warehouseA, "42", "Black", "4", "99.99", "", "", "A-01"]);
  }

  if (hasCategory("Kepuce")) {
    rows.push(["Kepuce Classic", "Clarks", "Kepuce", warehouseA, "43", "Brown", "3", "119.00", "", "", "K-01"]);
  }

  if (hasCategory("Sandale")) {
    rows.push(["Sandale Summer", "Zara", "Sandale", warehouseA, "39", "Beige", "4", "29.99", "", "", "S-01"]);
  }

  if (hasCategory("Lini shtepie")) {
    rows.push(["Peshqir Premium", "", "Lini shtepie", warehouseB, "50x90", "Beige", "12", "14.50", "Pambuk 100%", "", "B-03"]);
  }

  if (hasCategory("Pajisje elektrike")) {
    rows.push(["Toster Pro", "Philips", "Pajisje elektrike", warehouseA, "Standard", "White", "4", "55.00", "", "800W", "E-02"]);
  }

  if (hasCategory("Dekor")) {
    rows.push(["Llamba Deco", "", "Dekor", warehouseB, "40x25", "Gold", "3", "24.99", "Metal", "", "D-01"]);
  }

  if (rows.length === 1) {
    rows.push(["Produkt Shembull", "", categories[0] ?? "Kategoria", warehouseA, "standard", "standard", "5", "19.99", "", "", "A-01"]);
  }

  return rows;
}

export async function GET(request: Request) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenant = currentUser.tenant;

  if (!tenant?.id) {
    return NextResponse.json({ error: "Tenant mungon." }, { status: 400 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "sample" ? "sample" : "template";

  const [categories, warehouses] = await Promise.all([
    prisma.category.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    getTenantWarehouses(tenant.id, tenant.catalogConfig),
  ]);

  const header = [
    "Emri i produktit",
    "Brandi",
    "Kategoria",
    "Depoja",
    "Madhesia",
    "Ngjyra",
    "Stoku",
    "Cmimi",
    "Materiali",
    "Fuqia",
    "Lokacioni",
  ];

  const rows =
    kind === "sample"
      ? buildSampleRows(
          categories.map((category) => category.name),
          warehouses.map((warehouse) => warehouse.name),
        )
      : [header, ["", "", "", "", "", "", "", "", "", "", ""]];

  const csv = buildCsv(rows);
  const fileName = kind === "sample" ? "stockbase-import-sample.csv" : "stockbase-import-template.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${fileName}`,
      "Cache-Control": "no-store",
    },
  });
}