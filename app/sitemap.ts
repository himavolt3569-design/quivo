import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/security";
import { log } from "@/lib/log";

export const revalidate = 3600; // 1 h — large enough not to hammer DB, small enough that new shops appear within an hour.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${site}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  try {
    const admin = createAdminClient();
    const { data: shops, error } = await admin
      .from("shops")
      .select("slug, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(5000);
    if (error) {
      log.error("sitemap: shops query failed", {
        code: error.code,
        message: error.message,
      });
      return entries;
    }
    for (const s of shops ?? []) {
      entries.push({
        url: `${site}/s/${s.slug}`,
        lastModified: s.updated_at ? new Date(s.updated_at as string) : now,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }

    // Sampled product detail pages — cap to keep sitemap under 50 MB / 50k.
    const { data: products } = await admin
      .from("products")
      .select("barcode, updated_at, shop:shops!inner(slug,status)")
      .eq("status", "active")
      .not("barcode", "is", null)
      .order("updated_at", { ascending: false })
      .limit(20000);

    for (const p of products ?? []) {
      const shop = Array.isArray(p.shop) ? p.shop[0] : p.shop;
      if (!shop?.slug || shop?.status !== "active") continue;
      entries.push({
        url: `${site}/s/${shop.slug}/product/${p.barcode}`,
        lastModified: p.updated_at ? new Date(p.updated_at as string) : now,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  } catch (err) {
    log.error("sitemap: build failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return entries;
}
