ALTER TABLE "Product"
ADD COLUMN "warehouseName" TEXT;

CREATE INDEX "Product_warehouseName_idx" ON "Product"("warehouseName");
