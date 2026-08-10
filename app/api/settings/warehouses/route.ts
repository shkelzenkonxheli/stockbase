import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { createTenantWarehouse } from "@/lib/warehouses";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id;

  if (!currentUser || !tenantId || !hasRole(currentUser, ["SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { name?: string };

  try {
    payload = (await request.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const warehouse = await createTenantWarehouse({
      tenantId,
      userId: currentUser.id,
      name: payload.name ?? "",
    });

    revalidatePath("/settings");
    revalidatePath("/products");
    revalidatePath("/orders");
    revalidatePath("/orders/new");
    revalidatePath("/orders/quick");
    revalidatePath("/stock/incoming");
    revalidatePath("/stock/transfer");
    revalidatePath("/stock/count");

    return NextResponse.json({ ok: true, warehouse });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Krijimi i depos deshtoi." },
      { status: 400 },
    );
  }
}
