import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShopsTab } from "@/components/dashboard/customer/ShopsTab";
import type { DiscoverShop } from "@/components/dashboard/customer/ShopsTab";

export default async function ShopsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/?login=true");

  // Direct SELECT on shops is restricted to shop members by RLS.
  // Use the SECURITY DEFINER RPC which safely exposes only public-safe columns.
  const { data: shops } = await supabase.rpc("get_verified_shops");

  const { data: userShops } = await supabase
    .from("shop_staff")
    .select("shop_id")
    .eq("linked_user_id", user.id)
    .limit(1);

  const retailerShopId = userShops?.[0]?.shop_id ?? null;

  return <ShopsTab shops={(shops ?? []) as DiscoverShop[]} retailerShopId={retailerShopId} />;
}
