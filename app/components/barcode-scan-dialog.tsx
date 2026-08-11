"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

type DetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<DetectorResult[]>;
};

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

type ScannerEngine = "native" | "zxing";

type BarcodeScanDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onDetected: (code: string) => void;
};

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;

  return typeof candidate === "function" ? candidate : null;
}

export function BarcodeScanDialog({
  open,
  title = "Skano barcode",
  description = "Drejtoje kameran te barcode-i dhe sistemi e lexon automatikisht.",
  onClose,
  onDetected,
}: BarcodeScanDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState("");
  const [manualCode, setManualCode] = useState("");

  const supportState = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        isSupported: false,
        reason: "Po ngarkohet kontrolli i kameres.",
      };
    }

    const hasCameraApi =
      Boolean(navigator.mediaDevices) &&
      typeof navigator.mediaDevices.getUserMedia === "function";
    const isSecure =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSecure) {
      return {
        isSupported: false,
        reason:
          "Kamera kerkon HTTPS ose localhost real. Nga telefoni me adrese lokale browser-i e bllokon kameran.",
      };
    }

    if (!hasCameraApi) {
      return {
        isSupported: false,
        reason: "Ky browser nuk e mbeshtet hapjen e kameres nga web app-i.",
      };
    }

    return {
      isSupported: true,
      reason: null,
    };
  }, []);

  const engine: ScannerEngine = getBarcodeDetectorCtor() ? "native" : "zxing";

  const stopScanner = useCallback(() => {
    if (detectIntervalRef.current) {
      window.clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }

    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setIsStarting(false);
  }, []);

  const waitForVideoElement = useCallback(async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (videoRef.current) {
        return videoRef.current;
      }

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }

    return null;
  }, []);

  const handleDetectedCode = useCallback(
    (value: string) => {
      const normalized = value.trim().toUpperCase();

      if (!normalized || normalized === lastCode) {
        return;
      }

      setLastCode(normalized);
      setSuccessMessage(`Kodi u lexua: ${normalized}`);

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(120);
      }

      stopScanner();
      window.setTimeout(() => {
        onDetected(normalized);
        onClose();
      }, 250);
    },
    [lastCode, onClose, onDetected, stopScanner],
  );

  const startNativeScanner = useCallback(async () => {
    const video = await waitForVideoElement();

    if (!video) {
      setErrorMessage("Nuk u inicializua preview i kameres.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
      },
      audio: false,
    });

    streamRef.current = stream;
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    await video.play();

    const Detector = getBarcodeDetectorCtor();

    if (!Detector) {
      throw new Error("BarcodeDetector mungon.");
    }

    const detector = new Detector({
      formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39"],
    });

    detectIntervalRef.current = window.setInterval(async () => {
      const currentVideo = videoRef.current;

      if (!currentVideo || currentVideo.readyState < 2) {
        return;
      }

      try {
        const results = await detector.detect(currentVideo);
        const detectedValue = results.find((item) => item.rawValue?.trim())?.rawValue;

        if (detectedValue) {
          handleDetectedCode(detectedValue);
        }
      } catch {
        setErrorMessage("Skanimi deshtoi. Provo perseri.");
        stopScanner();
      }
    }, 500);
  }, [handleDetectedCode, stopScanner, waitForVideoElement]);

  const startZxingScanner = useCallback(async () => {
    const video = await waitForVideoElement();

    if (!video) {
      setErrorMessage("Nuk u inicializua preview i kameres.");
      return;
    }

    video.setAttribute("playsinline", "true");

    const { BrowserMultiFormatReader } = await import("@zxing/browser");
    const { BarcodeFormat, DecodeHintType, NotFoundException } = await import(
      "@zxing/library"
    );

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODABAR,
      BarcodeFormat.ITF,
    ]);

    const reader = new BrowserMultiFormatReader(hints);

    zxingControlsRef.current = await reader.decodeFromVideoDevice(
      undefined,
      video,
      (result, error, controls) => {
        zxingControlsRef.current = controls;

        if (result?.getText()) {
          handleDetectedCode(result.getText());
          return;
        }

        if (error && !(error instanceof NotFoundException)) {
          setErrorMessage("Skanimi deshtoi. Provo perseri.");
          stopScanner();
        }
      },
    );
  }, [handleDetectedCode, stopScanner, waitForVideoElement]);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setErrorMessage(null);
      setSuccessMessage(null);
      setLastCode("");
      setManualCode("");
      return;
    }

    if (!supportState.isSupported) {
      return;
    }

    let cancelled = false;

    const start = async () => {
      setIsStarting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        if (engine === "native") {
          await startNativeScanner();
        } else {
          await startZxingScanner();
        }

        if (!cancelled) {
          setIsStarting(false);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage("Nuk u hap kamera. Lejo qasjen te kamera dhe provo perseri.");
          setIsStarting(false);
          stopScanner();
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [engine, open, startNativeScanner, startZxingScanner, stopScanner, supportState.isSupported]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      manualInputRef.current?.focus();
      manualInputRef.current?.select();
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="Mbyll scanner-in"
      />

      <div className="relative z-[121] flex w-full max-w-[720px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.2)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Scanner
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
              {title}
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            aria-label="Mbyll"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Kodi manual / scanner fizik
              </span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleDetectedCode(manualCode);
                    }
                  }}
                  placeholder="Shkruaj ose skano kodin ketu"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleDetectedCode(manualCode)}
                  disabled={!manualCode.trim()}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[112px]"
                >
                  Përdor kodin
                </button>
              </div>
            </label>
          </div>

          {!supportState.isSupported ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              {supportState.reason}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-slate-950">
            <div className="relative aspect-[16/9] max-h-[340px] w-full bg-black sm:max-h-[380px]">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                autoPlay
                playsInline
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                <div className="h-20 w-full max-w-[220px] rounded-[22px] border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.42)] sm:h-24 sm:max-w-[250px]" />
              </div>
            </div>
            <div className="border-t border-slate-800 px-3.5 py-2.5 text-sm text-slate-300">
              {isStarting
                ? "Po hapet kamera..."
                : engine === "native"
                  ? "Drejtoje kameran te barcode-i dhe mbaje te qete 1-2 sekonda."
                  : "Po perdoret scanner fallback per iPhone/Safari. Drejtoje kameran te barcode-i dhe mbaje te qete 1-2 sekonda."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

