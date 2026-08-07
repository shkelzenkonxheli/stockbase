import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { filterInventoryCountLines, normalizeInventoryCountFilter } from "@/lib/inventory-counts";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{ id: string }>;
};

function escapeCsv(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(request: Request, { params }: RouteProps) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  const { id } = await params;
  const sessionId = Number(id);

  if (!tenantId || Number.isNaN(sessionId)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const filter = normalizeInventoryCountFilter(searchParams.get("filter"));

  const session = await prisma.inventoryCountSession.findFirst({
    where: { id: sessionId, tenantId },
    include: {
      warehouse: { select: { name: true } },
      lines: {
        include: {
          variant: {
            select: {
              id: true,
              size: true,
              color: true,
              sku: true,
              imagePath: true,
              product: {
                select: {
                  name: true,
                  brand: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: [
          { variant: { product: { name: "asc" } } },
          { variant: { color: "asc" } },
          { variant: { size: "asc" } },
        ],
      },
    },
  });

  if (!session) {
    return new NextResponse("Not found", { status: 404 });
  }

  const lines = filterInventoryCountLines(session.lines, query, filter);
  const rows = [
    [
      "Produkti",
      "Kategoria",
      "Varianti",
      "SKU",
      "Lokacioni",
      "Stoku sistem",
      "Stoku real",
      "Diferenca",
      "Shenim",
    ].join(","),
    ...lines.map((line) =>
      [
        escapeCsv(
          line.variant.product.brand
            ? `${line.variant.product.brand} ${line.variant.product.name}`
            : line.variant.product.name,
        ),
        escapeCsv(line.variant.product.category.name),
        escapeCsv(`${line.variant.color} / ${line.variant.size}`),
        escapeCsv(line.variant.sku),
        escapeCsv(line.locationCode),
        escapeCsv(line.expectedStock),
        escapeCsv(line.countedStock),
        escapeCsv(line.difference),
        escapeCsv(line.note),
      ].join(","),
    ),
  ];

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"inventory-count-${session.id}.csv\"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request, context: RouteProps) {
  return GET(request, context);
}
