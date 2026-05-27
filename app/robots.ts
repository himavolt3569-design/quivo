import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/security";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/s/"],
        disallow: ["/api/", "/dashboard/", "/auth/", "/onboarding/", "/order/"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
