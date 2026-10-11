"use client";

import { useState } from "react";
import type { CategoryConfig, CustomFieldInputType, CustomVariantField } from "@/lib/product-taxonomy";
import { ConfirmActionButton } from "@/app/components/confirm-action-button";

type Props = {
  id: number;
  categoryName: string;
  isActive: boolean;
  productCount: number;
  fieldKey: string;
  config: CategoryConfig;
  deleteCategoryAction: (formData: FormData) => void | Promise<void>;
  embedded?: boolean;
};

type FieldKind = "size" | "color" | "material" | "power";
type FieldType = "text" | "number" | "select";

const inputClass = "min-h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
const selectClass = `${inputClass} sm:w-28`;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} className="h-4 w-4 rounded border-slate-300 accent-emerald-700" />
      <span className="hidden sm:inline">{checked ? "Aktive" : "Fikur"}</span>
    </label>
  );
}

export function SettingsCategoryCard({ id, categoryName, isActive, productCount, fieldKey, config, deleteCategoryAction, embedded = false }: Props) {
  const [showBrand, setShowBrand] = useState(config.showProductBrandField);
  const [sharedPhotoByColor, setSharedPhotoByColor] = useState(config.sharedVariantImageByColor);
  const [showMaterial, setShowMaterial] = useState(config.showMaterialField);
  const [showPower, setShowPower] = useState(config.showPowerField);
  const [materialLabel, setMaterialLabel] = useState(config.materialLabel);
  const [powerLabel, setPowerLabel] = useState(config.powerLabel);
  const [materialType, setMaterialType] = useState<FieldType>(config.materialInputType);
  const [powerType, setPowerType] = useState<FieldType>(config.powerInputType);
  const [customFields, setCustomFields] = useState<CustomVariantField[]>(config.customVariantFields ?? []);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftType, setDraftType] = useState<CustomFieldInputType>("text");
  const [adding, setAdding] = useState(false);

  if (embedded) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <input type="hidden" name="categoryIds" value={id} />
        <input type="hidden" name={`categoryFieldKey__${id}`} value={fieldKey} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-950">Informacioni i kategorise</h3>
            <p className="mt-1 text-xs text-slate-500">Emri dhe statusi i kategorise.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{productCount} produkte</span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block min-w-0 text-xs font-semibold text-slate-700">
            Emri i kategorise
            <input name={`categoryName__${id}`} type="text" required defaultValue={categoryName} className={`${inputClass} mt-2`} />
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" name={`${fieldKey}__isActive`} defaultChecked={isActive} className="h-4 w-4 accent-emerald-700" />
            Kategoria aktive
          </label>
        </div>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <ConfirmActionButton
            action={deleteCategoryAction}
            fieldName="categoryId"
            fieldValue={id}
            confirmMessage={productCount > 0 ? "Kjo kategori ka produkte. Do te arkivohet. Vazhdon?" : "A je i sigurt qe don ta fshish kete kategori?"}
            buttonLabel={productCount > 0 ? "Arkivo kategorine" : "Fshi kategorine"}
            className="inline-flex min-h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          />
        </div>
      </section>
    );
  }

  const fields: Array<{ key: FieldKind; title: string; hint: string; label: string; type: FieldType; enabled: boolean; optional: boolean }> = [
    { key: "size", title: "Madhesia / Numri", hint: "Variabla kryesore", label: config.sizeLabel, type: config.sizeInputType, enabled: true, optional: false },
    { key: "color", title: "Ngjyra", hint: "Varianti i ngjyres", label: config.colorLabel, type: config.colorInputType, enabled: true, optional: false },
    { key: "material", title: "Materiali", hint: "Fushe shtese", label: materialLabel, type: materialType, enabled: showMaterial, optional: true },
    { key: "power", title: "Fuqia / Versioni", hint: "Fushe shtese", label: powerLabel, type: powerType, enabled: showPower, optional: true },
  ];

  function addField() {
    const label = draftLabel.trim();
    if (!label) return;
    const base = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
    let nextId = base;
    let suffix = 2;
    while (customFields.some((field) => field.id === nextId)) nextId = `${base}_${suffix++}`;
    setCustomFields((current) => [...current, { id: nextId, label, type: draftType, enabled: true }]);
    setDraftLabel("");
    setDraftType("text");
    setAdding(false);
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50/80 to-white px-4 py-4 sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-700">Konfigurimi i fushave</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold tracking-tight text-slate-950">{categoryName}</h3>
          <span className="rounded-full border border-emerald-100 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-800">{fields.filter((field) => field.enabled).length + customFields.filter((field) => field.enabled).length} fusha aktive</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Ndrysho vetem fushat qe i duhen ketij lloji produkti.</p>
      </div>

      <div className="divide-y divide-slate-100">
        <div className="px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Produkti</h4>
            <span className="text-[11px] text-slate-400">Fushat e karteles se produktit</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className="block min-w-0 text-xs font-semibold text-slate-700">
              Emri / modeli
              <input name={`${fieldKey}__productNameLabel`} type="text" defaultValue={config.productNameLabel} className={`${inputClass} mt-1.5`} />
            </label>
            <div className="flex items-end justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
              <div><p className="text-xs font-semibold text-slate-700">Brandi</p><p className="mt-0.5 text-[11px] text-slate-500">Shfaq fushen te produkti</p></div>
              <Toggle checked={showBrand} onChange={setShowBrand} label="Shfaq brandin" />
            </div>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><h4 className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Varianti</h4><p className="mt-1 text-[11px] text-slate-500">Emri, tipi dhe aktivizimi ne nje rresht.</p></div>
            <button type="button" onClick={() => setAdding((value) => !value)} className="inline-flex min-h-9 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">+ Shto fushe</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="hidden grid-cols-[minmax(120px,1fr)_minmax(130px,1.2fr)_112px_72px] gap-3 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:grid">
              <span>Fusha</span><span>Emri ne forme</span><span>Tipi</span><span>Statusi</span>
            </div>
            {fields.map((field) => {
              const updateLabel = field.key === "material" ? setMaterialLabel : field.key === "power" ? setPowerLabel : undefined;
              const updateType = field.key === "material" ? setMaterialType : field.key === "power" ? setPowerType : undefined;
              const updateEnabled = field.key === "material" ? setShowMaterial : field.key === "power" ? setShowPower : undefined;
              return (
                <div key={field.key} className={`grid gap-2 border-t border-slate-100 px-3 py-2.5 first:border-t-0 sm:grid-cols-[minmax(120px,1fr)_minmax(130px,1.2fr)_112px_72px] sm:items-center sm:gap-3 ${!field.enabled ? "bg-slate-50/60" : "bg-white"}`}>
                  <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-900">{field.title}</p><p className="text-[11px] text-slate-500">{field.hint}</p></div>
                  <input aria-label={`Emri i fushes ${field.title}`} name={`${fieldKey}__${field.key}Label`} type="text" value={updateLabel ? field.label : undefined} defaultValue={updateLabel ? undefined : field.label} onChange={updateLabel ? (event) => updateLabel(event.target.value) : undefined} className={inputClass} />
                  <select aria-label={`Tipi i fushes ${field.title}`} name={`${fieldKey}__${field.key}InputType`} value={updateType ? field.type : undefined} defaultValue={updateType ? undefined : field.type} onChange={updateType ? (event) => updateType(event.target.value as FieldType) : undefined} className={selectClass}>
                    <option value="text">Tekst</option><option value="number">Numer</option><option value="select">Liste</option>
                  </select>
                  {field.optional && updateEnabled ? <Toggle checked={field.enabled} onChange={updateEnabled} label={`Aktivizo ${field.title}`} /> : <span className="text-[11px] font-medium text-slate-400">Standarde</span>}
                </div>
              );
            })}
            {customFields.map((field) => (
              <div key={field.id} className="grid gap-2 border-t border-slate-100 bg-white px-3 py-2.5 sm:grid-cols-[minmax(120px,1fr)_minmax(130px,1.2fr)_112px_72px] sm:items-center sm:gap-3">
                <div className="flex min-w-0 items-center justify-between gap-2"><div><p className="text-xs font-semibold text-slate-900">Fushe custom</p><p className="text-[11px] text-slate-500">Shtuar nga ju</p></div><button type="button" onClick={() => setCustomFields((current) => current.filter((item) => item.id !== field.id))} aria-label={`Hiq ${field.label}`} className="text-xs font-semibold text-rose-600 hover:underline">Hiq</button></div>
                <input aria-label="Emri i fushes custom" type="text" value={field.label} onChange={(event) => setCustomFields((current) => current.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item))} className={inputClass} />
                <select aria-label="Tipi i fushes custom" value={field.type} onChange={(event) => setCustomFields((current) => current.map((item) => item.id === field.id ? { ...item, type: event.target.value as CustomFieldInputType } : item))} className={selectClass}><option value="text">Tekst</option><option value="number">Numer</option></select>
                <Toggle checked={field.enabled} onChange={(value) => setCustomFields((current) => current.map((item) => item.id === field.id ? { ...item, enabled: value } : item))} label={`Aktivizo ${field.label}`} />
              </div>
            ))}
            {adding ? (
              <div className="grid gap-2 border-t border-emerald-100 bg-emerald-50/60 px-3 py-3 sm:grid-cols-[minmax(120px,1fr)_minmax(130px,1.2fr)_112px_72px] sm:items-center sm:gap-3">
                <span className="text-xs font-semibold text-emerald-800">Fushe e re</span>
                <input aria-label="Emri i fushes se re" placeholder="p.sh. Gjeresia" value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addField(); } }} className={inputClass} />
                <select aria-label="Tipi i fushes se re" value={draftType} onChange={(event) => setDraftType(event.target.value as CustomFieldInputType)} className={selectClass}><option value="text">Tekst</option><option value="number">Numer</option></select>
                <button type="button" onClick={addField} className="min-h-9 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800">Shto</button>
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
            <span>Stoku <strong className="text-slate-700">Numer / sistem</strong></span>
            <span>Cmimi <strong className="text-slate-700">Numer / sistem</strong></span>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold text-slate-900">Nje foto per ngjyre</p><p className="mt-0.5 text-[11px] text-slate-500">E njejta foto perdoret per numrat e asaj ngjyre.</p></div>
            <Toggle checked={sharedPhotoByColor} onChange={setSharedPhotoByColor} label="Nje foto per ngjyre" />
          </div>
        </div>
      </div>

      <details className="group border-t border-slate-200 bg-slate-50/50">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-semibold text-slate-600 hover:text-emerald-800 sm:px-5">
          Opsione te avancuara
          <span aria-hidden="true" className="text-base transition group-open:rotate-180">v</span>
        </summary>
        <div className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 sm:p-5">
          <label className="text-xs font-semibold text-slate-700">Shembull per emrin e produktit
            <input name={`${fieldKey}__productNamePlaceholder`} type="text" defaultValue={config.productNamePlaceholder} className={`${inputClass} mt-1.5`} />
          </label>
          <label className="text-xs font-semibold text-slate-700">Shembull per madhesine
            <input name={`${fieldKey}__sizePlaceholder`} type="text" defaultValue={config.sizePlaceholder} className={`${inputClass} mt-1.5`} />
          </label>
        </div>
      </details>

      <div className="hidden" aria-hidden="true">
        <input type="hidden" name={`${fieldKey}__showProductBrandField`} value={String(showBrand)} />
        <input type="hidden" name={`${fieldKey}__sharedVariantImageByColor`} value={String(sharedPhotoByColor)} />
        <input type="hidden" name={`${fieldKey}__showMaterialField`} value={String(showMaterial)} />
        <input type="hidden" name={`${fieldKey}__showPowerField`} value={String(showPower)} />
        <input type="hidden" name={`${fieldKey}__colorPlaceholder`} value={config.colorPlaceholder} />
        <input type="hidden" name={`${fieldKey}__materialPlaceholder`} value={config.materialPlaceholder} />
        <input type="hidden" name={`${fieldKey}__powerPlaceholder`} value={config.powerPlaceholder} />
        <textarea name={`${fieldKey}__sizeOptions`} defaultValue={config.sizeOptions.join("\n")} />
        <textarea name={`${fieldKey}__colorOptions`} defaultValue={config.colorOptions.join("\n")} />
        <textarea name={`${fieldKey}__materialOptions`} defaultValue={config.materialOptions.join("\n")} />
        <textarea name={`${fieldKey}__powerOptions`} defaultValue={config.powerOptions.join("\n")} />
        <textarea name={`${fieldKey}__variantHelper`} defaultValue={config.variantHelper} />
        <textarea name={`${fieldKey}__customVariantFields`} value={JSON.stringify(customFields)} readOnly />
      </div>
    </section>
  );
}
