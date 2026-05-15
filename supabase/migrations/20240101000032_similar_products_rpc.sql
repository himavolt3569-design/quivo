-- ─── get_similar_products RPC ────────────────────────────────────────────────
-- Powers the "More like this" carousel on the public product page
-- (/s/[slug]/product/[barcode]).  Returns up to p_limit other products from
-- the SAME shop, scored by similarity to the source product:
--   * same category → +2
--   * same brand    → +1
-- Excludes the source product itself, archived/draft products, and items
-- with zero stock.  Tied scores are broken by `created_at DESC` so newer
-- products surface first.
--
-- Anon-safe: same exposure surface as get_product_by_barcode.

CREATE OR REPLACE FUNCTION public.get_similar_products(
  p_product_id UUID,
  p_limit      INTEGER DEFAULT 8
) RETURNS TABLE (
  product_id  UUID,
  shop_id     UUID,
  shop_slug   TEXT,
  name        TEXT,
  brand       TEXT,
  category    TEXT,
  unit        TEXT,
  variant     TEXT,
  price       NUMERIC,
  stock       NUMERIC,
  image_url   TEXT,
  images      TEXT[],
  barcode     TEXT,
  match_score INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH src AS (
    SELECT p.shop_id, p.category, p.brand
    FROM   public.products p
    WHERE  p.id = p_product_id
    LIMIT  1
  )
  SELECT
    p.id, p.shop_id, s.slug,
    p.name, p.brand, p.category, p.unit, p.variant,
    p.price, p.stock, p.image_url, p.images, p.barcode,
    ( CASE WHEN p.category IS NOT NULL AND p.category = src.category THEN 2 ELSE 0 END
    + CASE WHEN p.brand    IS NOT NULL AND p.brand    = src.brand    THEN 1 ELSE 0 END
    ) AS match_score
  FROM       public.products p
  CROSS JOIN src
  JOIN       public.shops s ON s.id = p.shop_id
  WHERE  p.shop_id = src.shop_id
    AND  p.id     <> p_product_id
    AND  p.status = 'active'
    AND  p.stock  > 0
    AND  (p.category = src.category OR p.brand = src.brand)
  ORDER BY  match_score DESC, p.created_at DESC
  LIMIT     GREATEST(1, LEAST(p_limit, 24));
$$;

REVOKE EXECUTE ON FUNCTION public.get_similar_products(UUID, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_similar_products(UUID, INTEGER) TO anon, authenticated;
