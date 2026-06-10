const LOCAL_SITE_URL = "http://localhost:3000";

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return { url, anonKey };
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || LOCAL_SITE_URL;
  return new URL(configuredUrl).origin;
}

export function getSafeRedirectPath(
  value: string | null,
  fallback = "/dashboard",
) {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const parsed = new URL(value, LOCAL_SITE_URL);
    if (parsed.origin !== LOCAL_SITE_URL) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function isSafeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return value.startsWith("/");
  }
}
