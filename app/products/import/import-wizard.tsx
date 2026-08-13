"use client";

import { useMemo, useRef, useState } from "react";
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

export function ProductImportWizard({ categories, warehouses }: ImportWizardProps) {
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

  const mappedHeaders = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);

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
    } catch (fetchError) {
      setPreview(null);
      setMapping({});
      setError(fetchError instanceof Error ? fetchError.message : "Preview deshtoi.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleImport() {
    if (!file || !preview) {
      setError("Ngarko file dhe bej preview para importit.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setValidationErrors([]);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      formData.append("duplicateStrategy", duplicateStrategy);

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
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Importi deshtoi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
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
              Ngarko CSV ose Excel, kontrollo kolonat, bej mapimin dhe importo produktet ne tenant-in aktual.
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

      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">1. Upload file</p>
            <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setFile(nextFile);
                  setPreview(null);
                  setMapping({});
                  setResult(null);
                  setError(null);
                  setValidationErrors([]);
                }}
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {file ? file.name : "Nuk ke zgjedhur file akoma"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Lejohen CSV, XLSX dhe XLS deri ne 8MB.</p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Zgjidh file
                </button>
              </div>

              <button
                type="button"
                onClick={handlePreview}
                disabled={!file || loadingPreview}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingPreview ? "Po lexohen kolonat..." : "Shfaq preview"}
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">2. Mapimi i kolonave</p>
              {preview ? (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={submitting}
                  className="hidden items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
                >
                  {submitting ? "Po importohet..." : "Import final"}
                </button>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {FIELD_OPTIONS.map((field) => (
                <div key={field.value} className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                  <label className="text-sm font-medium text-slate-800">
                    {field.label}
                    {REQUIRED_IMPORT_FIELDS.includes(field.value) ? (
                      <span className="ml-1 text-rose-500">*</span>
                    ) : null}
                  </label>
                  <select
                    value={mapping[field.value] ?? ""}
                    disabled={!preview}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [field.value]: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50"
                  >
                    <option value="">Mos e perdor</option>
                    {preview?.headers.map((header) => {
                      const isTaken = mappedHeaders.has(header) && mapping[field.value] !== header;
                      return (
                        <option key={header} value={header} disabled={isTaken}>
                          {header}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <label className="block text-sm font-medium text-slate-800">
                Nese varianti ekziston tashme
              </label>
              <select
                value={duplicateStrategy}
                onChange={(event) =>
                  setDuplicateStrategy(event.target.value as "skip" | "add_stock" | "replace")
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
              >
                <option value="add_stock">Shto stok te ekzistuesi</option>
                <option value="skip">Kaloje rreshtin</option>
                <option value="replace">Perditeso ekzistuesen</option>
              </select>
            </div>

            {preview ? (
              <div className="mt-5 sm:hidden">
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Po importohet..." : "Import final"}
                </button>
              </div>
            ) : null}
          </div>

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

        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">3. Preview</p>
                <p className="mt-1 text-sm text-slate-600">
                  {preview ? `${preview.totalRows} rreshta u gjeten ne file.` : "Pasi te ngarkosh file, ketu shfaqet preview i kolonave."}
                </p>
                {preview ? (
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Po shfaqen {preview.previewRows.length} nga {preview.totalRows} rreshta.
                  </p>
                ) : null}
              </div>
              {preview ? (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? "Po importohet..." : "Import final"}
                </button>
              ) : null}
            </div>

            {preview ? (
              <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
                <div className="max-h-[420px] overflow-x-auto overflow-y-scroll">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="w-[72px] px-4 py-3">Rreshti</th>
                        {preview.headers.map((header) => (
                          <th key={header} className="px-4 py-3">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {preview.previewRows.map((row, index) => (
                        <tr key={index} className="align-top">
                          <td className="px-4 py-3 font-medium text-slate-500">{index + 2}</td>
                          {preview.headers.map((header) => (
                            <td key={header} className="px-4 py-3 text-slate-700">
                              <span className="block max-w-[220px] truncate" title={row[header] ?? ""}>
                                {row[header] || "-"}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-10 text-center text-sm text-slate-500">
                Preview i file do te shfaqet ketu.
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Udhezim i shpejte</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>- Fushat minimale: emri i produktit, kategoria, stoku, cmimi.</p>
              <p>- Nese mungon ngjyra ose madhesia, sistemi perdor `standard`.</p>
              <p>- Kategoria duhet te ekzistoje ne tenant.</p>
              <p>- Nese perdor depo, emri i depos duhet te jete identik me nje depo ekzistuese.</p>
              <p>- Importi shton stok ne inventar dhe krijon stock movements si `incoming stock`.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
