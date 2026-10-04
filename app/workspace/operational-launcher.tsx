"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { OperationalGroup, OperationalLink } from "@/lib/operational-navigation";

const icons: Record<string, React.ReactNode> = {
  sales: <><path d="M4 7h16l-1.5 12h-13L4 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
  stock: <><path d="M4 6h16v13H4zM8 6V4h8v2M8 11h8M8 15h5" /></>,
  supply: <><path d="M3 19h18M5 19V8l7-4 7 4v11M9 12h.01M15 12h.01M9 16h.01M15 16h.01" /></>,
  marketing: <><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.5" /><path d="M17.5 7h.01" /></>,
  insights: <><path d="M4 20h16M7 17v-5m5 5V5m5 12V9" /></>,
  admin: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M19 8v6m3-3h-6" /></>,
};

function Icon({ id, className = "h-7 w-7" }: { id: string; className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} fill-none stroke-current stroke-[1.7] stroke-linecap-round stroke-linejoin-round`}>{icons[id] ?? icons.products}</svg>;
}

function Destination({ link, onClick, onIntent }: { link: OperationalLink; onClick?: () => void; onIntent: (href: string) => void }) {
  return (
    <Link href={link.href} target={link.href === "/pos" ? "_blank" : undefined} rel={link.href === "/pos" ? "noopener noreferrer" : undefined} onPointerEnter={() => onIntent(link.href)} onFocus={() => onIntent(link.href)} onTouchStart={() => onIntent(link.href)} onClick={onClick} className="group flex min-h-28 items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
      <span className="min-w-0"><span className="block text-base font-bold text-slate-950">{link.label}</span><span className="mt-1 block text-sm text-slate-500">{link.description}</span></span>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-none stroke-emerald-800 stroke-2 transition group-hover:translate-x-1"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
    </Link>
  );
}

export function OperationalLauncher({ groups }: { groups: OperationalGroup[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prefetched = useRef(new Set<string>());
  const [activeGroup, setActiveGroup] = useState<OperationalGroup | null>(null);

  function prefetch(href: string) {
    if (href === "/pos" || prefetched.current.has(href)) return;
    prefetched.current.add(href);
    router.prefetch(href);
  }

  function openGroup(group: OperationalGroup) {
    group.links.slice(0, 2).forEach((link) => prefetch(link.href));
    setActiveGroup(group);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  return (
    <>
      <section className="pt-8 sm:pt-11">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-800">Qendra operative</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Cfare do te besh sot?</h1><p className="mt-2 text-sm text-slate-600 sm:text-base">Zgjidh nje fushe pune. Veprimet e lidhura jane grupuar bashke.</p></div>
          <span className="rounded-full border border-emerald-900/10 bg-white/70 px-3 py-1.5 text-xs font-semibold text-emerald-900">{groups.length} fusha pune</span>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {groups.map((group, index) => {
            const shared = "group relative flex min-h-42 flex-col items-start rounded-[1.4rem] border border-emerald-950/10 bg-white/90 p-4 text-left shadow-[0_9px_28px_rgba(7,45,34,0.045)] transition hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-[0_15px_32px_rgba(7,45,34,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:min-h-48 sm:p-5";
            const content = <><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-900 group-hover:bg-emerald-950 group-hover:text-white"><Icon id={group.id} /></span><span className="mt-auto block"><span className="block text-base font-extrabold tracking-tight sm:text-lg">{group.title}</span><span className="mt-1 block text-xs leading-snug text-slate-500 sm:text-sm">{group.description}</span></span><span className="absolute right-4 top-4 rounded-full border border-emerald-900/10 px-2 py-1 text-[10px] font-bold text-emerald-800 sm:right-5 sm:top-5">{group.links.length === 1 ? "Hap" : `${group.links.length} opsione`}</span></>;
            return group.links.length === 1
              ? <Link key={group.id} href={group.links[0].href} onPointerEnter={() => prefetch(group.links[0].href)} onFocus={() => prefetch(group.links[0].href)} className={shared} style={{ animationDelay: `${index * 35}ms` }}>{content}</Link>
              : <button key={group.id} type="button" onPointerEnter={() => group.links.slice(0, 2).forEach((link) => prefetch(link.href))} onFocus={() => group.links.slice(0, 2).forEach((link) => prefetch(link.href))} onClick={() => openGroup(group)} className={shared} style={{ animationDelay: `${index * 35}ms` }}>{content}</button>;
          })}
        </div>
      </section>

      <dialog ref={dialogRef} onClose={() => setActiveGroup(null)} onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }} className="m-auto w-[min(94vw,680px)] max-h-[90dvh] overflow-y-auto rounded-[1.75rem] border border-emerald-900/10 bg-[#f8fbf8] p-0 text-slate-950 shadow-[0_30px_90px_rgba(2,25,18,0.3)] backdrop:bg-emerald-950/50 backdrop:backdrop-blur-sm">
        {activeGroup && <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-emerald-900/10 pb-5">
            <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 text-white"><Icon id={activeGroup.id} /></span><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Zgjidh veprimin</p><h2 className="text-xl font-black tracking-tight sm:text-2xl">{activeGroup.title}</h2></div></div>
            <button type="button" onClick={closeDialog} aria-label="Mbyll" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl text-slate-600 transition hover:bg-slate-100">X</button>
          </div>
          <p className="mt-4 text-sm text-slate-600">{activeGroup.description}. Zgjidh ku deshiron te vazhdosh.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{activeGroup.links.map((link) => <Destination key={link.href} link={link} onIntent={prefetch} onClick={closeDialog} />)}</div>
        </div>}
      </dialog>
    </>
  );
}
