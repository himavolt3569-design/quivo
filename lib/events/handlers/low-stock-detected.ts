import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { notifyUser } from "@/lib/events/notify";
import { renderLowStockDigestEmail, type LowStockLine } from "@/emails/LowStockDigestEmail";
import { getSiteUrl } from "@/lib/security";
import { log } from "@/lib/log";

interface Payload {
  shop_id?: string;
  items?: LowStockLine[];
}

export async function handleLowStockDetected(payload: Payload): Promise<void> {
  if (!payload.shop_id || !payload.items || payload.items.length === 0) {
    log.debug("low_stock.detected: no items to dispatch", { shopId: payload.shop_id });
    return;
  }

  const admin = createAdminClient();

  const [{ data: shop }, { data: members }] = await Promise.all([
    admin.from("shops").select("name, logo_url, theme_color").eq("id", payload.shop_id).maybeSingle(),
    admin
      .from("shop_members")
      .select("user_id, role")
      .eq("shop_id", payload.shop_id)
      .eq("status", "active")
      .in("role", ["owner", "admin", "manager", "inventory"]),
  ]);

  const shopBrand = {
    name: (shop?.name as string | undefined) ?? "Shop",
    logoUrl: (shop?.logo_url as string | null | undefined) ?? null,
    themeColor: (shop?.theme_color as string | null | undefined) ?? null,
  };
  const productsUrl = `${getSiteUrl()}/dashboard/owner/products`;

  for (const m of members ?? []) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", m.user_id as string)
      .maybeSingle();

    const rendered = renderLowStockDigestEmail({
      shop: shopBrand,
      ownerName: (profile?.full_name as string | undefined) ?? "there",
      items: payload.items,
      productsUrl,
    });

    await notifyUser({
      userId: m.user_id as string,
      kind: "low_stock.detected",
      shopId: payload.shop_id ?? null,
      inApp: {
        title: `${payload.items.length} item${payload.items.length === 1 ? "" : "s"} low on stock`,
        body: `${shopBrand.name} — restock soon.`,
        linkUrl: "/dashboard/owner/products",
        data: { count: payload.items.length, items: payload.items.slice(0, 5) },
      },
      email: profile?.email
        ? {
            to: profile.email as string,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            tags: [{ name: "kind", value: "low_stock_digest" }],
          }
        : undefined,
    });
  }

  // Use sendEmail signature once just so TypeScript doesn't flag an unused
  // import when handler-only emails are not delivered (unreachable in prod).
  void sendEmail;
}
