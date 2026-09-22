import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { isSocialMediaEnabled } from "@/lib/inventory-module-access";
import { prisma } from "@/lib/prisma";

type Payload = { variantId?: number; imageUrl?: string; caption?: string; type?: "POST" | "STORY"; scheduledAt?: string };

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant || !hasRole(currentUser, ["SUPER_ADMIN"]) || !isSocialMediaEnabled(currentUser.tenant.catalogConfig)) {
    return NextResponse.json({ error: "Nuk ke qasje ne Social Media." }, { status: 403 });
  }

  let payload: Payload;
  try { payload = await request.json() as Payload; } catch { return NextResponse.json({ error: "Kerkesa nuk eshte valide." }, { status: 400 }); }
  const scheduledAt = new Date(String(payload.scheduledAt ?? ""));
  const variantId = Number(payload.variantId);
  const imageUrl = typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : "";
  if ((!Number.isInteger(variantId) || variantId <= 0) && !imageUrl) return NextResponse.json({ error: "Zgjidh ose ngarko nje foto." }, { status: 400 });
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) return NextResponse.json({ error: "Zgjidh nje ore ne te ardhmen." }, { status: 400 });
  const variant = Number.isInteger(variantId) && variantId > 0
    ? await prisma.variant.findFirst({ where: { id: variantId, tenantId: currentUser.tenant.id }, select: { id: true, imagePath: true } })
    : null;
  const finalImageUrl = imageUrl || variant?.imagePath;
  if (!finalImageUrl) return NextResponse.json({ error: "Foto e produktit nuk u gjet." }, { status: 404 });

  const publication = await prisma.socialPublication.create({ data: {
    tenantId: currentUser.tenant.id,
    createdById: currentUser.id,
    variantId: variant?.id,
    imageUrl: finalImageUrl,
    caption: String(payload.caption ?? "").trim(),
    type: payload.type === "STORY" ? "STORY" : "POST",
    scheduledAt,
  } });
  return NextResponse.json({ ok: true, id: publication.id });
}
