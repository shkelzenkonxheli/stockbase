"use client";

import { useRef } from "react";
import { saveCatalog } from "./actions";
import { CatalogBuilder, type CatalogProductOption } from "./catalog-builder";

export function CatalogCreateModal({ products, warehouses }: { products: CatalogProductOption[]; warehouses: { id: number; name: string }[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return <><button type="button" onClick={() => dialogRef.current?.showModal()} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">+ Krijo katalog</button><dialog ref={dialogRef} className="m-auto h-[92vh] w-[calc(100%-1rem)] max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 p-0 shadow-[0_32px_100px_rgba(15,23,42,0.3)] backdrop:bg-slate-950/50"><div className="h-full overflow-y-auto p-3 sm:p-5"><button type="button" aria-label="Mbyll" onClick={() => dialogRef.current?.close()} className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-500">x</button><CatalogBuilder products={products} warehouses={warehouses} action={saveCatalog} /></div></dialog></>;
}
