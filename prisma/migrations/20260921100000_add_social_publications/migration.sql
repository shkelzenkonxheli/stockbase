CREATE TABLE "SocialPublication" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "createdById" INTEGER,
  "variantId" INTEGER,
  "imageUrl" TEXT NOT NULL,
  "caption" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "instagramMediaId" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialPublication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SocialPublication_tenantId_status_scheduledAt_idx" ON "SocialPublication"("tenantId", "status", "scheduledAt");
CREATE INDEX "SocialPublication_status_scheduledAt_idx" ON "SocialPublication"("status", "scheduledAt");
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
