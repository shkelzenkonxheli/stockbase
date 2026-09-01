import { NextResponse } from "next/server";
import { createPosCashMovement, getPosApiContext } from "@/lib/pos";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteProps) {
  const apiContext = await getPosApiContext(["SUPER_ADMIN", "SELLER"]);
  if (!apiContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ error: "Session invalid." }, { status: 400 });
  }

  let payload: { type?: unknown; amount?: unknown; note?: unknown };
  try {
    payload = (await request.json()) as { type?: unknown; amount?: unknown; note?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (payload.type !== "CASH_IN" && payload.type !== "CASH_OUT") {
    return NextResponse.json({ error: "Lloji i levizjes nuk eshte valid." }, { status: 400 });
  }

  try {
    const movement = await createPosCashMovement({
      tenantId: apiContext.tenantId,
      sessionId,
      userId: apiContext.currentUser.id,
      userRole: apiContext.currentUser.role,
      type: payload.type,
      amount: Number(payload.amount),
      note: typeof payload.note === "string" ? payload.note : null,
    });

    return NextResponse.json({ ok: true, movementId: movement.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Levizja e cash-it deshtoi." },
      { status: 400 },
    );
  }
}
