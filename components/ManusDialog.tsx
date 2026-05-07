"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { loginWithEmail, signUpWithEmail, signInWithGoogle } from "@/app/actions/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuthDialogProps {
  title?: string;
  logo?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export function ManusDialog({
  title,
  logo,
  open = false,
  onOpenChange,
  onClose,
}: AuthDialogProps) {
  const [internalOpen, setInternalOpen] = useState(open);
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<"customer" | "owner">("customer");
  const router = useRouter();

  useEffect(() => {
    if (!onOpenChange) {
      setInternalOpen(open);
    }
  }, [open, onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      onClose?.();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.append("role", role);
    
    try {
      if (isLogin) {
        const result = await loginWithEmail(formData);
        if (result?.error) {
          toast.error(result.error);
        } else if (result?.success) {
          toast.success("Successfully logged in");
          handleOpenChange(false);
          if (result.redirectUrl) {
            router.push(result.redirectUrl);
            router.refresh();
          }
        }
      } else {
        const result = await signUpWithEmail(formData);
        if (result?.error) {
          toast.error(result.error);
        } else if (result?.success) {
          toast.success(result.success);
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });

      if (error) {
        toast.error(error.message);
        setIsLoading(false);
      }
    } catch (error) {
      toast.error("Failed to sign in with Google");
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={onOpenChange ? open : internalOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="sm:max-w-[400px] bg-[#f8f8f7] rounded-[20px] shadow-[0px_4px_11px_0px_rgba(0,0,0,0.08)] border border-[rgba(0,0,0,0.08)] backdrop-blur-2xl">
        <DialogHeader className="flex flex-col items-center gap-2 pt-6 pb-2">
          {logo ? (
            <div className="w-16 h-16 bg-white rounded-xl border border-[rgba(0,0,0,0.08)] flex items-center justify-center mb-2">
              <img src={logo} alt="Dialog graphic" className="w-10 h-10 rounded-md" />
            </div>
          ) : null}
          <DialogTitle className="text-xl font-semibold text-[#34322d]">
            {title || (isLogin ? "Welcome back" : "Create an account")}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#858481]">
            {isLogin 
              ? "Enter your credentials to access your account" 
              : "Select your role and sign up to continue"}
          </DialogDescription>
        </DialogHeader>

        {!isLogin && (
          <div className="flex gap-2 p-1.5 bg-[#E8E3D1]/40 rounded-[12px] mx-6 mt-1">
            <button
              type="button"
              onClick={() => setRole("customer")}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-[8px] transition ${role === "customer" ? "bg-white text-[#27324A] shadow-sm" : "text-[#746E73] hover:text-[#27324A]"}`}
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => setRole("owner")}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-[8px] transition ${role === "owner" ? "bg-white text-[#27324A] shadow-sm" : "text-[#746E73] hover:text-[#27324A]"}`}
            >
              Shop Owner
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4 mt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-[#27324A]">Email</label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                className="h-11 rounded-[10px]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-[#27324A]">Password</label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="h-11 rounded-[10px]"
              />
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-[#A7653A] hover:bg-[#8E5432] text-white rounded-[10px] text-sm font-semibold transition"
          >
            {isLoading ? "Please wait..." : (isLogin ? "Sign In" : "Sign Up")}
          </Button>

          <div className="text-center mt-2">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-[#A7653A] hover:underline focus:outline-none"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </form>

        {(role === "owner" || isLogin) && (
          <div className="px-6 pb-6 pt-2">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#2E3344]/10"></div></div>
              <div className="relative flex justify-center text-xs"><span className="bg-[#f8f8f7] px-2 text-[#746E73]">Or continue with</span></div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={handleGoogleLogin}
              className="w-full h-11 bg-white hover:bg-gray-50 text-[#27324A] border border-[#2E3344]/10 rounded-[10px] text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google (Shop Owners Only)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
