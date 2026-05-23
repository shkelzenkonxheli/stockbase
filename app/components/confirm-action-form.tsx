"use client";

import type { ReactNode } from "react";

type ConfirmActionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Array<{
    name: string;
    value: string | number;
  }>;
  confirmMessage: string;
  buttonLabel: string;
  className: string;
  disabled?: boolean;
  children?: ReactNode;
};

export function ConfirmActionForm({
  action,
  hiddenFields,
  confirmMessage,
  buttonLabel,
  className,
  disabled = false,
  children,
}: ConfirmActionFormProps) {
  return (
    <form action={action}>
      {hiddenFields.map((field) => (
        <input
          key={field.name}
          type="hidden"
          name={field.name}
          value={field.value}
        />
      ))}
      <button
        type="submit"
        className={className}
        disabled={disabled}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }

          if (!window.confirm(confirmMessage)) {
            event.preventDefault();
          }
        }}
      >
        {children ?? buttonLabel}
      </button>
    </form>
  );
}
