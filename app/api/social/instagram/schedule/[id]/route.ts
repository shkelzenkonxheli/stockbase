import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { isSocialMediaEnabled } from "@/lib/inventory-module-access";
import { prisma } from "@/lib/prisma";

async function access() {
  const user = await getCurrentUser();
  return user?.tenant && hasRole(user, ["SUPER_ADMIN"]) && isSocialMediaEnabled(user.tenant.catalogConfig) ? user : null;
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await access(); if (!user) return NextResponse.json({ error: "Nuk ke qasje." }, { status: 403 });
  const { id } = await params;
  await prisma.socialPublication.deleteMany({ where: { id: Number(id), tenantId: user.tenant!.id, status: "SCHEDULED" } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await access(); if (!user) return NextResponse.json({ error: "Nuk ke qasje." }, { status: 403 });
  const { id } = await params; const body = await request.json() as { scheduledAt?: string }; const scheduledAt = new Date(String(body.scheduledAt ?? ""));
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) return NextResponse.json({ error: "Zgjidh nje ore ne te ardhmen." }, { status: 400 });
  const result = await prisma.socialPublication.updateMany({ where: { id: Number(id), tenantId: user.tenant!.id, status: "SCHEDULED" }, data: { scheduledAt } });
  return result.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Postimi nuk mund te ndryshohet." }, { status: 404 });
}
