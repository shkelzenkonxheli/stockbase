"use client";

import { useEffect, useState } from "react";
import { UploadedImage } from "@/app/components/uploaded-image";

type ImageFileInputProps = {
  id: string;
  name: string;
  label: string;
  helperText?: string;
  onHasFileChange?: (hasFile: boolean) => void;
  className?: string;
  previewClassName?: string;
  inputClassName?: string;
  clearButtonLabel?: string;
  layout?: "stacked" | "compact";
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function ImageFileInput({
  id,
  name,
  label,
  helperText,
  onHasFileChange,
  className,
  previewClassName,
  inputClassName,
  clearButtonLabel = "Hiqe",
  layout = "stacked",
}: ImageFileInputProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const clearSelection = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    setErrorMessage(null);
    setSelectedFileName(null);
    onHasFileChange?.(false);

    const input = document.getElementById(id) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const isCompact = layout === "compact";

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50/80 p-4 ${className ?? ""}`}>
      {isCompact ? null : (
        <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-800">
          {label}
        </label>
      )}
      <div className={isCompact ? "space-y-3" : "space-y-4"}>
        <input
          id={id}
          type="file"
          name={name}
          accept="image/png,image/jpeg,image/webp,image/avif"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
            }

            if (!file) {
              setPreviewUrl(null);
              setErrorMessage(null);
              setSelectedFileName(null);
              onHasFileChange?.(false);
              return;
            }

            if (file.size > MAX_IMAGE_SIZE_BYTES) {
              setPreviewUrl(null);
              setErrorMessage(
                "Fotoja eshte me e madhe se 5MB. Zgjedh nje file me te vogel.",
              );
              setSelectedFileName(null);
              event.currentTarget.value = "";
              onHasFileChange?.(false);
              return;
            }

            setPreviewUrl(URL.createObjectURL(file));
            setErrorMessage(null);
            setSelectedFileName(file.name);
            onHasFileChange?.(true);
          }}
          className={
            isCompact
              ? "sr-only"
              : `block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-2.5 file:font-medium file:text-white hover:file:bg-slate-800 ${inputClassName ?? ""}`
          }
        />
        {isCompact ? (
          <div className="rounded-[22px] bg-slate-50 px-3 py-4">
            <div className="flex h-28 items-center justify-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                {previewUrl ? (
                  <UploadedImage
                    src={previewUrl}
                    alt="Preview"
                    className={previewClassName ?? "h-20 w-20 object-cover"}
                  />
                ) : (
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    Foto
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center">
              {previewUrl ? (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex h-8 min-w-20 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  {clearButtonLabel}
                </button>
              ) : (
                <label
                  htmlFor={id}
                  className="inline-flex h-8 min-w-20 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                >
                  Ngarko foto
                </label>
              )}
            </div>
          </div>
        ) : null}
        {previewUrl && !isCompact ? (
          <div
            className="overflow-hidden rounded-[24px] border border-slate-200 bg-white"
          >
            <UploadedImage
              src={previewUrl}
              alt="Preview"
              className={previewClassName ?? "h-64 w-full object-cover"}
            />
            <div className="flex justify-end border-t border-slate-100 px-3 py-3">
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 transition hover:bg-rose-100"
              >
                {clearButtonLabel}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {helperText && !isCompact ? (
        <p className="mt-2 text-xs text-slate-500">{helperText}</p>
      ) : null}
      {errorMessage ? (
        <p className="mt-2 text-xs font-medium text-rose-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
