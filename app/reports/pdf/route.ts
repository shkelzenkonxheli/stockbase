import { NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth";
import {
  BUSINESS_TIME_ZONE,
  getMonthStringInTimeZone,
  getMonthlySalesReport,
} from "@/lib/reports/monthly-sales-report";
import { ReportPdfDocument } from "../report-pdf-document";

export async function GET(request: Request) {
  const currentUser = await requireRole(["SUPER_ADMIN"]);
  const tenantId = currentUser.tenant?.id;
  if (!tenantId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const defaultMonth = getMonthStringInTimeZone(new Date(), BUSINESS_TIME_ZONE);
  const rawMonth = searchParams.get("month")?.trim() || defaultMonth;
  const selectedMonth = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : defaultMonth;

  const report = await getMonthlySalesReport(selectedMonth, tenantId);
  const document = createElement(ReportPdfDocument, { report }) as ReactElement<
    DocumentProps
  >;
  const pdfBuffer = await renderToBuffer(document);
  const pdfBytes = new Uint8Array(pdfBuffer);

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="shkelshoes-report-${selectedMonth}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
