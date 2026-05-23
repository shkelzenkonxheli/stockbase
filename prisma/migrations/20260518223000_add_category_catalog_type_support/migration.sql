ALTER TABLE "Category"
ADD COLUMN "catalogType" "CatalogType";

UPDATE "Category"
SET "catalogType" = CASE
  WHEN "name" = 'Patika' THEN 'FOOTWEAR'::"CatalogType"
  WHEN "name" = 'Kepuce' THEN 'FOOTWEAR'::"CatalogType"
  WHEN "name" = 'Sandale' THEN 'FOOTWEAR'::"CatalogType"
  WHEN "name" = 'Lini shtepie' THEN 'HOME_GOODS'::"CatalogType"
  WHEN "name" = 'Dekor' THEN 'DECOR'::"CatalogType"
  ELSE 'ELECTRONICS'::"CatalogType"
END;

ALTER TABLE "Category"
ALTER COLUMN "catalogType" SET NOT NULL;

DROP INDEX "Category_name_key";

CREATE UNIQUE INDEX "Category_name_catalogType_key" ON "Category"("name", "catalogType");
CREATE INDEX "Category_catalogType_idx" ON "Category"("catalogType");
