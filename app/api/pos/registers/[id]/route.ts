import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getPosApiContext, updatePosRegister } from "@/lib/pos";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteProps) {
  const apiContext = await getPosApiContext(["SUPER_ADMIN"]);
  if (!apiContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const params = await context.params;
  const registerId = Number(params.id);
  if (!registerId) {
    return NextResponse.json({ error: "Register invalid." }, { status: 400 });
  }

  let payload: { warehouseId?: number; name?: string; isActive?: boolean };

  try {
    payload = (await request.json()) as { warehouseId?: number; name?: string; isActive?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const register = await updatePosRegister({
      tenantId: apiContext.tenantId,
      registerId,
      warehouseId: Number(payload.warehouseId),
      userId: apiContext.currentUser.id,
      name: payload.name ?? "",
      isActive: Boolean(payload.isActive),
    });

    revalidatePath("/pos");
    revalidatePath("/pos/open");
    revalidatePath("/pos/registers");

    return NextResponse.json({ ok: true, register });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Perditesimi i register-it deshtoi." },
      { status: 400 },
    );
  }
}
