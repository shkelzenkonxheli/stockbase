WITH duplicate_products AS (
  SELECT lower(trim(brand)) AS brand_key,
         lower(trim(name)) AS name_key,
         array_agg(id ORDER BY id) AS product_ids,
         count(*) AS product_count,
         min(brand) AS brand_display,
         min(name) AS name_display
  FROM "Product"
  GROUP BY lower(trim(brand)), lower(trim(name))
  HAVING count(*) > 1
),
product_variant_stats AS (
  SELECT dp.brand_key,
         dp.name_key,
         p.id AS product_id,
         count(v.id) AS variant_count
  FROM duplicate_products dp
  JOIN "Product" p
    ON lower(trim(p.brand)) = dp.brand_key
   AND lower(trim(p.name)) = dp.name_key
  LEFT JOIN "Variant" v ON v."productId" = p.id
  GROUP BY dp.brand_key, dp.name_key, p.id
),
variant_conflicts AS (
  SELECT dp.brand_key,
         dp.name_key,
         lower(trim(v.size)) AS size_key,
         lower(trim(v.color)) AS color_key,
         min(v.size) AS size_display,
         min(v.color) AS color_display,
         count(*) AS duplicate_variants,
         array_agg(
           format('product:%s variant:%s stock:%s orders:%s items:%s moves:%s',
             p.id,
             v.id,
             v.stock,
             (SELECT count(*) FROM "Order" o WHERE o."variantId" = v.id),
             (SELECT count(*) FROM "OrderItem" oi WHERE oi."variantId" = v.id),
             (SELECT count(*) FROM "StockMovement" sm WHERE sm."variantId" = v.id)
           )
           ORDER BY p.id, v.id
         ) AS entries
  FROM duplicate_products dp
  JOIN "Product" p
    ON lower(trim(p.brand)) = dp.brand_key
   AND lower(trim(p.name)) = dp.name_key
  JOIN "Variant" v ON v."productId" = p.id
  GROUP BY dp.brand_key, dp.name_key, lower(trim(v.size)), lower(trim(v.color))
  HAVING count(*) > 1
)
SELECT dp.brand_display AS brand,
       dp.name_display AS model,
       dp.product_ids,
       dp.product_count,
       (SELECT string_agg(format('%s(%s variante)', pvs.product_id, pvs.variant_count), ', ' ORDER BY pvs.product_id)
          FROM product_variant_stats pvs
         WHERE pvs.brand_key = dp.brand_key AND pvs.name_key = dp.name_key) AS per_product,
       CASE WHEN EXISTS (
         SELECT 1 FROM variant_conflicts vc
         WHERE vc.brand_key = dp.brand_key AND vc.name_key = dp.name_key
       ) THEN 'HAS_CONFLICTS' ELSE 'MERGEABLE' END AS status,
       COALESCE(
         (SELECT string_agg(
             format('%s/%s -> %s', vc.size_display, vc.color_display, array_to_string(vc.entries, ' | ')),
             E'\n' ORDER BY vc.color_display, vc.size_display
           )
          FROM variant_conflicts vc
          WHERE vc.brand_key = dp.brand_key AND vc.name_key = dp.name_key),
         ''
       ) AS conflicts
FROM duplicate_products dp
ORDER BY brand, model;
