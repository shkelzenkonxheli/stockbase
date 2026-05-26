"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPasswordPolicyHint } from "@/lib/password-policy";
import { FormSubmitButton } from "./form-submit-button";

type ResetPasswordModalProps = {
  action: (formData: FormData) => void | Promise<void>;
  open: boolean;
  message?: {
    type: "error" | "success";
    text: string;
  } | null;
  user:
    | {
        id: number;
        name: string;
        email: string;
      }
    | null;
};

export function ResetPasswordModal({
  action,
  open,
  message,
  user,
}: ResetPasswordModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && user && !dialog.open) {
      dialog.showModal();
    }

    if ((!open || !user) && dialog.open) {
      dialog.close();
    }
  }, [open, user]);

  const closeModal = () => {
    dialogRef.current?.close();
    router.replace("/users");
  };

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(560px,calc(100%-1.5rem))] rounded-[28px] border border-slate-200 bg-white p-0 text-left shadow-[0_28px_90px_rgba(15,23,42,0.24)] backdrop:bg-slate-950/45"
      onClose={() => router.replace("/users")}
    >
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Password Reset
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Reset password
            </h2>
            {user ? (
              <p className="mt-2 text-sm text-slate-600">
                {user.name} - {user.email}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Mbyll
          </button>
        </div>
      </div>

      {user ? (
        <div className="space-y-5 px-5 py-5 sm:px-6">
          {message ? (
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                message.type === "error"
                  ? "border border-rose-200 bg-rose-50 text-rose-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {message.text}
            </div>
          ) : null}
          <form action={action} className="space-y-5">
            <input type="hidden" name="userId" value={user.id} />

            <div className="space-y-2">
              <label
                htmlFor="reset-password"
                className="block text-sm font-medium text-slate-800"
              >
                Password i ri
              </label>
              <input
                id="reset-password"
                name="password"
                type="password"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder={getPasswordPolicyHint()}
              />
            </div>

            <FormSubmitButton
              idleLabel="Ruaj password-in"
              pendingLabel="Duke ruajtur..."
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            />
          </form>
        </div>
      ) : null}
    </dialog>
  );
}
