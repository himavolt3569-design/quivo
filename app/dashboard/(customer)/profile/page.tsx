import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileTab } from "@/components/dashboard/customer/ProfileTab";
import type { Address, Profile } from "@/lib/types";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/?login=true");
  }

  const [
    { data: profile },
    { data: addresses },
    { count: totalOrderCount },
    { count: savedShopCount },
    { count: savedProductCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>(),

    supabase
      .from("addresses")
      .select("*")
      .eq("customer_id", user.id)
      .order("is_default", { ascending: false })
      .returns<Address[]>(),

    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id),

    supabase
      .from("saved_shops")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id),

    supabase
      .from("saved_products")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", user.id),
  ]);

  return (
    <ProfileTab
      user={user}
      profile={profile}
      addresses={addresses ?? []}
      totalOrderCount={totalOrderCount ?? 0}
      savedShopCount={savedShopCount ?? 0}
      savedProductCount={savedProductCount ?? 0}
    />
  );
}
