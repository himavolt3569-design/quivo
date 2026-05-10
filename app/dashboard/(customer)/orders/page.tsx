import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OrdersTab } from "@/components/dashboard/customer/OrdersTab";
import type { Order } from "@/lib/types";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/?login=true");
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<Order[]>();

  return <OrdersTab userId={user.id} initialOrders={orders ?? []} />;
}
