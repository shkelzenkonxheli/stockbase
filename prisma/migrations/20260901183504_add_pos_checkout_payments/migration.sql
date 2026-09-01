-- CreateEnum
CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH', 'CARD');

-- AlterEnum
ALTER TYPE "StockMovementReason" ADD VALUE 'POS_SALE';

-- CreateTable
CREATE TABLE "PosPayment" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "posSessionId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "method" "PosPaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PosPayment_tenantId_idx" ON "PosPayment"("tenantId");

-- CreateIndex
CREATE INDEX "PosPayment_posSessionId_idx" ON "PosPayment"("posSessionId");

-- CreateIndex
CREATE INDEX "PosPayment_orderId_idx" ON "PosPayment"("orderId");

-- CreateIndex
CREATE INDEX "PosPayment_method_idx" ON "PosPayment"("method");

-- CreateIndex
CREATE INDEX "PosPayment_createdAt_idx" ON "PosPayment"("createdAt");

-- AddForeignKey
ALTER TABLE "PosPayment" ADD CONSTRAINT "PosPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosPayment" ADD CONSTRAINT "PosPayment_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "PosSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosPayment" ADD CONSTRAINT "PosPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
