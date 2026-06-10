import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { AuditView } from "@/components/dashboard/owner/settings/AuditView";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const ctx = await getOwnerContext();
  const activeShop = ctx.activeShop;

  if (!activeShop) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-lg font-bold text-[#27324A]">No shop selected.</p>
        <Link
          href="/onboarding/owner"
          className="text-sm text-[#A7653A] hover:underline font-bold"
        >
          Create your first shop →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: paymentRows }, { data: securityRows }] = await Promise.all([
    supabase
      .from("v_payment_audit_logs_shop")
      .select(
        "id, payment_id, shop_id, action, actor_type, from_status, to_status, metadata, created_at, actor_full_name, actor_email",
      )
      .eq("shop_id", activeShop.id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("v_security_events_user")
      .select("id, event_type, metadata, ip_hash, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  return (
    <AuditView
      shopId={activeShop.id}
      shopName={activeShop.name}
      paymentRows={paymentRows ?? []}
      securityRows={securityRows ?? []}
    />
  );
}
