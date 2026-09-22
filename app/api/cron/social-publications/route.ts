import { NextResponse } from "next/server";
import { decryptInstagramToken } from "@/lib/instagram-oauth";
import { prisma } from "@/lib/prisma";
import { parseTenantCatalogConfig } from "@/lib/product-taxonomy";

type GraphResponse = { id?: string; status_code?: string; error?: { message?: string } };
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function imageUrl(value: string) {
  if (/^https:\/\//i.test(value)) return value;
  const base = process.env.SOCIAL_PUBLIC_BASE_URL?.trim();
  if (!base?.startsWith("https://")) throw new Error("SOCIAL_PUBLIC_BASE_URL mungon.");
  return new URL(value, base).toString();
}

async function publish(item: { id: number; tenantId: number; imageUrl: string; caption: string; type: string }) {
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: item.tenantId }, select: { catalogConfig: true } });
  const instagram = parseTenantCatalogConfig(settings?.catalogConfig)?.socialMedia?.instagram;
  if (!instagram) throw new Error("Instagram nuk eshte i lidhur.");
  const token = decryptInstagramToken(instagram.encryptedAccessToken);
  const body = new URLSearchParams({ image_url: imageUrl(item.imageUrl), access_token: token });
  if (item.type === "STORY") body.set("media_type", "STORIES"); else { body.set("media_type", "IMAGE"); body.set("caption", item.caption); }
  const create = await fetch(`https://graph.instagram.com/${instagram.accountId}/media`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const media = await create.json() as GraphResponse;
  if (!create.ok || !media.id) throw new Error(media.error?.message ?? "Instagram nuk krijoi media.");
  for (let attempt = 0; attempt < 12; attempt += 1) { await delay(2500); const status = await fetch(`https://graph.instagram.com/${media.id}?fields=status_code&access_token=${encodeURIComponent(token)}`); const result = await status.json() as GraphResponse; if (!status.ok) throw new Error(result.error?.message ?? "Statusi i medias deshtoi."); if (result.status_code === "FINISHED") break; if (result.status_code === "ERROR" || result.status_code === "EXPIRED") throw new Error("Instagram nuk e pergatiti foton."); if (attempt === 11) throw new Error("Instagram po vonon perpunimin e fotos."); }
  const final = await fetch(`https://graph.instagram.com/${instagram.accountId}/media_publish`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ creation_id: media.id, access_token: token }) });
  const published = await final.json() as GraphResponse;
  if (!final.ok || !published.id) throw new Error(published.error?.message ?? "Instagram nuk e publikoi median.");
  return published.id;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const due = await prisma.socialPublication.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } }, orderBy: { scheduledAt: "asc" }, take: 20 });
  let published = 0;
  for (const item of due) {
    const locked = await prisma.socialPublication.updateMany({ where: { id: item.id, status: "SCHEDULED" }, data: { status: "PROCESSING" } });
    if (!locked.count) continue;
    try { const instagramMediaId = await publish(item); await prisma.socialPublication.update({ where: { id: item.id }, data: { status: "PUBLISHED", publishedAt: new Date(), instagramMediaId } }); published += 1; }
    catch (error) { await prisma.socialPublication.update({ where: { id: item.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Publikimi deshtoi." } }); }
  }
  return NextResponse.json({ ok: true, published, checked: due.length });
}
