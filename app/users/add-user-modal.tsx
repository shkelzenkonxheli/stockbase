"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type AddUserModalProps = {
  action: (formData: FormData) => void | Promise<void>;
  open: boolean;
  message?: {
    type: "error" | "success";
    text: string;
  } | null;
};

export function AddUserModal({ action, open, message }: AddUserModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const closeModal = () => {
    dialogRef.current?.close();
    router.replace("/users");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => router.replace("/users?add=1")}
        className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
      >
        + Add User
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(560px,calc(100%-1.5rem))] rounded-[28px] border border-slate-200 bg-white p-0 text-left shadow-[0_28px_90px_rgba(15,23,42,0.24)] backdrop:bg-slate-950/45"
        onClose={() => router.replace("/users")}
      >
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                User Setup
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Shto user te ri
              </h2>
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
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-slate-800">
                Emri
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder="p.sh. Ardit"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                placeholder="user@stockbase.app"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-800"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                  placeholder="Minimum 6 karaktere"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="role" className="block text-sm font-medium text-slate-800">
                  Roli
                </label>
                <select
                  id="role"
                  name="role"
                  defaultValue="SELLER"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                >
                  <option value="SELLER">SELLER</option>
                  <option value="WAREHOUSE">WAREHOUSE</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
            >
              Krijo userin
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
