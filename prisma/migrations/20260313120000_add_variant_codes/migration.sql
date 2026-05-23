ALTER TABLE "Variant"
ADD COLUMN "sku" TEXT,
ADD COLUMN "barcode" TEXT;

CREATE UNIQUE INDEX "Variant_sku_key" ON "Variant"("sku");
