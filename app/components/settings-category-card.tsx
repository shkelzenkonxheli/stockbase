"use client";

import { useMemo, useState } from "react";
import type {
  CategoryConfig,
  CustomFieldInputType,
  CustomVariantField,
} from "@/lib/product-taxonomy";
import { ConfirmActionButton } from "@/app/components/confirm-action-button";

type VariableKey = "size" | "color" | "material" | "power";
type VariableInputType = "text" | "number" | "select";

type SettingsCategoryCardProps = {
  id: number;
  categoryName: string;
  isActive: boolean;
  productCount: number;
  fieldKey: string;
  config: CategoryConfig;
  deleteCategoryAction: (formData: FormData) => void | Promise<void>;
  defaultOpen?: boolean;
};

type VariableDefinition = {
  key: VariableKey;
  title: string;
  label: string;
  inputType: VariableInputType;
  removable: boolean;
  enabled: boolean;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toBooleanValue(value: boolean) {
  return value ? "true" : "false";
}

function inputTypeLabel(value: VariableInputType) {
  if (value === "number") return "Numer";
  if (value === "select") return "Liste";
  return "Text";
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
        {hint ? <p className="mt-1 text-sm text-slate-600">{hint}</p> : null}
      </div>
    </div>
  );
}

function RowShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">{children}</div>;
}

