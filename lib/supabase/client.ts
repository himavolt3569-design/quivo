"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/security";

export function createClient() {
  const { url, anonKey } = getSupabaseConfig();

  return createBrowserClient(
    url,
    anonKey,
  );
}
