"use client";

import { useId } from "react";

type BulkSelectToggleProps = {
  targetSelector?: string;
  label?: string;
};

export function BulkSelectToggle({
  targetSelector = 'input[name="selectedLineIds"]',
  label = "Zgjedh te gjitha",
}: BulkSelectToggleProps) {
  const checkboxId = useId();

  return (
    <label
      htmlFor={checkboxId}
      className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700"
    >
      <input
        id={checkboxId}
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-300"
        onChange={(event) => {
          const form = event.currentTarget.form;
          if (!form) return;

          const targets = form.querySelectorAll<HTMLInputElement>(targetSelector);
          targets.forEach((input) => {
            input.checked = event.currentTarget.checked;
          });
        }}
      />
      {label}
    </label>
  );
}
