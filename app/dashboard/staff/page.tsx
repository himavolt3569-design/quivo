import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  StaffShiftsView,
  type StaffShiftRow,
} from "@/components/dashboard/staff/StaffShiftsView";

export default async function StaffDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?login=true");

  const [{ data: profile }, { data: shifts }, { data: linkedStaff }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.rpc("get_my_shifts", { p_limit: 30 }),
      supabase.from("shop_staff").select("id").eq("linked_user_id", user.id),
    ]);

  const userName = profile?.full_name ?? user.email ?? "Staff";
  const staffIds = (linkedStaff ?? []).map((s) => s.id);

  return (
    <StaffShiftsView
      initialShifts={(shifts ?? []) as StaffShiftRow[]}
      userName={userName}
      staffIds={staffIds}
    />
  );
}
