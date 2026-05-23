"use client";

import { useState } from "react";
import { FlashMessage } from "@/app/components/flash-message";
import { ImageFileInput } from "@/app/components/image-file-input";
import { UploadedImage } from "@/app/components/uploaded-image";

type VariantImageUploadFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  productId: number;
  variantId: number;
  imagePath: string | null;
  productName: string;
  color: string;
  errorMessage?: string | null;
};

export function VariantImageUploadForm({
  action,
  productId,
  variantId,
  imagePath,
  productName,
  color,
  errorMessage,
}: VariantImageUploadFormProps) {
  const [hasFile, setHasFile] = useState(false);

  return (
    <form action={action} className="mt-8 space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variantId} />
      {errorMessage ? (
        <FlashMessage
          type="error"
          text={errorMessage}
          className="rounded-2xl px-4 py-3 text-sm"
        />
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-slate-800">Foto e variantit</p>
            <p className="mt-1 text-xs text-slate-500">
              Zgjedh nje foto dhe kliko Upload. Fotoja do t&apos;u vendoset te
              gjithe numrave me te njejten ngjyre.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
            <ImageFileInput
              id="variant-image"
              name="image"
              label="Choose File"
              onHasFileChange={setHasFile}
            />

            {imagePath ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="mb-3 text-sm font-medium text-slate-800">
                  Foto aktuale
                </p>
                <a
                  href={imagePath}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <UploadedImage
                    src={imagePath}
                    alt={`${productName} ${color}`}
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                  <span className="text-sm text-slate-600">
                    Kliko per ta hapur
                  </span>
                </a>
              </div>
            ) : null}
          </div>

          {hasFile ? (
            <button
              type="submit"
              className="inline-flex items-center justify-center self-start rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Upload Foto
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
