import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileTab } from "@/components/dashboard/customer/ProfileTab";
import type { Address, Profile } from "@/lib/types";
import { log } from "@/lib/log";

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
    { data: profile, error: profileError },
    { data: addresses, error: addressesError },
    { count: totalOrderCount, error: totalCountError },
    { count: savedShopCount, error: shopsCountError },
    { count: savedProductCount, error: productsCountError },
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

  const errors = [
    profileError,
    addressesError,
    totalCountError,
    shopsCountError,
    productsCountError,
  ].filter(Boolean);

  if (errors.length > 0) {
    log.error("customer/profile: database query failures", { errors });
    throw new Error("Failed to load profile data. Please try again later.");
  }

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
