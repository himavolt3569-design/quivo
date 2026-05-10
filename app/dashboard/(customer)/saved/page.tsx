import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SavedItems } from "@/components/dashboard/customer/SavedItems";
import type { SavedShop, SavedProduct } from "@/lib/types";

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/?login=true");
  }

  const [{ data: savedShops }, { data: savedProducts }] = await Promise.all([
    supabase
      .from("saved_shops")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .returns<SavedShop[]>(),

    supabase
      .from("saved_products")
      .select("*")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .returns<SavedProduct[]>(),
  ]);

  return (
    <SavedItems
      savedShops={savedShops ?? []}
      savedProducts={savedProducts ?? []}
    />
  );
}
