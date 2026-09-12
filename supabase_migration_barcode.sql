-- Add max_stock to the products table to support inventory management features
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS max_stock INTEGER;
