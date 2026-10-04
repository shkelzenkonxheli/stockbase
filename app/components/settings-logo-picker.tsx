"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function SettingsLogoPicker({ logoUrl }: { logoUrl: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-800">Logo e biznesit</p>
      <div className="flex items-center gap-3">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-2xl font-bold text-emerald-800">
          {preview || logoUrl ? <Image src={preview || logoUrl || ""} alt="Logo e biznesit" fill unoptimized className="object-contain p-2" sizes="80px" /> : "S"}
        </div>
        <div className="min-w-0">
          <label htmlFor="businessLogo" className="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">Ngarko logo</label>
          <input id="businessLogo" name="businessLogo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); setPreview(next ? URL.createObjectURL(next) : null); }} className="sr-only" />
          <p className="mt-1 truncate text-xs text-slate-500">{file ? file.name : "JPG, PNG ose WebP. Maksimumi 2 MB."}</p>
        </div>
      </div>
    </div>
  );
}
