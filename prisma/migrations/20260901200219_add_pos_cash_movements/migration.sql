-- CreateEnum
CREATE TYPE "PosCashMovementType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- CreateTable
CREATE TABLE "PosCashMovement" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "posSessionId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "type" "PosCashMovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosCashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PosCashMovement_tenantId_idx" ON "PosCashMovement"("tenantId");

-- CreateIndex
CREATE INDEX "PosCashMovement_posSessionId_idx" ON "PosCashMovement"("posSessionId");

-- CreateIndex
CREATE INDEX "PosCashMovement_createdById_idx" ON "PosCashMovement"("createdById");

-- CreateIndex
CREATE INDEX "PosCashMovement_type_idx" ON "PosCashMovement"("type");

-- CreateIndex
CREATE INDEX "PosCashMovement_createdAt_idx" ON "PosCashMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "PosCashMovement" ADD CONSTRAINT "PosCashMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCashMovement" ADD CONSTRAINT "PosCashMovement_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "PosSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCashMovement" ADD CONSTRAINT "PosCashMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
