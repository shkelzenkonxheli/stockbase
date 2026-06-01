ALTER TABLE "OrderItem"
ADD COLUMN "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "OrderItem" oi
SET "unitPrice" = v."price"
FROM "Variant" v
WHERE oi."variantId" = v."id";
