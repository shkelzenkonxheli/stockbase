import { NextResponse } from "next/server";
import { closePosSession, getPosApiContext } from "@/lib/pos";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteProps) {
  const apiContext = await getPosApiContext(["SUPER_ADMIN", "SELLER"]);
  if (!apiContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const params = await context.params;
  const sessionId = Number(params.id);
  if (!sessionId) {
    return NextResponse.json({ error: "Session invalid." }, { status: 400 });
  }

  let payload: { countedCash?: number; closingNote?: string | null };

  try {
    payload = (await request.json()) as { countedCash?: number; closingNote?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const session = await closePosSession({
      tenantId: apiContext.tenantId,
      sessionId,
      userId: apiContext.currentUser.id,
      userRole: apiContext.currentUser.role,
      countedCash: Number(payload.countedCash ?? 0),
      closingNote: payload.closingNote ?? null,
    });

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      redirectTo: "/pos/open",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mbyllja e register-it deshtoi." },
      { status: 400 },
    );
  }
}
