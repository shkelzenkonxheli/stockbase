export function activeTenantWarehouseWhere(tenantId: number, warehouseId: number) {
  return { id: warehouseId, tenantId, isActive: true } as const;
}
