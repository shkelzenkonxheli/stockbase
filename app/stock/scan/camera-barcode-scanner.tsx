"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState(initialCode);

  const supportState = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        isSupported: false,
        reason: "Po ngarkohet kontrolli i kamerës.",
      };
    }

    const hasCameraApi =
      Boolean(navigator.mediaDevices) &&
      typeof navigator.mediaDevices.getUserMedia === "function";
    const hasDetector = Boolean(getBarcodeDetectorCtor());
    const isSecure =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSecure) {
      return {
        isSupported: false,
        reason:
          "Kamera kërkon HTTPS ose localhost real. Nga telefoni me adresë si http://192.168.x.x browser-i e bllokon kamerën.",
      };
    }

    if (!hasCameraApi) {
      return {
        isSupported: false,
        reason: "Ky browser nuk e mbështet hapjen e kamerës nga web app-i.",
      };
    }

    if (!hasDetector) {
      return {
        isSupported: false,
        reason: "Ky browser nuk e mbështet leximin automatik të barcode-it.",
      };
    }

    return {
      isSupported: true,
      reason: null,
    };
  }, []);

  const isSupported = supportState.isSupported;
  const supportReason = supportState.reason;

  const stopScanner = useCallback(() => {
    if (detectIntervalRef.current) {
      window.clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
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

  const startScanner = useCallback(async () => {
    if (!isSupported || isStarting || isOpen) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setErrorMessage("Nuk u inicializua preview i kameres.");
        setIsStarting(false);
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      const Detector = getBarcodeDetectorCtor();

      if (!Detector) {
        stopScanner();
        setErrorMessage("Ky browser nuk e mbeshtet skanimin direkt me kamer.");
        return;
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

      setIsOpen(true);
      setIsStarting(false);
    } catch {
      setErrorMessage(
        "Nuk u hap kamera. Lejo qasjen te kamera dhe provo perseri.",
      );
      setIsStarting(false);
    }
  }, [handleDetectedCode, isOpen, isStarting, isSupported, stopScanner]);

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
            Skano me kamerë
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Ne telefon mund ta hapesh kamerën dhe ta drejtosh te barcode-i. Sapo
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
              {isStarting ? "Po hapet..." : "Hape kamerën"}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopScanner}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Mbylle kamerën
            </button>
          )}
        </div>
      </div>

      {!isSupported ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {supportReason ??
            "Ky browser nuk e mbështet skanimin direkt me kamerë. Në këtë rast përdore scanner fizik ose shkruaje kodin manualisht."}
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
            Drejtoje kamerën te barcode-i dhe mbaje të qetë 1-2 sekonda.
          </div>
        </div>
      ) : null}
    </section>
  );
}
