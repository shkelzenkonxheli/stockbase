"use client";

import { useRef, useState } from "react";

type ModuleAccessCheckboxProps = {
  action: (formData: FormData) => void | Promise<void>;
  tenantId: number;
  enabled: boolean;
  moduleName: string;
};

export function ModuleAccessCheckbox({
  action,
  tenantId,
  enabled,
  moduleName,
}: ModuleAccessCheckboxProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const enabledFieldRef = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState(enabled);

  function toggle(nextValue: boolean) {
    const message = nextValue
      ? `A do t'ia aktivizosh lejen ${moduleName} ketij tenant-i?`
      : `A do t'ia heqesh lejen ${moduleName} ketij tenant-i?`;
    if (!window.confirm(message)) return;

    setChecked(nextValue);
    if (enabledFieldRef.current) enabledFieldRef.current.value = String(nextValue);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input ref={enabledFieldRef} type="hidden" name="enabled" value={String(checked)} />
      <label className="inline-flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => toggle(event.target.checked)}
          aria-label={`${moduleName}: ${checked ? "aktiv" : "jo aktiv"}`}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
        />
      </label>
    </form>
  );
}
