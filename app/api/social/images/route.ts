import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { isSocialMediaEnabled } from "@/lib/inventory-module-access";
import { saveSocialImage } from "@/lib/social-images";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.tenant || !hasRole(currentUser, ["SUPER_ADMIN"]) || !isSocialMediaEnabled(currentUser.tenant.catalogConfig)) return NextResponse.json({ error: "Nuk ke qasje." }, { status: 403 });
  try {
    const contentLength = Number(request.headers.get("content-length"));
    if (contentLength > 12 * 1024 * 1024) return NextResponse.json({ error: "Foto mund te jete maksimumi 10 MB." }, { status: 413 });
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "Zgjidh nje foto." }, { status: 400 });
    return NextResponse.json({ url: await saveSocialImage(currentUser.tenant.id, file) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ngarkimi deshtoi." }, { status: 400 }); }
}
