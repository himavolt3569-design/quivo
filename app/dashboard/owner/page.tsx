import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/dashboard/OwnerDashboard";
import { getOwnerContext } from "@/lib/shop";

export default async function OwnerPage() {
  // The owner layout (app/dashboard/owner/layout.tsx) already enforces:
  //   - auth required
  //   - profile exists (else redirect to /auth/revoked)
  //   - profile.role === "owner" (else redirect to /dashboard/home)
  // By the time we render here, those invariants hold. We only need to fetch
  // the owner context and render. No self-healing.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?login=true");
  }

  const ctx = await getOwnerContext();
  const activeShop = ctx.activeShop
    ? {
        id: ctx.activeShop.id,
        slug: ctx.activeShop.slug,
        name: ctx.activeShop.name,
        status: ctx.activeShop.status,
      }
    : null;

  return <OwnerDashboard shop={activeShop} shopCount={ctx.shops.length} />;
}
