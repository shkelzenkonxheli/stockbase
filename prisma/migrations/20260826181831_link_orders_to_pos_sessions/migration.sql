-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "posSessionId" INTEGER;

-- CreateIndex
CREATE INDEX "Order_posSessionId_idx" ON "Order"("posSessionId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "PosSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
