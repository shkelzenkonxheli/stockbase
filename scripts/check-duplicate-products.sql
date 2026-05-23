SELECT min(brand) AS brand,
       min(name) AS model,
       array_agg(id ORDER BY id) AS product_ids,
       count(*) AS cnt
FROM "Product"
GROUP BY lower(trim(brand)), lower(trim(name))
HAVING count(*) > 1
ORDER BY brand, model;
