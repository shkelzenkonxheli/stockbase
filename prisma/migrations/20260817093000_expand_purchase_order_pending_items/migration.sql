ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "variantId" DROP NOT NULL;

ALTER TABLE "PurchaseOrderItem"
ADD COLUMN "pendingProductName" TEXT,
ADD COLUMN "pendingBrand" TEXT,
ADD COLUMN "pendingCategoryName" TEXT,
ADD COLUMN "pendingColor" TEXT,
ADD COLUMN "pendingSize" TEXT,
ADD COLUMN "pendingMaterial" TEXT,
ADD COLUMN "pendingPowerWatts" TEXT,
ADD COLUMN "pendingVariantIdentityKey" TEXT;
