import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SavedItems } from "@/components/dashboard/customer/SavedItems";
import type { SavedShop, SavedProduct } from "@/lib/types";
import { log } from "@/lib/log";

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/?login=true");
  }

  const [
    { data: savedShops, error: shopsError },
    { data: savedProducts, error: productsError },
  ] = await Promise.all([
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

  if (shopsError || productsError) {
    log.error("customer/saved: database query failures", {
      shopsError,
      productsError,
    });
    throw new Error("Failed to load saved items. Please try again later.");
  }

  return (
    <SavedItems
      savedShops={savedShops ?? []}
      savedProducts={savedProducts ?? []}
    />
  );
}
