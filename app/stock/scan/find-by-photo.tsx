"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadedImage } from "@/app/components/uploaded-image";
import type { PhotoResult } from "@/lib/find-by-photo";

type SearchStage = "idle" | "opening" | "analyzing" | "searching" | "comparing";
const stageText: Record<Exclude<SearchStage, "idle">, string> = {
  opening: "Po hapet kamera...",
  analyzing: "Po analizohet fotoja...",
  searching: "Po kerkohen produktet...",
  comparing: "Po krahasohen rezultatet...",
};

async function makeSearchFile(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error("Zgjidh nje foto JPG, PNG ose WebP deri ne 8 MB.");
  }
  if (typeof createImageBitmap !== "function") {
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    if (!blob || blob.size > 8 * 1024 * 1024) return file;
    return new File([blob], "find-by-photo.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

function PhotoResultCard({ result, selected, onSelect }: { result: PhotoResult; selected: boolean; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} aria-pressed={selected} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xs text-slate-400">{result.imagePath ? <UploadedImage src={result.imagePath} alt={result.name} className="h-full w-full object-cover" /> : "Pa foto"}</div>
    <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-950">{[result.brand, result.name].filter(Boolean).join(" ")}</p><p className="text-xs text-slate-600">{result.matchedColor ?? "Ngjyra e panjohur"} · {result.category}</p><p className="mt-1 text-xs font-semibold text-emerald-700">{result.confidence === "strong" ? "Perputhje e forte" : "Perputhje e mundshme"}</p></div>
  </button>;
}

function ResultDetails({ result }: { result: PhotoResult }) {
  const matched = result.colors.find((group) => group.color === result.matchedColor) ?? result.colors[0];
  const others = result.colors.filter((group) => group !== matched);
  return <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex items-center gap-3"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xs text-slate-400">{result.imagePath ? <UploadedImage src={result.imagePath} alt={result.name} className="h-full w-full object-contain" /> : "Pa foto"}</div><div><h3 className="text-lg font-semibold text-slate-950">{[result.brand, result.name].filter(Boolean).join(" ")}</h3><p className="text-sm text-slate-600">{matched?.color ?? "Pa ngjyre"}</p></div></div>
    <div><h4 className="text-sm font-semibold text-slate-900">Numrat dhe stoku {matched ? `· ${matched.color}` : ""}</h4>{matched?.sizes.length ? <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{matched.sizes.map((item) => <div key={item.size} className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><b>{item.size || "-"}</b><p className={item.stock > 0 ? "text-emerald-700" : "text-slate-500"}>{item.stock > 0 ? `${item.stock} ne stok` : "Pa stok"}</p></div>)}</div> : <p className="mt-1 text-sm text-slate-500">Nuk ka variante te regjistruara.</p>}</div>
    {others.length ? <div><h4 className="text-sm font-semibold text-slate-900">Ngjyra tjera</h4><div className="mt-2 grid gap-2 sm:grid-cols-2">{others.map((group) => <div key={group.color} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-[10px] text-slate-400">{group.imagePath ? <UploadedImage src={group.imagePath} alt={group.color} className="h-full w-full object-cover" /> : "Pa foto"}</div><div><p className="text-sm font-medium">{group.color}</p><p className="text-xs text-slate-600">{group.totalStock > 0 ? `${group.totalStock} ne stok` : "Pa stok"}</p></div></div>)}</div></div> : null}
    <div><h4 className="text-sm font-semibold text-slate-900">Stoku sipas depos per kete ngjyre</h4>{matched?.warehouses.length ? <div className="mt-2 space-y-1">{matched.warehouses.map((warehouse) => <p key={warehouse.name} className="flex justify-between gap-4 text-sm text-slate-700"><span>{warehouse.name}</span><b>{warehouse.stock}</b></p>)}</div> : <p className="mt-1 text-sm text-slate-500">Nuk ka stok te lidhur me depo.</p>}{matched && matched.unassignedStock > 0 ? <p className="mt-1 text-xs text-slate-500">Pa depo te regjistruar: {matched.unassignedStock}</p> : null}</div>
    <Link href={`/products/${result.productId}`} className="inline-flex w-full justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white sm:w-auto">Hap produktin</Link>
  </div>;
}

export function FindByPhoto() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [stage, setStage] = useState<SearchStage>("idle");
  const [error, setError] = useState("");
  const [results, setResults] = useState<PhotoResult[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null; }
    setCameraOpen(false);
    setStage("idle");
  }, []);

  useEffect(() => {
    if (!photo) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => () => { abortRef.current?.abort(); stopCamera(); }, [stopCamera]);

  async function openCamera() {
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Kamera kerkon HTTPS ose localhost. Perdore ngarkimin e fotos si alternative.");
      return;
    }
    setStage("opening");
    setCameraOpen(true);
    const requestId = ++cameraRequestRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (requestId !== cameraRequestRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (requestId !== cameraRequestRef.current) return;
      if (!videoRef.current) throw new Error("Preview i kameres nuk u hap.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStage("idle");
    } catch (cause) {
      stopCamera();
      setStage("idle");
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Leja e kameres u refuzua. Aktivizoje ne browser ose ngarko nje foto."
        : "Kamera nuk u hap. Kontrollo pajisjen ose ngarko nje foto.");
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) { setError("Kamera nuk eshte gati. Provo perseri."); return; }
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    stopCamera();
    if (!blob) { setError("Fotoja nuk u kap. Provo perseri."); return; }
    setPhoto(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
    setResults(null);
  }

  async function choosePhoto(file: File | null) {
    if (!file) return;
    setError("");
    setResults(null);
    try { setPhoto(await makeSearchFile(file)); stopCamera(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Fotoja nuk u lexua."); }
  }

  function retake() {
    abortRef.current?.abort();
    stopCamera();
    setPhoto(null);
    setResults(null);
    setSelectedId(null);
    setError("");
    setStage("idle");
  }

  async function search() {
    if (!photo || stage !== "idle") return;
    const abort = new AbortController();
    abortRef.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 90000);
    setError("");
    setResults(null);
    setStage("analyzing");
    try {
      const data = new FormData();
      data.set("image", photo);
      const response = await fetch("/api/stock/find-by-photo", { method: "POST", body: data, signal: abort.signal });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error ?? "Kerkimi deshtoi.");
      }
      if (!response.body) throw new Error("Pergjigjja nuk u lexua.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let receivedResult = false;
      const handleLine = (line: string) => {
        if (!line.trim()) return;
        const message = JSON.parse(line) as { event: string; results?: PhotoResult[]; message?: string };
        if (message.event === "searching" || message.event === "comparing") setStage(message.event);
        if (message.event === "error") throw new Error(message.message ?? "Kerkimi deshtoi.");
        if (message.event === "result") {
          const nextResults = message.results ?? [];
          setResults(nextResults);
          setSelectedId(nextResults.length === 1 && nextResults[0].confidence === "strong" ? nextResults[0].productId : null);
          receivedResult = true;
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      }
      if (pending.trim()) handleLine(pending);
      if (!receivedResult) throw new Error("Kerkimi u nderpre. Provo perseri.");
    } catch (cause) {
      setError(abort.signal.aborted ? "Kerkimi zgjati shume ose u nderpre. Provo perseri." : cause instanceof Error ? cause.message : "Kerkimi deshtoi.");
    } finally {
      window.clearTimeout(timeout);
      if (abortRef.current === abort) abortRef.current = null;
      setStage("idle");
    }
  }

  const selected = results?.find((result) => result.productId === selectedId);
  return <section className="rounded-[30px] border border-emerald-200 bg-[linear-gradient(135deg,#f2fff7,#ffffff_65%)] px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:px-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Powered by StockBase AI</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">Find by Photo</h2><p className="mt-2 text-sm text-slate-600">Fotografo produktin dhe kerkoje ne stokun ekzistues. Asgje nuk krijohet apo ndryshohet.</p></div>
    <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => void openCamera()} disabled={stage !== "idle" || cameraOpen} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Hap kameran</button><label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Ngarko foto<input type="file" accept="image/*" className="sr-only" onChange={(event) => { void choosePhoto(event.target.files?.[0] ?? null); event.target.value = ""; }} /></label></div>
    <div className={cameraOpen ? "mt-4 overflow-hidden rounded-2xl bg-black" : "hidden"}><video ref={videoRef} muted playsInline autoPlay className="aspect-[4/3] w-full object-cover" /><div className="flex justify-center gap-2 p-3"><button type="button" onClick={() => void capturePhoto()} disabled={stage === "opening"} className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Shkrepe foton</button><button type="button" onClick={stopCamera} className="rounded-xl border border-white/40 px-4 py-2 text-sm text-white">Anulo</button></div></div>
    {previewUrl ? <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><UploadedImage src={previewUrl} alt="Fotoja per kerkimin e produktit" className="h-44 w-full rounded-2xl border border-slate-200 bg-white object-contain sm:w-44" /><div className="flex flex-wrap gap-2"><button type="button" onClick={retake} disabled={stage !== "idle"} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Ribeje foton</button><button type="button" onClick={() => void search()} disabled={stage !== "idle"} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Kerko produktin</button></div></div> : null}
    {stage !== "idle" ? <p role="status" className="mt-4 text-sm font-medium text-emerald-800">{stageText[stage]}</p> : null}
    {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    {results?.length === 0 ? <div className="mt-5 rounded-2xl bg-slate-50 p-5"><h3 className="font-semibold">Nuk u gjet produkt i ngjashem</h3><p className="mt-1 text-sm text-slate-600">Fotoja nuk u perputh me besueshmeri me katalogun tend.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={retake} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Bej foto tjeter</button><Link href="/products" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Kerko manualisht</Link></div></div> : null}
    {results && results.length > 0 ? <div className="mt-5"><h3 className="text-lg font-semibold">{results.length === 1 && results[0].confidence === "strong" ? "Produkt i gjetur" : "Perputhje te mundshme"}</h3><p className="mt-1 text-xs text-slate-500">Kontrollo foton dhe modelin para se te vendosesh.</p><div className="mt-3 grid gap-2">{results.map((result) => <PhotoResultCard key={result.productId} result={result} selected={selectedId === result.productId} onSelect={() => setSelectedId(result.productId)} />)}</div>{selected ? <ResultDetails result={selected} /> : null}</div> : null}
  </section>;
}
