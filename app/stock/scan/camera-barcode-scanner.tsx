"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { IScannerControls } from "@zxing/browser";

type CameraBarcodeScannerProps = {
  initialCode: string;
};

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

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;

  return typeof candidate === "function" ? candidate : null;
}

export function CameraBarcodeScanner({
  initialCode,
}: CameraBarcodeScannerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<number | null>(null);
  const redirectTimeoutRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState(initialCode);

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
          "Kamera kerkon HTTPS ose localhost real. Nga telefoni me adrese si http://192.168.x.x browser-i e bllokon kameran.",
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

  const isSupported = supportState.isSupported;
  const supportReason = supportState.reason;
  const engine: ScannerEngine = getBarcodeDetectorCtor() ? "native" : "zxing";

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

    setIsOpen(false);
    setIsStarting(false);

    window.setTimeout(() => {
      const manualInput = document.querySelector<HTMLInputElement>(
        'input[name="code"]',
      );

      manualInput?.focus();
      manualInput?.select();
    }, 0);
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
      redirectTimeoutRef.current = window.setTimeout(() => {
        router.push(`/stock/scan?code=${encodeURIComponent(normalized)}`);
        router.refresh();
      }, 350);
    },
    [lastCode, router, stopScanner],
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

  const startScanner = useCallback(async () => {
    if (!isSupported || isStarting || isOpen) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsStarting(true);
    setIsOpen(true);

    try {
      if (engine === "native") {
        await startNativeScanner();
      } else {
        await startZxingScanner();
      }

      setIsStarting(false);
    } catch {
      setErrorMessage(
        "Nuk u hap kamera. Lejo qasjen te kamera dhe provo perseri.",
      );
      setIsStarting(false);
      stopScanner();
    }
  }, [engine, isOpen, isStarting, isSupported, startNativeScanner, startZxingScanner, stopScanner]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <section className="rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Kamera
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Skano me kamere
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Ne telefon mund ta hapesh kameran dhe ta drejtosh te barcode-i. Sapo
            kodi lexohet, faqja hap direkt variantin.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {!isOpen ? (
            <button
              type="button"
              onClick={startScanner}
              disabled={!isSupported || isStarting}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isStarting ? "Po hapet..." : "Hape kameran"}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopScanner}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Mbylle kameran
            </button>
          )}
        </div>
      </div>

      {!isSupported ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {supportReason ??
            "Ky browser nuk e mbeshtet skanimin direkt me kamere. Ne kete rast perdore scanner fizik ose shkruaje kodin manualisht."}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {isOpen ? (
        <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
          <div className="relative aspect-[4/3] w-full bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              autoPlay
              playsInline
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="h-32 w-full max-w-xs rounded-[28px] border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.42)]" />
            </div>
          </div>
          <div className="border-t border-slate-800 px-4 py-3 text-sm text-slate-300">
            {engine === "native"
              ? "Drejtoje kameran te barcode-i dhe mbaje te qete 1-2 sekonda."
              : "Po perdoret scanner fallback per iPhone/Safari. Drejtoje kameran te barcode-i dhe mbaje te qete 1-2 sekonda."}
          </div>
        </div>
      ) : null}
    </section>
  );
}
