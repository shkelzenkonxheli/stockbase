import assert from "node:assert/strict";
import test from "node:test";
import { activeTenantWarehouseWhere } from "./warehouse-scope";

test("warehouse lookup is scoped to the active tenant and warehouse", () => {
  assert.deepEqual(activeTenantWarehouseWhere(3, 12), {
    id: 12,
    tenantId: 3,
    isActive: true,
  });
  assert.notDeepEqual(activeTenantWarehouseWhere(3, 12), activeTenantWarehouseWhere(4, 12));
});
