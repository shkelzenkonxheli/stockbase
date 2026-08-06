CREATE TYPE "InventoryCountStatus" AS ENUM ('OPEN', 'COMPLETED');

ALTER TYPE "StockMovementReason" ADD VALUE IF NOT EXISTS 'INVENTORY_COUNT';

CREATE TABLE "InventoryCountSession" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "status" "InventoryCountStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT,
  "createdById" INTEGER,
  "completedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "InventoryCountSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryCountLine" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "variantId" INTEGER NOT NULL,
  "expectedStock" INTEGER NOT NULL,
  "countedStock" INTEGER,
  "difference" INTEGER,
  "locationCode" TEXT,
  "note" TEXT,
  "countedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryCountLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryCountLine_sessionId_variantId_key" ON "InventoryCountLine"("sessionId", "variantId");
CREATE INDEX "InventoryCountSession_tenantId_idx" ON "InventoryCountSession"("tenantId");
CREATE INDEX "InventoryCountSession_warehouseId_idx" ON "InventoryCountSession"("warehouseId");
CREATE INDEX "InventoryCountSession_status_idx" ON "InventoryCountSession"("status");
CREATE INDEX "InventoryCountSession_createdAt_idx" ON "InventoryCountSession"("createdAt");
CREATE INDEX "InventoryCountLine_sessionId_idx" ON "InventoryCountLine"("sessionId");
CREATE INDEX "InventoryCountLine_variantId_idx" ON "InventoryCountLine"("variantId");

ALTER TABLE "InventoryCountSession"
ADD CONSTRAINT "InventoryCountSession_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryCountSession"
ADD CONSTRAINT "InventoryCountSession_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryCountSession"
ADD CONSTRAINT "InventoryCountSession_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryCountSession"
ADD CONSTRAINT "InventoryCountSession_completedById_fkey"
FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryCountLine"
ADD CONSTRAINT "InventoryCountLine_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "InventoryCountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryCountLine"
ADD CONSTRAINT "InventoryCountLine_variantId_fkey"
FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
