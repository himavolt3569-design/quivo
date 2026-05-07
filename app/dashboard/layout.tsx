import { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?login=true");
  }

  return (
    <div className="min-h-screen bg-[#f8f8f7] font-[Poppins]">
      <header className="sticky top-0 z-40 border-b border-[#2E3344]/8 bg-[#F7F0E6]/85 backdrop-blur-2xl">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#27324A] text-sm font-bold text-white shadow-sm">
              Q
            </span>
            <span className="text-lg font-bold tracking-[-0.02em] text-[#27324A]">
              Quivo
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-[#746E73] hidden sm:inline-block">
              {user.email}
            </span>
            <Link 
              href="/" 
              className="text-sm font-medium text-[#A7653A] hover:underline"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>
      <main className="container px-4 py-8 sm:px-6 lg:py-12">
        {children}
      </main>
    </div>
  );
}
