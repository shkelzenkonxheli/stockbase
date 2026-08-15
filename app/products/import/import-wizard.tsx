"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IMPORT_FIELD_KEYS,
  IMPORT_FIELD_LABELS,
  REQUIRED_IMPORT_FIELDS,
  type ImportFieldKey,
} from "@/lib/product-import";

type PreviewResponse = {
  fileName: string;
  totalRows: number;
  headers: string[];
  previewRows: Array<Record<string, string>>;
  suggestions: Record<string, string>;
};

type ImportWizardProps = {
  categories: string[];
  warehouses: string[];
  brands: string[];
};

type ImportResult = {
  createdProducts: number;
  createdVariants: number;
  updatedVariants: number;
  updatedInventories: number;
  skippedRows: number;
};

const FIELD_OPTIONS = IMPORT_FIELD_KEYS.map((field) => ({
  value: field,
  label: IMPORT_FIELD_LABELS[field],
}));

function createInitialMapping(preview: PreviewResponse) {
  const mapping: Partial<Record<ImportFieldKey, string>> = {};

  for (const header of preview.headers) {
    const suggested = preview.suggestions[header];
    if (suggested && IMPORT_FIELD_KEYS.includes(suggested as ImportFieldKey)) {
      mapping[suggested as ImportFieldKey] = header;
    }
  }

  return mapping;
}

