-- AlterTable
ALTER TABLE "Warehouse"
ADD COLUMN "supportsPos" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "PosSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "PosRegister" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSession" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "registerId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "openedById" INTEGER NOT NULL,
    "closedById" INTEGER,
    "status" "PosSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingCash" DECIMAL(10,2) NOT NULL,
    "openingNote" TEXT,
    "closingNote" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "expectedCash" DECIMAL(10,2),
    "countedCash" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosRegister_tenantId_slug_key" ON "PosRegister"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "PosRegister_warehouseId_name_key" ON "PosRegister"("warehouseId", "name");

-- CreateIndex
CREATE INDEX "PosRegister_tenantId_idx" ON "PosRegister"("tenantId");

-- CreateIndex
CREATE INDEX "PosRegister_warehouseId_idx" ON "PosRegister"("warehouseId");

-- CreateIndex
CREATE INDEX "PosRegister_isActive_idx" ON "PosRegister"("isActive");

-- CreateIndex
CREATE INDEX "Warehouse_supportsPos_idx" ON "Warehouse"("supportsPos");

-- CreateIndex
CREATE INDEX "PosSession_tenantId_idx" ON "PosSession"("tenantId");

-- CreateIndex
CREATE INDEX "PosSession_registerId_idx" ON "PosSession"("registerId");

-- CreateIndex
CREATE INDEX "PosSession_warehouseId_idx" ON "PosSession"("warehouseId");

-- CreateIndex
CREATE INDEX "PosSession_openedById_idx" ON "PosSession"("openedById");

-- CreateIndex
CREATE INDEX "PosSession_closedById_idx" ON "PosSession"("closedById");

-- CreateIndex
CREATE INDEX "PosSession_status_idx" ON "PosSession"("status");

-- CreateIndex
CREATE INDEX "PosSession_openedAt_idx" ON "PosSession"("openedAt");

-- CreateIndex
CREATE INDEX "PosSession_closedAt_idx" ON "PosSession"("closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PosSession_open_register_unique" ON "PosSession"("registerId") WHERE "status" = 'OPEN';

-- CreateIndex
CREATE UNIQUE INDEX "PosSession_open_user_unique" ON "PosSession"("openedById") WHERE "status" = 'OPEN';

-- AddForeignKey
ALTER TABLE "PosRegister" ADD CONSTRAINT "PosRegister_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosRegister" ADD CONSTRAINT "PosRegister_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "PosRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
