ALTER TABLE "Category"
ADD COLUMN "tenantId" INTEGER,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "config" JSONB;

DROP INDEX IF EXISTS "Category_name_catalogType_key";
CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "Category"("tenantId", "name");
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");

ALTER TABLE "Category"
ADD CONSTRAINT "Category_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
