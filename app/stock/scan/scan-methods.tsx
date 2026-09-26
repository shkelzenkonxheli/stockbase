"use client";

import { useState } from "react";
import { CameraBarcodeScanner } from "@/app/stock/scan/camera-barcode-scanner";
import { FindByPhoto } from "@/app/stock/scan/find-by-photo";

export function ScanMethods({ initialCode, photoEnabled, warehouses }: { initialCode: string; photoEnabled: boolean; warehouses: Array<{ id: number; name: string }> }) {
  const [method, setMethod] = useState<"barcode" | "photo">("barcode");
  return <div className="space-y-4">
    {photoEnabled ? <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => setMethod("barcode")} aria-pressed={method === "barcode"} className={`rounded-2xl border p-4 text-left ${method === "barcode" ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"}`}><span className="block text-base font-semibold">Scan Barcode</span><span className="mt-1 block text-sm opacity-75">Skano barkodin e produktit</span></button>
      <button type="button" onClick={() => setMethod("photo")} aria-pressed={method === "photo"} className={`rounded-2xl border p-4 text-left ${method === "photo" ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-200 bg-white text-slate-950"}`}><span className="block text-base font-semibold">✨ Find by Photo</span><span className="mt-1 block text-sm opacity-75">Bej foto per te kerkuar ne stok</span></button>
    </div> : null}
    {method === "barcode" ? <CameraBarcodeScanner initialCode={initialCode} /> : <FindByPhoto warehouses={warehouses} />}
  </div>;
}
