"use client";

import { useRef } from "react";

type ConfirmActionButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  confirmMessage: string;
  buttonLabel: string;
  className: string;
  fieldName: string;
  fieldValue: string | number;
  disabled?: boolean;
};

export function ConfirmActionButton({
  action,
  confirmMessage,
  buttonLabel,
  className,
  fieldName,
  fieldValue,
  disabled = false,
}: ConfirmActionButtonProps) {
  const hiddenFieldRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={hiddenFieldRef}
        type="hidden"
        name={fieldName}
        value={String(fieldValue)}
        disabled
      />
      <button
        type="submit"
        formAction={action}
        className={className}
        disabled={disabled}
        onClick={(event) => {
          if (hiddenFieldRef.current) {
            hiddenFieldRef.current.disabled = true;
          }

          if (disabled) {
            event.preventDefault();
            return;
          }

          if (!window.confirm(confirmMessage)) {
            event.preventDefault();
            return;
          }

          if (hiddenFieldRef.current) {
            hiddenFieldRef.current.disabled = false;
          }
        }}
      >
        {buttonLabel}
      </button>
    </>
  );
}