export function SettingsCategoryCard({
  id,
  categoryName,
  isActive,
  productCount,
  fieldKey,
  config,
  deleteCategoryAction,
  defaultOpen = false,
}: SettingsCategoryCardProps) {
  const normalizedCategory = normalize(categoryName);
  const isFootwearCategory =
    normalizedCategory === "patika" ||
    normalizedCategory === "kepuce" ||
    normalizedCategory === "sandale";
  const isElectricalCategory = normalizedCategory === "pajisje elektrike";

  const [showBrand, setShowBrand] = useState(config.showProductBrandField);
  const [sharedPhotoByColor, setSharedPhotoByColor] = useState(config.sharedVariantImageByColor);
  const [showMaterialField, setShowMaterialField] = useState(config.showMaterialField);
  const [showPowerField, setShowPowerField] = useState(config.showPowerField);
  const [materialLabel, setMaterialLabel] = useState(config.materialLabel);
  const [powerLabel, setPowerLabel] = useState(config.powerLabel);
  const [materialInputType, setMaterialInputType] = useState<VariableInputType>(
    config.materialInputType,
  );
  const [powerInputType, setPowerInputType] = useState<VariableInputType>(config.powerInputType);
  const [customFields, setCustomFields] = useState<CustomVariantField[]>(
    config.customVariantFields ?? [],
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draftVariableName, setDraftVariableName] = useState("");
  const [draftVariableType, setDraftVariableType] = useState<CustomFieldInputType>("text");

  const activeVariables = useMemo<VariableDefinition[]>(() => {
    const variables: VariableDefinition[] = [
      {
        key: "size",
        title: "Variabla kryesore",
        label: config.sizeLabel,
        inputType: config.sizeInputType,
        removable: false,
        enabled: true,
      },
      {
        key: "color",
        title: "Ngjyra",
        label: config.colorLabel,
        inputType: config.colorInputType,
        removable: false,
        enabled: true,
      },
    ];

    if (showMaterialField) {
      variables.push({
        key: "material",
        title: "Materiali",
        label: materialLabel,
        inputType: materialInputType,
        removable: true,
        enabled: true,
      });
    }

    if (showPowerField) {
      variables.push({
        key: "power",
        title: "Fuqia",
        label: powerLabel,
        inputType: powerInputType,
        removable: true,
        enabled: true,
      });
    }

    return variables;
  }, [
    config.colorInputType,
    config.colorLabel,
    config.sizeInputType,
    config.sizeLabel,
    materialInputType,
    materialLabel,
    powerInputType,
    powerLabel,
    showMaterialField,
    showPowerField,
  ]);

  function openVariableModal() {
    setDraftVariableName("");
    setDraftVariableType("text");
    setIsModalOpen(true);
  }

  function applyVariable() {
    const nextLabel = draftVariableName.trim();
    if (!nextLabel) {
      return;
    }

    const baseId = nextLabel
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const fallbackId = baseId || `field_${Date.now()}`;
    let nextId = fallbackId;
    let counter = 2;

    while (customFields.some((field) => field.id === nextId)) {
      nextId = `${fallbackId}_${counter}`;
      counter += 1;
    }

    setCustomFields((current) => [
      ...current,
      {
        id: nextId,
        label: nextLabel,
        type: draftVariableType,
        enabled: true,
      },
    ]);
    setIsModalOpen(false);
  }

  return (
    <>
      <details
        open={defaultOpen}
        className="group rounded-[26px] border border-slate-200 bg-white shadow-sm"
      >
        <input type="hidden" name="categoryIds" value={id} />
        <input type="hidden" name={`categoryFieldKey__${id}`} value={fieldKey} />

        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-950">{categoryName}</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {productCount} produkte
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  isActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {isActive ? "Aktive" : "Arkivuar"}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{config.description}</p>
          </div>

          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180"
          >
            <path
              d="m5 7.5 5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>

        <div className="space-y-5 border-t border-slate-200 px-5 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_180px]">
            <div className="space-y-2">
              <label
                htmlFor={`categoryName__${id}`}
                className="block text-sm font-medium text-slate-800"
              >
                Emri i kategorise
              </label>
              <input
                id={`categoryName__${id}`}
                name={`categoryName__${id}`}
                type="text"
                defaultValue={categoryName}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
              />
            </div>

            <div className="xl:self-end">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name={`${fieldKey}__isActive`}
                  defaultChecked={isActive}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                />
                Kategoria aktive
              </label>
            </div>

            <div className="xl:self-end">
              <ConfirmActionButton
                action={deleteCategoryAction}
                fieldName="categoryId"
                fieldValue={id}
                confirmMessage={
                  productCount > 0
                    ? "Kjo kategori ka produkte. Do te arkivohet dhe nuk do te shfaqet per produkte te reja. Vazhdon?"
                    : "A je i sigurt qe don ta fshish kete kategori?"
                }
                buttonLabel={productCount > 0 ? "Arkivo" : "Fshi"}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              />
            </div>
          </div>

          <div className="grid gap-5">
            <section className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
              <SectionHeader title="Produkti" />

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                <RowShell>
                  <label
                    htmlFor={`${fieldKey}__productNameLabel`}
                    className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                  >
                    Etiketa e emrit
                  </label>
                  <input
                    id={`${fieldKey}__productNameLabel`}
                    name={`${fieldKey}__productNameLabel`}
                    type="text"
                    defaultValue={config.productNameLabel}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  />
                </RowShell>

                <RowShell>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Brandi</p>
                      <p className="mt-1 text-xs text-slate-500">Shfaqet te produkti.</p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={showBrand}
                        onChange={(event) => setShowBrand(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                      />
                      Shfaq
                    </label>
                  </div>
                </RowShell>
              </div>
            </section>

            <section className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
              <SectionHeader
                title="Varianti"
                hint="Mbaj vetem fushat qe klienti ploteson realisht kur shton variant."
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Variablat standarde mbeten aktive. Shto vetem ato shtese qe te duhen.
                </p>
                <button
                  type="button"
                  onClick={openVariableModal}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Shto variable
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {activeVariables.map((variable) => (
                  <RowShell key={variable.key}>
                    <div className="grid gap-3 lg:grid-cols-[170px_minmax(0,1fr)_110px] lg:items-center">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{variable.title}</p>
                        {showAdvanced ? (
                          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                            {inputTypeLabel(variable.inputType)}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor={`${fieldKey}__${variable.key}Label`}
                          className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                        >
                          Emri i variables
                        </label>
                        <input
                          id={`${fieldKey}__${variable.key}Label`}
                          name={`${fieldKey}__${variable.key}Label`}
                          type="text"
                          value={
                            variable.key === "material"
                              ? materialLabel
                              : variable.key === "power"
                                ? powerLabel
                                : undefined
                          }
                          defaultValue={
                            variable.key === "size"
                              ? config.sizeLabel
                              : variable.key === "color"
                                ? config.colorLabel
                                : undefined
                          }
                          onChange={
                            variable.key === "material"
                              ? (event) => setMaterialLabel(event.target.value)
                              : variable.key === "power"
                                ? (event) => setPowerLabel(event.target.value)
                                : undefined
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                        />
                      </div>

                      <div className="lg:pt-6">
                        {variable.removable ? (
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={variable.key === "material" ? showMaterialField : showPowerField}
                              onChange={(event) => {
                                if (variable.key === "material") {
                                  setShowMaterialField(event.target.checked);
                                  return;
                                }
                                setShowPowerField(event.target.checked);
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                            />
                            Shfaq
                          </label>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            Standarde
                          </span>
                        )}
                      </div>
                    </div>

                    {showAdvanced ? (
                      <div className="mt-3 border-t border-slate-200 pt-3 lg:max-w-[180px]">
                        <label
                          htmlFor={`${fieldKey}__${variable.key}InputType`}
                          className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                        >
                          Tipi
                        </label>
                        <select
                          id={`${fieldKey}__${variable.key}InputType`}
                          name={`${fieldKey}__${variable.key}InputType`}
                          value={
                            variable.key === "material"
                              ? materialInputType
                              : variable.key === "power"
                                ? powerInputType
                                : undefined
                          }
                          defaultValue={
                            variable.key === "size"
                              ? config.sizeInputType
                              : variable.key === "color"
                                ? config.colorInputType
                                : undefined
                          }
                          onChange={
                            variable.key === "material"
                              ? (event) =>
                                  setMaterialInputType(event.target.value as VariableInputType)
                              : variable.key === "power"
                                ? (event) =>
                                    setPowerInputType(event.target.value as VariableInputType)
                                : undefined
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                        >
                          <option value="text">Text</option>
                          <option value="number">Numer</option>
                          <option value="select">Liste</option>
                        </select>
                      </div>
                    ) : null}
                  </RowShell>
                ))}

                <div className="grid gap-3 lg:grid-cols-2">
                  <RowShell>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Stoku</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                          Numer
                        </p>
                      </div>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        Sistem
                      </span>
                    </div>
                  </RowShell>

                  <RowShell>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Cmimi</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                          Numer
                        </p>
                      </div>
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        Sistem
                      </span>
                    </div>
                  </RowShell>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Atribute custom</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {customFields.length > 0
                        ? `${customFields.length} fusha custom aktive`
                        : "Nuk ka fusha custom te shtuara"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((current) => !current)}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    {showAdvanced ? "Mbyll advanced" : "Hap advanced"}
                  </button>
                </div>

                {showAdvanced && customFields.length > 0 ? (
                  <div className="space-y-3">
                    {customFields.map((field, index) => (
                      <RowShell key={field.id}>
                        <div className="grid gap-3 lg:grid-cols-[170px_minmax(0,1fr)_150px_110px_56px] lg:items-center">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">Variabel custom</p>
                            <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                              {inputTypeLabel(field.type)}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label
                              htmlFor={`${fieldKey}__customFieldLabel__${field.id}`}
                              className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                            >
                              Emri i variables
                            </label>
                            <input
                              id={`${fieldKey}__customFieldLabel__${field.id}`}
                              type="text"
                              value={field.label}
                              onChange={(event) =>
                                setCustomFields((current) =>
                                  current.map((item) =>
                                    item.id === field.id ? { ...item, label: event.target.value } : item,
                                  ),
                                )
                              }
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                            />
                          </div>

                          <div className="space-y-2">
                            <label
                              htmlFor={`${fieldKey}__customFieldType__${field.id}`}
                              className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                            >
                              Tipi
                            </label>
                            <select
                              id={`${fieldKey}__customFieldType__${field.id}`}
                              value={field.type}
                              onChange={(event) =>
                                setCustomFields((current) =>
                                  current.map((item) =>
                                    item.id === field.id
                                      ? { ...item, type: event.target.value as CustomFieldInputType }
                                      : item,
                                  ),
                                )
                              }
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                            >
                              <option value="text">Text</option>
                              <option value="number">Numer</option>
                            </select>
                          </div>

                          <div className="lg:pt-6">
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={field.enabled}
                                onChange={(event) =>
                                  setCustomFields((current) =>
                                    current.map((item) =>
                                      item.id === field.id ? { ...item, enabled: event.target.checked } : item,
                                    ),
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                              />
                              Shfaq
                            </label>
                          </div>

                          <div className="lg:pt-6">
                            <button
                              type="button"
                              onClick={() =>
                                setCustomFields((current) =>
                                  current.filter((_, currentIndex) => currentIndex !== index),
                                )
                              }
                              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                              aria-label={`Hiq variablen ${field.label}`}
                            >
                              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                                <path
                                  d="M5.75 6.5h8.5M8 6.5V5.25A1.25 1.25 0 0 1 9.25 4h1.5A1.25 1.25 0 0 1 12 5.25V6.5M7 8.25v5.25M10 8.25v5.25M13 8.25v5.25M6.5 6.5 7 15a1 1 0 0 0 1 .94h4a1 1 0 0 0 1-.94l.5-8.5"
                                  stroke="currentColor"
                                  strokeWidth="1.7"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </RowShell>
                    ))}
                  </div>
                ) : null}

                <RowShell>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Nje foto per ngjyre</p>
                      <p className="mt-1 text-xs text-slate-500">
                        E dobishme per patika dhe produkte me ngjyra.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={sharedPhotoByColor}
                      onChange={(event) => setSharedPhotoByColor(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                    />
                  </div>
                </RowShell>

                {showAdvanced ? (
                  <details className="rounded-2xl border border-slate-200 bg-white">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900">
                      Tekstet e brendshme
                    </summary>
                    <div className="space-y-3 border-t border-slate-200 px-4 py-4">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="space-y-2">
                          <label
                            htmlFor={`${fieldKey}__productNamePlaceholder`}
                            className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                          >
                            Placeholder i produktit
                          </label>
                          <input
                            id={`${fieldKey}__productNamePlaceholder`}
                            name={`${fieldKey}__productNamePlaceholder`}
                            type="text"
                            defaultValue={config.productNamePlaceholder}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <label
                            htmlFor={`${fieldKey}__sizePlaceholder`}
                            className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
                          >
                            Placeholder i variables kryesore
                          </label>
                          <input
                            id={`${fieldKey}__sizePlaceholder`}
                            name={`${fieldKey}__sizePlaceholder`}
                            type="text"
                            defaultValue={config.sizePlaceholder}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>
            </section>
          </div>

          {(isFootwearCategory || isElectricalCategory) ? (
            <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {isFootwearCategory
                ? "Per kepuce/patika rrjedha standarde eshte: brand, model, kategori dhe variante me ngjyre, numer, stok e cmim."
                : "Per pajisje elektrike rrjedha standarde eshte: brand, model dhe variante me ngjyre, fuqi/version, stok e cmim."}
            </div>
          ) : null}

          <div className="hidden">
            <input
              type="hidden"
              name={`${fieldKey}__showProductBrandField`}
              value={toBooleanValue(showBrand)}
            />
            <input
              type="hidden"
              name={`${fieldKey}__sharedVariantImageByColor`}
              value={toBooleanValue(sharedPhotoByColor)}
            />
            <input
              type="hidden"
              name={`${fieldKey}__showMaterialField`}
              value={toBooleanValue(showMaterialField)}
            />
            <input
              type="hidden"
              name={`${fieldKey}__showPowerField`}
              value={toBooleanValue(showPowerField)}
            />
            {!showAdvanced ? (
              <>
                <input
                  type="hidden"
                  name={`${fieldKey}__productNamePlaceholder`}
                  defaultValue={config.productNamePlaceholder}
                />
                <input
                  type="hidden"
                  name={`${fieldKey}__sizePlaceholder`}
                  defaultValue={config.sizePlaceholder}
                />
              </>
            ) : null}
            <input
              type="hidden"
              name={`${fieldKey}__colorPlaceholder`}
              defaultValue={config.colorPlaceholder}
            />
            <input
              type="hidden"
              name={`${fieldKey}__materialPlaceholder`}
              defaultValue={config.materialPlaceholder}
            />
            <input
              type="hidden"
              name={`${fieldKey}__powerPlaceholder`}
              defaultValue={config.powerPlaceholder}
            />
            <textarea name={`${fieldKey}__sizeOptions`} defaultValue={config.sizeOptions.join("\n")} />
            <textarea name={`${fieldKey}__colorOptions`} defaultValue={config.colorOptions.join("\n")} />
            <textarea
              name={`${fieldKey}__materialOptions`}
              defaultValue={config.materialOptions.join("\n")}
            />
            <textarea name={`${fieldKey}__powerOptions`} defaultValue={config.powerOptions.join("\n")} />
            <textarea name={`${fieldKey}__variantHelper`} defaultValue={config.variantHelper} />
            <textarea
              name={`${fieldKey}__customVariantFields`}
              value={JSON.stringify(customFields)}
              readOnly
            />
          </div>
        </div>
      </details>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">Shto variable</p>
                <p className="mt-1 text-sm text-slate-600">
                  Zgjidh nje fushe shtese dhe emrin qe do t&apos;i shfaqet klientit.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Mbyll
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-800">Emri i variables</label>
                <input
                  type="text"
                  value={draftVariableName}
                  onChange={(event) => setDraftVariableName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-800">Tipi</label>
                <select
                  value={draftVariableType}
                  onChange={(event) =>
                    setDraftVariableType(event.target.value as CustomFieldInputType)
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                >
                  <option value="text">Text</option>
                  <option value="number">Numer</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Anulo
              </button>
              <button
                type="button"
                onClick={applyVariable}
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Shto
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