function escapeCsvValue(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function ProductImportWizard({ categories, warehouses, brands }: ImportWizardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportFieldKey, string>>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "add_stock" | "replace">(
    "add_stock",
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [hiddenHeaders, setHiddenHeaders] = useState<string[]>([]);
  const [removedRows, setRemovedRows] = useState<number[]>([]);
  const [showMappingControls, setShowMappingControls] = useState(false);
  const [missingFieldsModalOpen, setMissingFieldsModalOpen] = useState(false);
  const [globalSelections, setGlobalSelections] = useState({
    categoryName: "",
    warehouseName: "",
    brandName: "",
  });

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewOpen]);

  const visibleHeaders = useMemo(
    () => preview?.headers.filter((header) => !hiddenHeaders.includes(header)) ?? [],
    [hiddenHeaders, preview],
  );

  const visibleRows = useMemo(
    () => preview?.previewRows.filter((_, index) => !removedRows.includes(index)) ?? [],
    [preview, removedRows],
  );

  const removedRowItems = useMemo(
    () =>
      removedRows
        .slice()
        .sort((left, right) => left - right)
        .map((index) => ({
          index,
          rowNumber: index + 2,
        })),
    [removedRows],
  );

  const mappedHeaders = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);

  const missingRequiredFields = useMemo(
    () => REQUIRED_IMPORT_FIELDS.filter((field) => !mapping[field] || !visibleHeaders.includes(mapping[field]!)),
    [mapping, visibleHeaders],
  );

  const needsCategorySelection = useMemo(
    () => !mapping.category || !visibleHeaders.includes(mapping.category),
    [mapping.category, visibleHeaders],
  );

  const needsWarehouseSelection = useMemo(
    () => !mapping.warehouse || !visibleHeaders.includes(mapping.warehouse),
    [mapping.warehouse, visibleHeaders],
  );

  const needsBrandSelection = useMemo(
    () => !mapping.brand || !visibleHeaders.includes(mapping.brand),
    [mapping.brand, visibleHeaders],
  );

  const effectiveMissingRequiredFields = useMemo(
    () =>
      missingRequiredFields.filter((field) => {
        if (field === "category") {
          return !globalSelections.categoryName.trim();
        }
        return true;
      }),
    [globalSelections.categoryName, missingRequiredFields],
  );

  function resetPreviewState() {
    setPreview(null);
    setMapping({});
    setHiddenHeaders([]);
    setRemovedRows([]);
    setPreviewOpen(false);
    setShowMappingControls(false);
    setMissingFieldsModalOpen(false);
    setGlobalSelections({
      categoryName: "",
      warehouseName: "",
      brandName: "",
    });
  }

  async function handlePreview() {
    if (!file) {
      setError("Zgjidh nje file per import.");
      return;
    }

    setLoadingPreview(true);
    setError(null);
    setValidationErrors([]);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/products/import/preview", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Preview deshtoi.");
      }

      setPreview(payload);
      setMapping(createInitialMapping(payload));
      setHiddenHeaders([]);
      setRemovedRows([]);
      setShowMappingControls(false);
      setPreviewOpen(true);
    } catch (fetchError) {
      resetPreviewState();
      setError(fetchError instanceof Error ? fetchError.message : "Preview deshtoi.");
    } finally {
      setLoadingPreview(false);
    }
  }

  function buildFilteredImportFile() {
    if (!file || !preview) {
      return null;
    }

    const csvHeaders = visibleHeaders;
    const csvRows = visibleRows;
    const csvContent = [
      csvHeaders.map((header) => escapeCsvValue(header)).join(","),
      ...csvRows.map((row) => csvHeaders.map((header) => escapeCsvValue(row[header] ?? "")).join(",")),
    ].join("\r\n");

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([csvContent], `${baseName}-filtered.csv`, {
      type: "text/csv;charset=utf-8",
    });
  }

  async function handleImport() {
    if (!file || !preview) {
      setError("Ngarko file dhe bej preview para importit.");
      return;
    }

    if (visibleHeaders.length === 0) {
      setError("Duhet te mbetet te pakten nje kolone ne preview.");
      return;
    }

    if (visibleRows.length === 0) {
      setError("Duhet te mbetet te pakten nje rresht per import.");
      return;
    }

    if (effectiveMissingRequiredFields.length > 0) {
      setError("Mapo fushat e detyrueshme para importit.");
      return;
    }

    const filteredFile = buildFilteredImportFile();
    if (!filteredFile) {
      setError("Nuk u pergatit file per import.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setValidationErrors([]);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", filteredFile);
      formData.append("mapping", JSON.stringify(mapping));
      formData.append("duplicateStrategy", duplicateStrategy);
      formData.append("globalSelections", JSON.stringify(globalSelections));

      const response = await fetch("/api/products/import/commit", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        setValidationErrors(Array.isArray(payload.validationErrors) ? payload.validationErrors : []);
        throw new Error(payload.error ?? "Importi deshtoi.");
      }

      setResult(payload.imported);
      setValidationErrors([]);
      setError(null);
      setPreviewOpen(false);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Importi deshtoi.");
    } finally {
      setSubmitting(false);
    }
  }

  function hideHeader(header: string) {
    setHiddenHeaders((current) => (current.includes(header) ? current : [...current, header]));
    setMapping((current) => {
      const next = { ...current };
      for (const [field, mappedHeader] of Object.entries(next)) {
        if (mappedHeader === header) {
          delete next[field as ImportFieldKey];
        }
      }
      return next;
    });
  }

  function removeRow(index: number) {
    setRemovedRows((current) => (current.includes(index) ? current : [...current, index]));
  }

  function restoreAllColumns() {
    setHiddenHeaders([]);
  }

  function restoreAllRows() {
    setRemovedRows([]);
  }

  function restoreRow(index: number) {
    setRemovedRows((current) => current.filter((item) => item !== index));
  }

  function updateGlobalSelection(field: "categoryName" | "warehouseName" | "brandName", value: string) {
    setGlobalSelections((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const categoryChoices = categories.filter(Boolean);
  const warehouseChoices = warehouses.filter(Boolean);
  const brandChoices = brands.filter(Boolean);
  const hasMissingGlobalFields = needsCategorySelection || needsWarehouseSelection || needsBrandSelection;

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Excel / CSV import
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Importo produkte me file
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Ngarko file-in, hape preview ne modal, pastro kolonat ose rreshtat qe s'te duhen dhe importo vetem pjesen qe do.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p>
                Kategori aktive: <span className="font-medium text-slate-900">{categories.join(", ") || "-"}</span>
              </p>
              <p className="mt-1">
                Depo aktive: <span className="font-medium text-slate-900">{warehouses.join(", ") || "Pa depo"}</span>
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">1. Upload</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">Ngarko file dhe hape preview</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Preview hapet ne nje modal pune. Aty mundesh me fsheh kolona, me heq rreshta dhe me mapu direkt pa panel shtese.
                </p>
              </div>

              {preview ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold text-emerald-950">Preview gati</p>
                  <p className="mt-1">{visibleRows.length} rreshta, {visibleHeaders.length} kolona aktive</p>
                </div>
              ) : null}
            </div>

            <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setFile(nextFile);
                  resetPreviewState();
                  setResult(null);
                  setError(null);
                  setValidationErrors([]);
                }}
              />

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {file ? file.name : "Nuk ke zgjedhur file akoma"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Lejohen CSV, XLSX dhe XLS deri ne 8MB.</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Zgjidh file
                  </button>
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={!file || loadingPreview}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingPreview ? "Po hapet preview..." : preview ? "Hap preview" : "Shfaq preview"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {preview ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">2. Preview</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Hape preview dhe zgjedh strategjine aty lart, para importit final.
                </p>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Shfaq preview
                  </button>
                </div>
              </div>
            ) : null}

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gjendja e preview</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>- Kolonat mappohen direkt ne modal, mbi tabelen.</p>
                <p>- Rreshtat e hequr nuk importohen fare.</p>
                <p>- Kolonat e fshehura nuk dergohen ne import.</p>
                <p>- Strategjia e importit vendoset brenda preview modalit.</p>
                <p>- Fushat e detyrueshme duhet te mbeten te mapuara para importit final.</p>
              </div>

              {preview ? (
                <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    {visibleRows.length} rreshta aktive
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    {visibleHeaders.length} kolona aktive
                  </span>
                  {effectiveMissingRequiredFields.length > 0 ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">
                      Mungojne {effectiveMissingRequiredFields.length} fusha te detyrueshme
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                      Gati per import
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {validationErrors.length > 0 ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            <p className="font-semibold">Gabime ne validim</p>
            <ul className="mt-2 space-y-1">
              {validationErrors.slice(0, 12).map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
            {validationErrors.length > 12 ? (
              <p className="mt-2 text-xs text-amber-700">+ {validationErrors.length - 12} gabime tjera</p>
            ) : null}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-4 text-sm text-emerald-900 shadow-[0_12px_30px_rgba(16,185,129,0.08)] sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-emerald-950">Importi u krye me sukses.</p>
                <p className="mt-1 text-xs text-emerald-800/80">
                  Rezultati i importit per file-in aktual.
                </p>
              </div>
              <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Import OK
              </span>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Produkte te reja</p>
                  <p className="text-xs text-slate-500">Produkte te krijuara nga importi</p>
                </div>
                <p className="text-2xl font-semibold leading-none text-slate-950">{result.createdProducts}</p>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Variante te reja</p>
                  <p className="text-xs text-slate-500">Variante te krijuara nga importi</p>
                </div>
                <p className="text-2xl font-semibold leading-none text-slate-950">{result.createdVariants}</p>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Variante te perditesuara</p>
                  <p className="text-xs text-slate-500">Ekzistueset qe u rifreskuan</p>
                </div>
                <p className="text-2xl font-semibold leading-none text-slate-950">{result.updatedVariants}</p>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Inventar i perditesuar</p>
                  <p className="text-xs text-slate-500">Levizje ose rregullime stoku</p>
                </div>
                <p className="text-2xl font-semibold leading-none text-slate-950">{result.updatedInventories}</p>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Rreshta te kaluar</p>
                  <p className="text-xs text-slate-500">U anashkaluan sipas strategjise</p>
                </div>
                <p className="text-2xl font-semibold leading-none text-slate-950">{result.skippedRows}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {previewOpen && preview ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <button type="button" className="absolute inset-0" aria-label="Mbyll preview" onClick={() => setPreviewOpen(false)} />
          <div className="relative z-10 flex h-[min(84vh,760px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.24)]">
            <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preview workspace</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{preview.fileName}</h3>
                  <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                    Po shfaqen {visibleRows.length} nga {preview.totalRows} rreshta dhe {visibleHeaders.length} nga {preview.headers.length} kolona.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Mbylle preview
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={
                      submitting ||
                      effectiveMissingRequiredFields.length > 0 ||
                      visibleRows.length === 0 ||
                      visibleHeaders.length === 0
                    }
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Po importohet..." : "Import final"}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600">
                  <span className="px-1 font-medium text-slate-700">Strategjia:</span>
                  {[
                    { value: "add_stock", label: "Shto stok" },
                    { value: "skip", label: "Kalo rreshtin" },
                    { value: "replace", label: "Perditeso" },
                  ].map((option) => {
                    const isActive = duplicateStrategy === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDuplicateStrategy(option.value as "skip" | "add_stock" | "replace")}
                        className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                          isActive
                            ? "bg-slate-950 text-white shadow-sm"
                            : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {hasMissingGlobalFields ? (
                    <button
                      type="button"
                      onClick={() => setMissingFieldsModalOpen(true)}
                      className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100"
                    >
                      Mungon konfigurim
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowMappingControls((current) => !current)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    {showMappingControls ? "Fshih mapimin" : "Shfaq mapimin"}
                  </button>
                  <button
                    type="button"
                    onClick={restoreAllColumns}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Rikthe kolonat ({hiddenHeaders.length})
                  </button>
                  <button
                    type="button"
                    onClick={restoreAllRows}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Rikthe rreshtat ({removedRows.length})
                  </button>
                  {effectiveMissingRequiredFields.length > 0 ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                      Mungojne: {effectiveMissingRequiredFields.map((field) => IMPORT_FIELD_LABELS[field]).join(", ")}
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      Te gjitha fushat e detyrueshme jane mapuar
                    </span>
                  )}
                </div>
              </div>

              {removedRowItems.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-slate-500">Undo rreshti:</span>
                  {removedRowItems.map((item) => (
                    <button
                      key={item.index}
                      type="button"
                      onClick={() => restoreRow(item.index)}
                      className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Rikthe {item.rowNumber}
                    </button>
                  ))}
                </div>
              ) : null}

            </div>

            <div className="flex-1 overflow-hidden bg-slate-50/60 p-3 sm:p-4">
              {visibleHeaders.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white text-sm text-slate-500">
                  Nuk ka mbetur asnje kolone. Rikthe kolonat per te vazhduar.
                </div>
              ) : visibleRows.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white text-sm text-slate-500">
                  Nuk ka mbetur asnje rresht. Rikthe rreshtat per te vazhduar.
                </div>
              ) : (
                <div className="h-full overflow-auto rounded-[20px] border border-slate-200 bg-white">
                  <table className="min-w-full text-[13px]">
                    <thead className="sticky top-0 z-20 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="sticky left-0 z-30 w-[60px] border-r border-slate-200 bg-slate-50 px-2 py-2">Rreshti</th>
                        {visibleHeaders.map((header) => (
                          <th key={header} className="min-w-[116px] border-r border-slate-200 px-2 py-2 last:border-r-0">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[10px] leading-4 text-slate-600">{header}</span>
                                <button
                                  type="button"
                                  onClick={() => hideHeader(header)}
                                  className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100"
                                >
                                  Largo
                                </button>
                              </div>
                              {showMappingControls ? (
                                <select
                                  value={FIELD_OPTIONS.find((field) => mapping[field.value] === header)?.value ?? ""}
                                  onChange={(event) => {
                                    const selectedField = event.target.value as ImportFieldKey | "";
                                    setMapping((current) => {
                                      const next = { ...current };
                                      for (const key of IMPORT_FIELD_KEYS) {
                                        if (next[key] === header) {
                                          delete next[key];
                                        }
                                      }
                                      if (selectedField) {
                                        next[selectedField] = header;
                                      }
                                      return next;
                                    });
                                  }}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
                                >
                                  <option value="">Mos e perdor</option>
                                  {FIELD_OPTIONS.map((field) => {
                                    const isTaken =
                                      mappedHeaders.has(mapping[field.value] ?? "") && mapping[field.value] !== header;
                                    return (
                                      <option key={field.value} value={field.value} disabled={Boolean(isTaken)}>
                                        {field.label}{REQUIRED_IMPORT_FIELDS.includes(field.value) ? " *" : ""}
                                      </option>
                                    );
                                  })}
                                </select>
                              ) : null}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {visibleRows.map((row, index) => {
                        const sourceIndex = preview.previewRows.findIndex((candidate, candidateIndex) => candidateIndex === candidateIndex && !removedRows.includes(candidateIndex) && candidate === row);
                        const displayRowNumber = sourceIndex + 2;
                        return (
                          <tr key={`${displayRowNumber}-${index}`} className="align-top">
                            <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-2 py-2">
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-[12px] font-medium text-slate-500">{displayRowNumber}</p>
                                <button
                                  type="button"
                                  onClick={() => removeRow(sourceIndex)}
                                  className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-100"
                                >
                                  Largo
                                </button>
                              </div>
                            </td>
                            {visibleHeaders.map((header) => (
                              <td key={header} className="border-r border-slate-100 px-2 py-2 text-[12px] text-slate-700 last:border-r-0">
                                <span className="block max-w-[124px] truncate leading-5" title={row[header] ?? ""}>
                                  {row[header] || "-"}
                                </span>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {missingFieldsModalOpen ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Mbyll konfigurimin e fushave qe mungojne"
            onClick={() => setMissingFieldsModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-xl rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Fusha qe mungojne
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  Zgjedh vlerat per kete import
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Perdoret vetem per kolonat qe mungojne ne file dhe aplikohet per te gjithe rreshtat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMissingFieldsModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
              >
                X
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {needsCategorySelection ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Kategoria
                  </label>
                  <input
                    list="import-category-options"
                    value={globalSelections.categoryName}
                    onChange={(event) => updateGlobalSelection("categoryName", event.target.value)}
                    placeholder="Zgjedh ose shkruaj kategori"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    E detyrueshme. Mund te zgjedhesh nga sistemi ose te shkruash nje te re.
                  </p>
                </div>
              ) : null}

              {needsWarehouseSelection ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Depoja
                  </label>
                  <input
                    list="import-warehouse-options"
                    value={globalSelections.warehouseName}
                    onChange={(event) => updateGlobalSelection("warehouseName", event.target.value)}
                    placeholder="Zgjedh ose shkruaj depo"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Opsionale. Nese e le bosh, importi nuk vendos depo.
                  </p>
                </div>
              ) : null}

              {needsBrandSelection ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Brandi
                  </label>
                  <input
                    list="import-brand-options"
                    value={globalSelections.brandName}
                    onChange={(event) => updateGlobalSelection("brandName", event.target.value)}
                    placeholder="Zgjedh ose shkruaj brand"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Opsionale. Mund te perdorësh brand ekzistues ose nje te ri.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Pasi t'i zgjedhesh, kthehu te preview dhe vazhdo me importin.
              </p>
              <button
                type="button"
                onClick={() => setMissingFieldsModalOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ruaj dhe mbyll
              </button>
            </div>

            <datalist id="import-category-options">
              {categoryChoices.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <datalist id="import-warehouse-options">
              {warehouseChoices.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <datalist id="import-brand-options">
              {brandChoices.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
        </div>
      ) : null}
    </>
  );
}
