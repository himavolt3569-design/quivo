"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { Menu, ArrowRight, LogOut, User as UserIcon } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navigationItems } from "@/lib/data";
import { ManusDialog } from "@/components/ManusDialog";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface NavbarProps {
  scrollToSection?: (id: string) => void;
}

/**
 * Watches the `?login=true` query param and opens the auth modal.
 *
 * Isolated into its own (render-nothing) component wrapped in <Suspense> so
 * its `useSearchParams()` CSR bailout doesn't gate the whole navbar. Without
 * this, the navbar only renders after client hydration — invisible on slow
 * mobile devices where hydration lags.
 */
function LoginParamWatcher({ onLogin }: { onLogin: () => void }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get("login") === "true") {
      setTimeout(onLogin, 0);
      // Clean up the URL.
      window.history.replaceState({}, "", pathname);
    }
  }, [searchParams, pathname, onLogin]);

  return null;
}

function NavbarContent({ scrollToSection }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);

  useEffect(() => {
    // Create the Supabase browser client here (not during render) so the page
    // can be statically prerendered on the server without the browser-only
    // client throwing on missing env vars at build time.
    const supabase = createClient();

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("avatar_url, full_name")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
    };
    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data } = await supabase
            .from("profiles")
            .select("avatar_url, full_name")
            .eq("id", session.user.id)
            .single();
          setProfile(data);
        } else {
          setProfile(null);
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  function navigateFromMobileMenu(id: string) {
    setMobileMenuOpen(false);
    if (scrollToSection) {
      window.setTimeout(() => scrollToSection(id), 80);
    } else if (pathname !== "/") {
      router.push(`/#${id}`);
    }
  }

  const handleSignOut = async () => {
    const { signOut } = await import("@/app/actions/auth");
    await signOut();
  };

  const handleScrollToSection = (id: string) => {
    if (scrollToSection) {
      scrollToSection(id);
    } else if (pathname !== "/") {
      router.push(`/#${id}`);
    }
  };

  return (
    <>
      <Suspense fallback={null}>
        <LoginParamWatcher onLogin={openAuthModal} />
      </Suspense>
      <ManusDialog
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        title="Quivo Partner Access"
      />
      <header
        suppressHydrationWarning
        className="award-header fixed inset-x-0 top-0 z-50 border-b border-[#2E3344]/8 bg-[#F7F0E6]/85 backdrop-blur-2xl"
      >
        <div className="container flex h-16 items-center justify-between gap-2 sm:h-20 lg:gap-4">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center justify-between gap-2.5 sm:shrink-0 sm:justify-start sm:gap-3"
            aria-label="Quivo home"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#27324A] text-lg font-bold text-white shadow-lg shadow-[#27324A]/18 sm:h-11 sm:w-11">
              Q
            </span>
            <span className="leading-none">
              <span className="block text-xl font-bold tracking-[-0.02em] text-[#27324A]">
                Quivo
              </span>
              <span className="block max-w-[8.75rem] truncate text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-[#7A7378] sm:max-w-none sm:text-[0.67rem] sm:tracking-[0.16em]">
                Quick Inventory OS
              </span>
            </span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 lg:flex"
          >
            {navigationItems.map(([label, id]) => (
              <button
                key={id}
                type="button"
                onClick={() => handleScrollToSection(id)}
                className="text-sm font-medium text-[#2E3344]/70 transition hover:text-[#A7653A] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4 focus:ring-offset-[#F7F0E6]"
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={() => handleScrollToSection("orders")}
              className="rounded-full border border-[#2E3344]/12 bg-white px-5 py-3 text-sm font-semibold text-[#27324A] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A7653A]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4"
            >
              Scan barcode
            </button>
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 rounded-full bg-[#27324A] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#27324A]/25 transition hover:-translate-y-0.5 hover:bg-[#1B2030] focus:outline-none focus:ring-2 focus:ring-[#27324A] focus:ring-offset-4"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="h-5 w-5 rounded-full object-cover ring-1 ring-white/20"
                    />
                  ) : (
                    <UserIcon className="h-4 w-4" />
                  )}
                  Dashboard
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-full border border-[#2E3344]/12 bg-white p-3 text-[#27324A] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A7653A]/40 hover:text-[#A7653A] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="rounded-full bg-[#A7653A] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#A7653A]/25 transition hover:-translate-y-0.5 hover:bg-[#8E5432] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4"
              >
                Login / Sign up
              </button>
            )}
          </div>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#2E3344]/12 bg-white text-[#27324A] shadow-sm ring-1 ring-[#27324A]/5 lg:hidden"
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation-menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="max-h-dvh w-[min(92vw,24rem)] overflow-y-auto border-[#2E3344]/10 bg-[#F7F0E6] px-0 pt-2 text-[#27324A] sm:max-w-sm"
            >
              <SheetHeader className="border-b border-[#2E3344]/8 px-6 pb-5 pt-6 text-left">
                <SheetTitle className="flex items-center gap-3 text-[#27324A]">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#27324A] font-bold text-white">
                    Q
                  </span>
                  Quivo menu
                </SheetTitle>
                <SheetDescription className="text-[#746E73]">
                  Jump to the product section you want to review.
                </SheetDescription>
              </SheetHeader>
              <div id="mobile-navigation-menu" className="grid gap-2 px-4 py-5">
                {navigationItems.map(([label, id]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigateFromMobileMenu(id)}
                    className="flex min-h-12 items-center justify-between rounded-2xl bg-white px-4 text-left text-base font-semibold text-[#27324A] shadow-sm transition hover:bg-[#FFFBF4] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2 focus:ring-offset-[#F7F0E6]"
                  >
                    {label}
                    <ArrowRight
                      className="h-4 w-4 text-[#A7653A]"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
              <div className="mt-auto grid gap-3 border-t border-[#2E3344]/8 px-4 py-5">
                <SheetClose asChild>
                  <button
                    onClick={() => {
                      if (scrollToSection) {
                        window.setTimeout(() => scrollToSection("orders"), 80);
                      } else {
                        router.push("/#orders");
                      }
                    }}
                    className="min-h-12 rounded-full border border-[#2E3344]/12 bg-white px-5 text-sm font-semibold text-[#27324A]"
                  >
                    Scan barcode
                  </button>
                </SheetClose>
                {user ? (
                  <>
                    <SheetClose asChild>
                      <Link
                        href="/dashboard"
                        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#27324A] px-5 text-sm font-semibold text-white shadow-lg shadow-[#27324A]/20"
                      >
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt="Profile"
                            className="h-5 w-5 rounded-full object-cover ring-1 ring-white/20"
                          />
                        ) : (
                          <UserIcon className="h-4 w-4" />
                        )}
                        Dashboard
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <button
                        onClick={handleSignOut}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#2E3344]/12 bg-white px-5 text-sm font-semibold text-[#27324A]"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </SheetClose>
                  </>
                ) : (
                  <SheetClose asChild>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setAuthModalOpen(true);
                      }}
                      className="min-h-12 rounded-full bg-[#A7653A] px-5 text-sm font-semibold text-white shadow-lg shadow-[#A7653A]/20"
                    >
                      Login / Sign up
                    </button>
                  </SheetClose>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </>
  );
}

export function Navbar(props: NavbarProps) {
  // NavbarContent no longer suspends (its useSearchParams usage moved into
  // the isolated LoginParamWatcher), so the navbar prerenders as static HTML
  // and is visible immediately — no longer waiting on client hydration.
  return <NavbarContent {...props} />;
}
