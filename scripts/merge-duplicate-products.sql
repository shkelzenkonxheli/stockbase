BEGIN;

CREATE OR REPLACE FUNCTION merge_duplicate_products(
  target_product_id integer,
  source_product_ids integer[]
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  source_product_id integer;
  conflicting_variant RECORD;
BEGIN
  FOREACH source_product_id IN ARRAY source_product_ids
  LOOP
    FOR conflicting_variant IN
      SELECT
        sv.id AS source_variant_id,
        tv.id AS target_variant_id,
        sv.stock,
        sv."imagePath",
        sv.sku,
        sv.barcode,
        (SELECT count(*) FROM "Order" o WHERE o."variantId" = sv.id) AS order_count,
        (SELECT count(*) FROM "OrderItem" oi WHERE oi."variantId" = sv.id) AS item_count,
        (SELECT count(*) FROM "StockMovement" sm WHERE sm."variantId" = sv.id) AS movement_count
      FROM "Variant" sv
      JOIN "Variant" tv
        ON tv."productId" = target_product_id
       AND lower(trim(tv.size)) = lower(trim(sv.size))
       AND lower(trim(tv.color)) = lower(trim(sv.color))
      WHERE sv."productId" = source_product_id
    LOOP
      IF conflicting_variant.order_count > 0
        OR conflicting_variant.item_count > 0
        OR conflicting_variant.movement_count > 0 THEN
        RAISE EXCEPTION
          'Cannot merge variant % because it has linked history (orders %, items %, movements %)',
          conflicting_variant.source_variant_id,
          conflicting_variant.order_count,
          conflicting_variant.item_count,
          conflicting_variant.movement_count;
      END IF;

      DELETE FROM "Variant"
      WHERE id = conflicting_variant.source_variant_id;

      UPDATE "Variant"
      SET
        stock = stock + conflicting_variant.stock,
        "imagePath" = COALESCE("imagePath", conflicting_variant."imagePath"),
        sku = COALESCE(sku, conflicting_variant.sku),
        barcode = COALESCE(barcode, conflicting_variant.barcode)
      WHERE id = conflicting_variant.target_variant_id;
    END LOOP;

    UPDATE "Variant"
    SET "productId" = target_product_id
    WHERE "productId" = source_product_id;

    IF EXISTS (
      SELECT 1
      FROM "Variant"
      WHERE "productId" = source_product_id
    ) THEN
      RAISE EXCEPTION 'Source product % still has variants after merge', source_product_id;
    END IF;

    DELETE FROM "Product"
    WHERE id = source_product_id;
  END LOOP;
END;
$$;

SELECT merge_duplicate_products(61, ARRAY[70, 89]);
SELECT merge_duplicate_products(62, ARRAY[65, 74]);
SELECT merge_duplicate_products(16, ARRAY[17]);
SELECT merge_duplicate_products(20, ARRAY[21]);
SELECT merge_duplicate_products(80, ARRAY[82, 83, 87]);
SELECT merge_duplicate_products(23, ARRAY[28, 67, 103, 104]);
SELECT merge_duplicate_products(35, ARRAY[107]);
SELECT merge_duplicate_products(58, ARRAY[100, 109]);

DROP FUNCTION merge_duplicate_products(integer, integer[]);

COMMIT;
