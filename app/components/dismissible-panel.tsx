"use client";

import { useState } from "react";

type DismissiblePanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function DismissiblePanel({
  children,
  className = "",
}: DismissiblePanelProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
        aria-label="Mbylle"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
          <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
        </svg>
      </button>

      {children}

      <div className="px-5 pb-4">
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Mbylle
        </button>
      </div>
    </div>
  );
}
