import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { isSocialMediaEnabled } from "@/lib/inventory-module-access";
import { decryptInstagramToken } from "@/lib/instagram-oauth";
import { prisma } from "@/lib/prisma";
import { parseTenantCatalogConfig } from "@/lib/product-taxonomy";

type PublishPayload = { variantId?: number; imageUrl?: string; caption?: string; type?: "POST" | "STORY" };
type GraphResponse = { id?: string; status_code?: string; error?: { message?: string } };

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForMediaContainer(containerId: string, accessToken: string) {
  // Instagram processes the remote image asynchronously before it can be published.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(2_500);
    const statusUrl = new URL(`https://graph.instagram.com/${containerId}`);
    statusUrl.searchParams.set("fields", "status_code");
    statusUrl.searchParams.set("access_token", accessToken);
    const response = await fetch(statusUrl, { cache: "no-store" });
    const body = await response.json() as GraphResponse;
    if (!response.ok) throw new Error(body.error?.message ?? "Nuk u kontrollua statusi i medias ne Instagram.");
    if (body.status_code === "FINISHED") return;
    if (body.status_code === "ERROR" || body.status_code === "EXPIRED") {
      throw new Error("Instagram nuk arriti ta pergatise foton per publikim.");
    }
  }
  throw new Error("Instagram po e pergatit foton me gjate se zakonisht. Provo perseri pas pak.");
}

function resolvePublicImageUrl(value: string) {
  if (/^https:\/\//i.test(value)) return value;
  const baseUrl = process.env.SOCIAL_PUBLIC_BASE_URL?.trim();
  if (!baseUrl?.startsWith("https://")) {
    throw new Error("Per publikim nga localhost vendos SOCIAL_PUBLIC_BASE_URL me nje URL publike HTTPS.");
  }
  return new URL(value, baseUrl).toString();
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant || !hasRole(currentUser, ["SUPER_ADMIN"]) || !isSocialMediaEnabled(currentUser.tenant.catalogConfig)) {
    return NextResponse.json({ error: "Nuk ke qasje ne Social Media." }, { status: 403 });
  }

  let payload: PublishPayload;
  try { payload = await request.json() as PublishPayload; } catch { return NextResponse.json({ error: "Kerkesa nuk eshte valide." }, { status: 400 }); }
  const variantId = Number(payload.variantId);
  const caption = String(payload.caption ?? "").trim();
  const type = payload.type === "STORY" ? "STORY" : "POST";
  const uploadedImageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : "";
  if ((!Number.isInteger(variantId) || variantId <= 0) && !uploadedImageUrl) return NextResponse.json({ error: "Zgjidh ose ngarko nje foto." }, { status: 400 });
  if (caption.length > 2200) return NextResponse.json({ error: "Caption mund te kete maksimumi 2200 karaktere." }, { status: 400 });

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: currentUser.tenant.id }, select: { catalogConfig: true } });
  const instagram = parseTenantCatalogConfig(settings?.catalogConfig)?.socialMedia?.instagram;
  if (!instagram) return NextResponse.json({ error: "Lidhe Instagram para publikimit." }, { status: 400 });
  const variant = Number.isInteger(variantId) && variantId > 0 ? await prisma.variant.findFirst({ where: { id: variantId, tenantId: currentUser.tenant.id }, select: { id: true, imagePath: true, product: { select: { name: true } } } }) : null;
  const imagePath = uploadedImageUrl || variant?.imagePath;
  if (!imagePath) return NextResponse.json({ error: "Foto e produktit nuk u gjet." }, { status: 404 });

  try {
    const imageUrl = resolvePublicImageUrl(imagePath);
    const imageCheck = await fetch(imageUrl, { method: "HEAD", cache: "no-store" });
    const imageContentType = imageCheck.headers.get("content-type") ?? "";
    if (!imageCheck.ok || !imageContentType.startsWith("image/")) {
      console.error("Instagram image validation failed", { variantId, status: imageCheck.status, contentType: imageContentType, imageUrl });
      return NextResponse.json({ error: "Foto e zgjedhur nuk eshte publikisht e aksesueshme si imazh. Ngarko perseri foton e produktit dhe provo perseri." }, { status: 400 });
    }
    const accessToken = decryptInstagramToken(instagram.encryptedAccessToken);
    const mediaUrl = new URL(`https://graph.instagram.com/${instagram.accountId}/media`);
    const mediaBody = new URLSearchParams({ image_url: imageUrl, access_token: accessToken });
    if (type === "STORY") {
      mediaBody.set("media_type", "STORIES");
    } else {
      mediaBody.set("media_type", "IMAGE");
      mediaBody.set("caption", caption);
    }
    const mediaResponse = await fetch(mediaUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: mediaBody, cache: "no-store" });
    const media = await mediaResponse.json() as GraphResponse;
    if (!mediaResponse.ok || !media.id) throw new Error(media.error?.message ?? "Instagram nuk krijoi media container.");
    await waitForMediaContainer(media.id, accessToken);
    const publishResponse = await fetch(`https://graph.instagram.com/${instagram.accountId}/media_publish`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ creation_id: media.id, access_token: accessToken }), cache: "no-store" });
    const published = await publishResponse.json() as GraphResponse;
    if (!publishResponse.ok || !published.id) throw new Error(published.error?.message ?? "Instagram nuk e publikoi median.");
    await prisma.auditLog.create({ data: { tenantId: currentUser.tenant.id, userId: currentUser.id, action: type === "STORY" ? "SOCIAL_INSTAGRAM_STORY_PUBLISHED" : "SOCIAL_INSTAGRAM_POST_PUBLISHED", entityType: variant ? "Variant" : "SocialMedia", entityId: variant?.id ?? null, entityLabel: variant?.product.name ?? "Foto e ngarkuar", metadata: { instagramMediaId: published.id } } });
    return NextResponse.json({ ok: true, mediaId: published.id });
  } catch (error) {
    console.error("Instagram publication failed", { tenantId: currentUser.tenant.id, variantId, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Publikimi deshtoi." }, { status: 502 });
  }
}
