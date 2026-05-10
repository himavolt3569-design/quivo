import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/security";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const inferredRole = user.app_metadata?.provider === "google" ? "owner" : "customer";
        await supabase.from("profiles").upsert(
          { id: user.id, email: user.email!, role: inferredRole },
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=true`);
}
