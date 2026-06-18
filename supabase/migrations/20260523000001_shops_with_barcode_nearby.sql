-- Cross-shop barcode discovery.
--
-- The landing page promises a "scan a product → see which nearby shops carry
-- it in stock → pick one → order" experience, but the only barcode lookup we
-- had was get_product_by_barcode(...) LIMIT 1, which drops the customer into a
-- single arbitrary shop. This RPC powers the real flow used by the in-app
-- scanner results step and the shareable /find/[barcode] page.
--
-- Given a scanned barcode and (optionally) the customer's coordinates, it
-- returns every ACTIVE shop that stocks that barcode IN STOCK, with price,
-- stock and (when coords are supplied) the great-circle distance in km.
--
--   p_lat / p_lng NULL  → distance_km is NULL; results ordered by stock, name.
--   p_radius_km   NULL  → no distance cap ("entire Nepal"); otherwise, when
--                         coords are supplied, only shops within the radius are
--                         returned (shops without coordinates are excluded once
--                         a radius cap is active, since they can't be confirmed
--                         to be inside it).
--
-- verification_status is returned so the UI can badge trusted shops without
-- hiding active ones (consistent with the product page, which resolves any
-- active shop regardless of verification).

CREATE OR REPLACE FUNCTION public.get_shops_with_barcode_nearby(
  p_barcode    TEXT,
  p_lat        DOUBLE PRECISION DEFAULT NULL,
  p_lng        DOUBLE PRECISION DEFAULT NULL,
  p_radius_km  DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
  product_id          UUID,
  shop_id             UUID,
  shop_slug           TEXT,
  shop_name           TEXT,
  shop_logo_url       TEXT,
  shop_category       TEXT,
  shop_address        TEXT,
  shop_lat            DOUBLE PRECISION,
  shop_lng            DOUBLE PRECISION,
  verification_status TEXT,
  name                TEXT,
  brand               TEXT,
  unit                TEXT,
  variant             TEXT,
  price               NUMERIC,
  stock               NUMERIC,
  image_url           TEXT,
  images              TEXT[],
  barcode             TEXT,
  distance_km         DOUBLE PRECISION
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id,
    s.id,
    s.slug,
    s.name,
    s.logo_url,
    s.category,
    s.address,
    s.lat,
    s.lng,
    s.verification_status,
    p.name,
    p.brand,
    p.unit,
    p.variant,
    p.price,
    p.stock,
    p.image_url,
    p.images,
    p.barcode,
    CASE
      WHEN p_lat IS NULL OR p_lng IS NULL OR s.lat IS NULL OR s.lng IS NULL
        THEN NULL
      ELSE 6371 * 2 * asin(sqrt(
        power(sin(radians(s.lat - p_lat) / 2), 2) +
        cos(radians(p_lat)) * cos(radians(s.lat)) *
        power(sin(radians(s.lng - p_lng) / 2), 2)
      ))
    END AS distance_km
  FROM products p
  JOIN shops s ON s.id = p.shop_id
  WHERE p.barcode  = p_barcode
    AND p.status   = 'active'
    AND s.status   = 'active'
    AND COALESCE(p.stock, 0) > 0
    AND (
      -- A radius cap only applies when the customer's coordinates are known.
      p_lat IS NULL OR p_lng IS NULL OR p_radius_km IS NULL
      OR (
        s.lat IS NOT NULL AND s.lng IS NOT NULL
        AND 6371 * 2 * asin(sqrt(
              power(sin(radians(s.lat - p_lat) / 2), 2) +
              cos(radians(p_lat)) * cos(radians(s.lat)) *
              power(sin(radians(s.lng - p_lng) / 2), 2)
            )) <= p_radius_km
      )
    )
  ORDER BY distance_km ASC NULLS LAST, p.stock DESC, s.name ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_shops_with_barcode_nearby(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_shops_with_barcode_nearby(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
