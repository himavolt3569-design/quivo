-- Enable RLS on all tables
-- This script sets up a secure foundation for Quivo's database.

-- 1. Create a profiles table linked to Supabase's auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT valid_role CHECK (role IN ('customer', 'owner'))
);

-- 2. Enable Row Level Security (RLS) on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for the profiles table

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- 4. Create a trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  -- If signed up via Google, automatically assign 'owner' role.
  -- Otherwise, use the role from user_metadata (defaulting to 'customer').
  IF new.raw_app_meta_data->>'provider' = 'google' THEN
    assigned_role := 'owner';
  ELSE
    assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'customer');
  END IF;

  -- Ensure role is valid
  IF assigned_role NOT IN ('customer', 'owner') THEN
    assigned_role := 'customer';
  END IF;

  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, assigned_role);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. (Future) Example: Secure a 'shops' table
-- CREATE TABLE public.shops (
--     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--     owner_id UUID REFERENCES auth.users(id) NOT NULL,
--     name TEXT NOT NULL
-- );
-- ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Shop owners can manage their shops" ON public.shops
--     FOR ALL USING (auth.uid() = owner_id);

-- 6. (Future) Example: Secure an 'orders' table
-- CREATE TABLE public.orders (
--     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--     shop_id UUID REFERENCES public.shops(id) NOT NULL,
--     total_amount NUMERIC NOT NULL
-- );
-- ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Shop owners can view their orders" ON public.orders
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM public.shops 
--             WHERE shops.id = orders.shop_id 
--             AND shops.owner_id = auth.uid()
--         )
--     );
