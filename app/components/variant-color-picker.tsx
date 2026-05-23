"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UploadedImage } from "@/app/components/uploaded-image";

type VariantOption = {
  id: number;
  size: string;
  color: string;
  imagePath: string | null;
  availableStock: number;
};

type VariantColorPickerProps = {
  variants: VariantOption[];
  selectedVariantId: string;
  onSelectVariant: (variantId: string) => void;
  disabled?: boolean;
  placeholder: string;
  emptyLabel: string;
};

type ColorGroup = {
  key: string;
  color: string;
  imagePath: string | null;
  totalStock: number;
  variants: VariantOption[];
};

type HoverPreview = {
  imagePath: string;
  color: string;
  top: number;
  left: number;
};

export function VariantColorPicker({
  variants,
  selectedVariantId,
  onSelectVariant,
  disabled = false,
  placeholder,
  emptyLabel,
}: VariantColorPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeColorKey, setActiveColorKey] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const colorGroups = useMemo(() => {
    const map = new Map<string, ColorGroup>();

    for (const variant of variants) {
      const key = variant.color.trim().toLowerCase();
      const current = map.get(key);

      if (current) {
        current.totalStock += variant.availableStock;
        current.variants.push(variant);
        if (!current.imagePath && variant.imagePath) {
          current.imagePath = variant.imagePath;
        }
      } else {
        map.set(key, {
          key,
          color: variant.color,
          imagePath: variant.imagePath,
          totalStock: variant.availableStock,
          variants: [variant],
        });
      }
    }

    return [...map.values()].map((group) => ({
      ...group,
      variants: [...group.variants].sort((a, b) =>
        a.size.localeCompare(b.size, "sq", {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    }));
  }, [variants]);

  const selectedVariant =
    variants.find((variant) => String(variant.id) === selectedVariantId) ?? null;

  const activeColor =
    colorGroups.find((group) => group.key === activeColorKey) ?? null;

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setHoverPreview(null);
        setPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [pickerOpen]);

  useEffect(() => {
    if (!pickerOpen && !activeColorKey) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHoverPreview(null);
        setPickerOpen(false);
        setActiveColorKey(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [pickerOpen, activeColorKey]);

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => {
            if (!disabled && colorGroups.length > 0) {
              setHoverPreview(null);
              setPickerOpen((current) => !current);
            }
          }}
          disabled={disabled}
          className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-900 outline-none transition hover:border-slate-300 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <span className="truncate">
            {selectedVariant
              ? `${selectedVariant.color} • Nr ${selectedVariant.size}`
              : placeholder}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="ml-3 h-4 w-4 shrink-0 text-slate-400"
          >
            <path
              d="m5.75 7.75 4.25 4.5 4.25-4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {pickerOpen ? (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
          >
            {colorGroups.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-500">{emptyLabel}</div>
            ) : (
              <div className="max-h-72 overflow-y-auto p-2">
                <div className="space-y-1">
                  {colorGroups.map((group) => {
                    const selected = group.variants.some(
                      (variant) => String(variant.id) === selectedVariantId,
                    );

                    return (
                      <div key={group.key}>
                        <button
                          type="button"
                          onClick={() => {
                            setHoverPreview(null);
                            setPickerOpen(false);
                            setActiveColorKey(group.key);
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                            selected
                              ? "bg-emerald-50 text-slate-950"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                            onMouseEnter={(event) => {
                              if (!group.imagePath || !dropdownRef.current) {
                                return;
                              }

                              const imageRect =
                                event.currentTarget.getBoundingClientRect();
                              const dropdownRect =
                                dropdownRef.current.getBoundingClientRect();

                              setHoverPreview({
                                imagePath: group.imagePath,
                                color: group.color,
                                top:
                                  imageRect.top -
                                  dropdownRect.top +
                                  imageRect.height / 2 -
                                  18,
                                left:
                                  imageRect.left -
                                  dropdownRect.left +
                                  imageRect.width +
                                  8,
                              });
                            }}
                            onMouseLeave={() => setHoverPreview(null)}
                          >
                            {group.imagePath ? (
                              <UploadedImage
                                src={group.imagePath}
                                alt={group.color}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                                IMG
                              </span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {group.color}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {group.totalStock} ne stok
                            </span>
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hoverPreview ? (
              <div
                className="pointer-events-none absolute z-40 hidden w-40 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_44px_rgba(15,23,42,0.18)] lg:block"
                style={{
                  top: `${hoverPreview.top}px`,
                  left: `${hoverPreview.left}px`,
                }}
              >
                <div className="overflow-hidden rounded-xl bg-slate-100">
                  <UploadedImage
                    src={hoverPreview.imagePath}
                    alt={hoverPreview.color}
                    className="h-40 w-full object-cover"
                  />
                </div>
                <p className="mt-2 truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {hoverPreview.color}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {activeColor ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-4 sm:items-center">
          <button
            type="button"
            onClick={() => setActiveColorKey(null)}
            className="absolute inset-0"
            aria-label="Mbyll zgjedhjen e numrit"
          />
          <div className="relative z-[121] w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {activeColor.imagePath ? (
                    <UploadedImage
                      src={activeColor.imagePath}
                      alt={activeColor.color}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                      IMG
                    </span>
                  )}
                </span>
                <div>
                  <p className="text-lg font-semibold text-slate-950">
                    {activeColor.color}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Zgjidh numrin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveColorKey(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                aria-label="Mbyll"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4"
                >
                  <path
                    d="M6 6l8 8M14 6l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5">
              {activeColor.variants.map((variant) => {
                const selected = String(variant.id) === selectedVariantId;

                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      onSelectVariant(String(variant.id));
                      setActiveColorKey(null);
                    }}
                    className={`rounded-2xl border px-4 py-4 text-center transition ${
                      selected
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-base font-semibold text-slate-950">
                      Nr {variant.size}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-slate-500">
                      {variant.availableStock} ne stok
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
