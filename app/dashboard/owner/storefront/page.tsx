import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { StorefrontManager } from "@/components/dashboard/owner/storefront/StorefrontManager";
import Link from "next/link";
import QRCode from "qrcode";

export default async function StorefrontPage() {
  const ctx = await getOwnerContext();
  const activeShop = ctx.activeShop;

  if (!activeShop) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-lg font-bold text-[#27324A]">No shop selected.</p>
        <Link
          href="/onboarding/owner"
          className="text-sm text-[#A7653A] hover:underline font-bold"
        >
          Create your first shop →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: qrCode }, { data: shop }] = await Promise.all([
    supabase
      .from("shop_qr_codes")
      .select("qr_token, qr_target_url, scan_count")
      .eq("shop_id", activeShop.id)
      .eq("is_primary", true)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("shops")
      .select(
        "name, slug, theme_color, theme_layout, template, font_family, " +
          "hero_headline, hero_subtext, cover_image_url, " +
          "announcement_text, announcement_active, sections_order, whatsapp_number",
      )
      .eq("id", activeShop.id)
      .single(),
  ]);

  let qrDataUrl: string | null = null;
  if (qrCode?.qr_target_url) {
    try {
      qrDataUrl = await QRCode.toDataURL(qrCode.qr_target_url, {
        width: 300,
        margin: 2,
        color: { dark: "#27324A", light: "#ffffff" },
      });
    } catch {
      qrDataUrl = null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopData = shop && !("error" in (shop as any)) ? (shop as any) : null;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://quivo-hazel.vercel.app";
  const publicUrl = activeShop.slug ? `${siteUrl}/s/${activeShop.slug}` : null;

  return (
    <StorefrontManager
      shopId={activeShop.id}
      shopName={shopData?.name ?? activeShop.name}
      shopSlug={activeShop.slug}
      publicUrl={publicUrl}
      qrDataUrl={qrDataUrl}
      scanCount={qrCode?.scan_count ?? 0}
      initialThemeColor={shopData?.theme_color ?? "#A7653A"}
      initialThemeLayout={
        (shopData?.theme_layout as "modern" | "list") ?? "modern"
      }
      initialTemplate={shopData?.template ?? "modern"}
      initialFontFamily={shopData?.font_family ?? "inter"}
      initialHeroHeadline={shopData?.hero_headline ?? ""}
      initialHeroSubtext={shopData?.hero_subtext ?? ""}
      initialAnnouncementText={shopData?.announcement_text ?? ""}
      initialAnnouncementActive={shopData?.announcement_active ?? false}
      initialSectionsOrder={(shopData?.sections_order as string[]) ?? []}
      initialWhatsapp={shopData?.whatsapp_number ?? ""}
    />
  );
}
