"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AUTH_ERROR_MESSAGES, isAuthErrorCode } from "@/lib/auth-errors";

/**
 * Reads the `auth_error` query param and surfaces it as a toast.
 *
 * Isolated into its own client component so the `useSearchParams()` CSR
 * bailout is scoped to this tiny (render-nothing) boundary instead of
 * forcing the entire landing page to render client-side. Must be wrapped
 * in a <Suspense> by the caller.
 */
export function AuthErrorToast() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("auth_error");
    if (!isAuthErrorCode(code)) return;
    const { title, description } = AUTH_ERROR_MESSAGES[code](searchParams);
    toast.error(title, { description, duration: 10000 });
  }, [searchParams]);

  return null;
}
