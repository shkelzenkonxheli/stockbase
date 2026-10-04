import Link from "next/link";

export function WorkspaceBackLink() {
  return (
    <Link
      href="/workspace"
      aria-label="Kthehu te veprimet"
      title="Kthehu te veprimet"
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white/95 px-3 text-sm font-semibold text-emerald-950 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:px-4"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 fill-none stroke-current stroke-[2]">
        <path d="m11 5-7 7 7 7M4 12h16" />
      </svg>
      <span className="hidden sm:inline">Te veprimet</span>
    </Link>
  );
}
