import { NextResponse } from "next/server";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { isMultiWarehouseEnabled } from "@/lib/inventory-module-access";
import { parseStockTransferAdjustments } from "@/lib/stock-transfer";
import { createStockTransfer, revalidateStockTransferPaths } from "@/lib/stock-transfer-write";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const tenantId = user?.tenant?.id;
  if (!user || !tenantId || !hasRole(user, ["SUPER_ADMIN"]) ||
      !isMultiWarehouseEnabled(user.tenant?.catalogConfig)) {
    return NextResponse.json({ error: "Nuk ke qasje ne transferin e stokut." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Te dhenat nuk jane valide." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Te dhenat nuk jane valide." }, { status: 400 });
  }
  const data = payload as Record<string, unknown>;
  const adjustments = parseStockTransferAdjustments(JSON.stringify(data.adjustments ?? null));
  if (typeof data.fromWarehouseId !== "number" || typeof data.toWarehouseId !== "number" || !adjustments) {
    return NextResponse.json({ error: "Zgjedh depot dhe se paku nje sasi valide." }, { status: 400 });
  }

  const result = await createStockTransfer({
    tenantId,
    userId: user.id,
    fromWarehouseId: data.fromWarehouseId,
    toWarehouseId: data.toWarehouseId,
    adjustments,
  });
  if (!result.ok) {
    const messages = {
      validation: "Te dhenat e transferit nuk jane valide.",
      "same-warehouse": "Zgjedh dy depo te ndryshme.",
      warehouse: "Nje nga depot nuk eshte aktive.",
      variant: "Nje nga variantet nuk ekziston me.",
      stock: "Nuk ka stok te mjaftueshem ne depon burim.",
    };
    return NextResponse.json({ error: messages[result.reason] }, { status: result.reason === "stock" ? 409 : 400 });
  }

  revalidateStockTransferPaths(result.productIds);
  return NextResponse.json({ ok: true });
}
