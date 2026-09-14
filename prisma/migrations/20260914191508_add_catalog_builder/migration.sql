-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('DRAFT', 'ACTIVE');

-- CreateEnum
CREATE TYPE "CatalogLayout" AS ENUM ('TWO_COLUMNS', 'THREE_COLUMNS', 'FOUR_COLUMNS');

-- CreateEnum
CREATE TYPE "CatalogStyle" AS ENUM ('MINIMAL', 'PREMIUM', 'WHOLESALE');

-- CreateEnum
CREATE TYPE "CatalogPriceMode" AS ENUM ('RETAIL', 'WHOLESALE', 'HIDE');

-- CreateEnum
CREATE TYPE "CatalogStockMode" AS ENUM ('HIDE', 'EXACT', 'AVAILABILITY');

-- CreateTable
CREATE TABLE "Catalog" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "layout" "CatalogLayout" NOT NULL DEFAULT 'THREE_COLUMNS',
    "style" "CatalogStyle" NOT NULL DEFAULT 'MINIMAL',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicSlug" TEXT,
    "priceMode" "CatalogPriceMode" NOT NULL DEFAULT 'RETAIL',
    "stockMode" "CatalogStockMode" NOT NULL DEFAULT 'HIDE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" SERIAL NOT NULL,
    "catalogId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogField" (
    "id" SERIAL NOT NULL,
    "catalogId" INTEGER NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CatalogField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Catalog_publicSlug_key" ON "Catalog"("publicSlug");

-- CreateIndex
CREATE INDEX "Catalog_tenantId_idx" ON "Catalog"("tenantId");

-- CreateIndex
CREATE INDEX "Catalog_tenantId_status_idx" ON "Catalog"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Catalog_tenantId_updatedAt_idx" ON "Catalog"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "CatalogProduct_catalogId_sortOrder_idx" ON "CatalogProduct"("catalogId", "sortOrder");

-- CreateIndex
CREATE INDEX "CatalogProduct_productId_idx" ON "CatalogProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProduct_catalogId_productId_key" ON "CatalogProduct"("catalogId", "productId");

-- CreateIndex
CREATE INDEX "CatalogField_catalogId_sortOrder_idx" ON "CatalogField"("catalogId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogField_catalogId_fieldKey_key" ON "CatalogField"("catalogId", "fieldKey");

-- AddForeignKey
ALTER TABLE "Catalog" ADD CONSTRAINT "Catalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogField" ADD CONSTRAINT "CatalogField_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
