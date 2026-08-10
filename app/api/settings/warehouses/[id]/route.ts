import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { deleteTenantWarehouse, updateTenantWarehouse } from "@/lib/warehouses";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id;

  if (!currentUser || !tenantId || !hasRole(currentUser, ["SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const warehouseId = Number(id);

  if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
    return NextResponse.json({ error: "Depo e pavlefshme." }, { status: 400 });
  }

  let payload: { name?: string; isActive?: boolean };

  try {
    payload = (await request.json()) as { name?: string; isActive?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const warehouse = await updateTenantWarehouse({
      tenantId,
      warehouseId,
      userId: currentUser.id,
      name: payload.name ?? "",
      isActive: Boolean(payload.isActive),
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
      { error: error instanceof Error ? error.message : "Perditesimi i depos deshtoi." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant?.id;

  if (!currentUser || !tenantId || !hasRole(currentUser, ["SUPER_ADMIN"])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const warehouseId = Number(id);

  if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
    return NextResponse.json({ error: "Depo e pavlefshme." }, { status: 400 });
  }

  try {
    await deleteTenantWarehouse({
      tenantId,
      warehouseId,
      userId: currentUser.id,
    });

    revalidatePath("/settings");
    revalidatePath("/products");
    revalidatePath("/orders");
    revalidatePath("/orders/new");
    revalidatePath("/orders/quick");
    revalidatePath("/stock/incoming");
    revalidatePath("/stock/transfer");
    revalidatePath("/stock/count");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fshirja e depos deshtoi." },
      { status: 400 },
    );
  }
}
