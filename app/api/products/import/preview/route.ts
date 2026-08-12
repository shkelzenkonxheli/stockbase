import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireRole } from "@/lib/auth";
import { suggestImportField } from "@/lib/product-import";

const MAX_PREVIEW_ROWS = 50;
const MAX_FILE_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request) {
  await requireRole(["SUPER_ADMIN"]);

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Zgjidh nje file per import." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "File eshte bosh." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File eshte shume i madh. Maksimumi 8MB." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["csv", "xlsx", "xls"].includes(extension)) {
    return NextResponse.json(
      { error: "Lejohen vetem file CSV, XLSX ose XLS." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return NextResponse.json({ error: "File nuk permban sheet." }, { status: 400 });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: false,
    });

    if (rows.length < 2) {
      return NextResponse.json(
        { error: "File duhet te kete te pakten header dhe nje rresht me te dhena." },
        { status: 400 },
      );
    }

    const headerRow = (rows[0] ?? []).map((cell, index) => {
      const value = String(cell ?? "").trim();
      return value || `Kolona ${index + 1}`;
    });

    const dataRows = rows.slice(1).filter((row) =>
      row.some((cell) => String(cell ?? "").trim() !== ""),
    );

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Nuk u gjeten rreshta me te dhena." }, { status: 400 });
    }

    const previewRows = dataRows.slice(0, MAX_PREVIEW_ROWS).map((row) =>
      headerRow.reduce<Record<string, string>>((accumulator, header, index) => {
        accumulator[header] = String(row[index] ?? "").trim();
        return accumulator;
      }, {}),
    );

    const suggestions = headerRow.reduce<Record<string, string>>((accumulator, header) => {
      accumulator[header] = suggestImportField(header);
      return accumulator;
    }, {});

    return NextResponse.json({
      fileName: file.name,
      totalRows: dataRows.length,
      headers: headerRow,
      previewRows,
      suggestions,
    });
  } catch {
    return NextResponse.json(
      { error: "File nuk u lexua. Kontrollo formatin dhe provo perseri." },
      { status: 400 },
    );
  }
}