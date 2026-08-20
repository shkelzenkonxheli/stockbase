import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";

type AuditClient = PrismaClient | Prisma.TransactionClient;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  STOCK_INCOMING_CREATED: "Hyrje stoku",
  STOCK_TRANSFER_CREATED: "Transfer stoku",
  INVENTORY_COUNT_CREATED: "Krijo numerim",
  INVENTORY_COUNT_COMPLETED: "Perfundo numerimin",
  QUICK_STOCK_ADDED: "Shto stok",
  QUICK_STOCK_SET: "Ndrysho stok",
  VARIANT_CREATED: "Shto variant",
  VARIANT_DELETED: "Fshi variant",
  ORDER_CREATED: "Krijo porosi",
  ORDER_DELETED: "Fshi porosi",
  ORDER_BULK_DELETED: "Fshi disa porosi",
  PURCHASE_ORDER_CREATED: "Krijo purchase order",
  PURCHASE_ORDER_UPDATED: "Perditeso purchase order",
  PURCHASE_ORDER_RECEIVED: "Prano purchase order",
  PURCHASE_ORDER_RETURNED_TO_SUPPLIER: "Kthim te furnitori",
  PURCHASE_ORDER_CANCELED: "Anulo purchase order",
  WAREHOUSE_CREATED: "Krijo depo",
  WAREHOUSE_UPDATED: "Perditeso depo",
  WAREHOUSE_DELETED: "Fshi depo",
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  STOCK: "Stok",
  TRANSFER: "Transfer",
  INVENTORY_COUNT: "Numerim",
  VARIANT: "Variant",
  ORDER: "Porosi",
  PURCHASE_ORDER: "Purchase order",
  WAREHOUSE: "Depo",
};

type AuditLogInput = {
  tenantId: number;
  userId?: number | null;
  action: keyof typeof AUDIT_ACTION_LABELS | (string & {});
  entityType: keyof typeof AUDIT_ENTITY_LABELS | (string & {});
  entityId?: number | null;
  entityLabel?: string | null;
  warehouseId?: number | null;
  metadata?: Prisma.InputJsonValue | null;
};

export async function writeAuditLog(client: AuditClient, input: AuditLogInput) {
  await client.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityLabel: input.entityLabel ?? null,
      warehouseId: input.warehouseId ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export function getAuditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function getAuditEntityLabel(entityType: string) {
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}
