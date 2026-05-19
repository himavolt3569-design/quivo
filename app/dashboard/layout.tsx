import { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { FontProvider } from "@/components/FontProvider";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import type { Profile } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // redirect("/?login=true");
  }

  const { data: profile } = user ? await supabase
    .from("profiles")
    .select("full_name, avatar_url, font_size, owner_font_size")
    .eq("id", user.id)
    .single<Pick<Profile, "full_name" | "avatar_url" | "font_size" | "owner_font_size">>() : { data: null };

  const { data: notifications } = user
    ? await supabase
        .from("notifications")
        .select("id, kind, title, body, link_url, data, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: null };

  return (
    <FontProvider 
      initialCustomerFontSize={profile?.font_size ?? "standard"}
      initialOwnerFontSize={profile?.owner_font_size ?? "standard"}
    >
      <div className="min-h-screen bg-[#f8f8f7] font-[Poppins]">
        <header className="sticky top-0 z-40 border-b border-[#2E3344]/8 bg-[#F7F0E6]/85 backdrop-blur-2xl">
          <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#27324A] text-sm font-bold text-white shadow-sm transition-transform duration-300 group-hover:scale-105">
                Q
              </span>
              <span className="text-lg font-bold tracking-[-0.02em] text-[#27324A]">
                Quivo
              </span>
            </Link>
            <div className="flex items-center gap-4">
              {user && <NotificationBell initial={notifications ?? []} />}
              <div className="flex items-center gap-3">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="h-8 w-8 rounded-full object-cover border border-[#2E3344]/10" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#27324A] flex items-center justify-center text-white text-xs font-bold">
                    {(profile?.full_name ?? user?.email ?? "U")[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden text-sm font-medium text-[#746E73] sm:inline-block">
                  {profile?.full_name ?? user?.email}
                </span>
              </div>
              <div className="h-6 w-px bg-[#2E3344]/10" />
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#A7653A] hover:underline"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </header>
        {children}
      </div>
    </FontProvider>
  );
}
