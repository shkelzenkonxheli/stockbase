"use client";

import { useState } from "react";

export function CatalogPublicLink({ publicSlug }: { publicSlug: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = new URL(`/catalog/${publicSlug}`, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={() => void copyLink()}
      title="Kopjo linkun publik"
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-700 transition hover:bg-emerald-100"
    >
      {copied ? "U kopjua" : "Kopjo linkun"}
    </button>
  );
}
