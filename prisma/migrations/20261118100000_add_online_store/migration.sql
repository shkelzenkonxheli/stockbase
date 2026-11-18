CREATE TABLE "OnlineStore" (
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "whatsappNumber" TEXT,
    "warehouseId" INTEGER,
    "categoryIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "productIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlineStore_pkey" PRIMARY KEY ("tenantId"),
    CONSTRAINT "OnlineStore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OnlineStore_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OnlineStore_warehouseId_idx" ON "OnlineStore"("warehouseId");
