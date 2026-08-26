import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createPosRegister, getPosApiContext } from "@/lib/pos";

export async function POST(request: Request) {
  const apiContext = await getPosApiContext(["SUPER_ADMIN"]);
  if (!apiContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let payload: { warehouseId?: number; name?: string };

  try {
    payload = (await request.json()) as { warehouseId?: number; name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const register = await createPosRegister({
      tenantId: apiContext.tenantId,
      warehouseId: Number(payload.warehouseId),
      userId: apiContext.currentUser.id,
      name: payload.name ?? "",
    });

    revalidatePath("/pos");
    revalidatePath("/pos/open");
    revalidatePath("/pos/registers");

    return NextResponse.json({ ok: true, register });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Krijimi i register-it deshtoi." },
      { status: 400 },
    );
  }
}
