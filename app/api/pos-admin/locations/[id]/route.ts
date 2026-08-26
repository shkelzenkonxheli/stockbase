import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getPosApiContext, setPosLocationSupport } from "@/lib/pos";

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
  const warehouseId = Number(params.id);
  if (!warehouseId) {
    return NextResponse.json({ error: "Lokacion invalid." }, { status: 400 });
  }

  let payload: { supportsPos?: boolean };

  try {
    payload = (await request.json()) as { supportsPos?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const warehouse = await setPosLocationSupport({
      tenantId: apiContext.tenantId,
      warehouseId,
      userId: apiContext.currentUser.id,
      supportsPos: Boolean(payload.supportsPos),
    });

    revalidatePath("/pos");
    revalidatePath("/pos/open");
    revalidatePath("/pos/registers");
    revalidatePath("/settings");

    return NextResponse.json({ ok: true, warehouse });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Veprimi deshtoi." },
      { status: 400 },
    );
  }
}
