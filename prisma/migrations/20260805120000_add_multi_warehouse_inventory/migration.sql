CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VariantInventory" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "locationCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantInventory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockMovement" ADD COLUMN "warehouseId" INTEGER;
ALTER TABLE "Order" ADD COLUMN "warehouseId" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "warehouseId" INTEGER;

CREATE UNIQUE INDEX "Warehouse_tenantId_slug_key" ON "Warehouse"("tenantId", "slug");
CREATE UNIQUE INDEX "Warehouse_tenantId_name_key" ON "Warehouse"("tenantId", "name");
CREATE INDEX "Warehouse_tenantId_idx" ON "Warehouse"("tenantId");
CREATE INDEX "Warehouse_isActive_idx" ON "Warehouse"("isActive");

CREATE UNIQUE INDEX "VariantInventory_variantId_warehouseId_key" ON "VariantInventory"("variantId", "warehouseId");
CREATE INDEX "VariantInventory_warehouseId_idx" ON "VariantInventory"("warehouseId");
CREATE INDEX "VariantInventory_stock_idx" ON "VariantInventory"("stock");

CREATE INDEX "StockMovement_warehouseId_idx" ON "StockMovement"("warehouseId");
CREATE INDEX "Order_warehouseId_idx" ON "Order"("warehouseId");
CREATE INDEX "OrderItem_warehouseId_idx" ON "OrderItem"("warehouseId");

ALTER TABLE "Warehouse"
ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariantInventory"
ADD CONSTRAINT "VariantInventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariantInventory"
ADD CONSTRAINT "VariantInventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockMovement"
ADD CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Warehouse" ("tenantId", "name", "slug", "isActive")
SELECT DISTINCT
  p."tenantId",
  COALESCE(NULLIF(TRIM(p."warehouseName"), ''), 'Depo 1') AS "name",
  LOWER(REPLACE(REPLACE(COALESCE(NULLIF(TRIM(p."warehouseName"), ''), 'Depo 1'), ' ', '-'), '/', '-')) AS "slug",
  true AS "isActive"
FROM "Product" p
WHERE p."tenantId" IS NOT NULL
ON CONFLICT ("tenantId", "name") DO NOTHING;

INSERT INTO "Warehouse" ("tenantId", "name", "slug", "isActive")
SELECT
  t."id",
  'Depo 1',
  'depo-1',
  true
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1
  FROM "Warehouse" w
  WHERE w."tenantId" = t."id"
)
ON CONFLICT ("tenantId", "name") DO NOTHING;

INSERT INTO "VariantInventory" ("variantId", "warehouseId", "stock", "locationCode")
SELECT
  v."id",
  w."id",
  v."stock",
  v."locationCode"
FROM "Variant" v
INNER JOIN "Product" p ON p."id" = v."productId"
INNER JOIN "Warehouse" w
  ON w."tenantId" = v."tenantId"
 AND w."name" = COALESCE(NULLIF(TRIM(p."warehouseName"), ''), 'Depo 1')
WHERE NOT EXISTS (
  SELECT 1
  FROM "VariantInventory" vi
  WHERE vi."variantId" = v."id"
    AND vi."warehouseId" = w."id"
);
