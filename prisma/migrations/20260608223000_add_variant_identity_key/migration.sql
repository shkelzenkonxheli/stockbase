ALTER TABLE "Variant"
ADD COLUMN "variantIdentityKey" TEXT;

WITH ranked_variants AS (
  SELECT
    id,
    "productId",
    concat_ws(
      '::',
      lower(trim(coalesce(color, ''))),
      lower(trim(coalesce(size, ''))),
      lower(trim(coalesce(material, ''))),
      lower(trim(coalesce("powerWatts", '')))
    ) AS base_key,
    row_number() OVER (
      PARTITION BY
        "productId",
        concat_ws(
          '::',
          lower(trim(coalesce(color, ''))),
          lower(trim(coalesce(size, ''))),
          lower(trim(coalesce(material, ''))),
          lower(trim(coalesce("powerWatts", '')))
        )
      ORDER BY id
    ) AS duplicate_rank
  FROM "Variant"
)
UPDATE "Variant" AS variant
SET "variantIdentityKey" = CASE
  WHEN ranked_variants.duplicate_rank = 1 THEN ranked_variants.base_key
  ELSE ranked_variants.base_key || '__legacy__' || ranked_variants.id
END
FROM ranked_variants
WHERE variant.id = ranked_variants.id;

CREATE UNIQUE INDEX "Variant_productId_variantIdentityKey_key"
ON "Variant"("productId", "variantIdentityKey");
