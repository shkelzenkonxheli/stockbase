import { NextResponse } from "next/server";
import { getPosApiContext, openPosSession } from "@/lib/pos";

export async function POST(request: Request) {
  const apiContext = await getPosApiContext(["SUPER_ADMIN", "SELLER"]);
  if (!apiContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let payload: { registerId?: number; openingCash?: number; openingNote?: string };

  try {
    payload = (await request.json()) as { registerId?: number; openingCash?: number; openingNote?: string };
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const session = await openPosSession({
      tenantId: apiContext.tenantId,
      registerId: Number(payload.registerId),
      userId: apiContext.currentUser.id,
      openingCash: Number(payload.openingCash ?? 0),
      openingNote: payload.openingNote ?? null,
    });

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      redirectTo: `/pos/session/${session.id}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hapja e register-it deshtoi." },
      { status: 400 },
    );
  }
}
