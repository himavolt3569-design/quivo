import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { redirect } from "next/navigation";
import { WholesaleView } from "@/components/dashboard/owner/wholesale/WholesaleView";

export default async function WholesalePage() {
  const ctx = await getOwnerContext();
  const activeShop = ctx.activeShop;
  
  if (!activeShop) {
    return <div>Select a shop first.</div>;
  }

  const supabase = await createClient();

  // First, check if the active shop is actually a wholesaler
  const { data: shopData } = await supabase
    .from("shops")
    .select("is_wholesale, wholesale_discount_percent, delivery_radius_km")
    .eq("id", activeShop.id)
    .single();

  if (!shopData?.is_wholesale) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-10 bg-white border border-[#2E3344]/8 rounded-[2rem] shadow-sm text-center space-y-4">
        <h2 className="text-xl font-bold text-[#27324A]">Wholesale Not Enabled</h2>
        <p className="text-[#746E73]">
          Your shop is not currently set up as a Wholesaler. You can enable Wholesale mode 
          in your Shop Settings to start accepting applications from Retailers.
        </p>
      </div>
    );
  }

  // Fetch applications
  const { data: applications, error } = await supabase
    .from("wholesale_applications")
    .select(`
      id,
      status,
      override_discount_percent,
      applied_at,
      retailer_shop_id,
      retailer:shops!retailer_shop_id(name, address)
    `)
    .eq("wholesaler_shop_id", activeShop.id)
    .order("applied_at", { ascending: false });

  if (error) {
    console.error("Error fetching wholesale applications:", error);
  }

  return (
    <WholesaleView 
      shopId={activeShop.id}
      globalDiscount={shopData.wholesale_discount_percent}
      applications={applications || []} 
    />
  );
}
