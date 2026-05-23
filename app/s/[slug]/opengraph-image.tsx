import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const alt = "Quivo storefront";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  let name = "Quivo";
  let theme = "#27324A";
  let category: string | null = null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("shops")
      .select("name, category, theme_color")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (data) {
      name = (data.name as string) ?? name;
      theme = (data.theme_color as string | null) ?? theme;
      category = (data.category as string | null) ?? null;
    }
  } catch {
    // fall back to defaults
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: `linear-gradient(135deg, #F7F0E6 0%, #E8E3D1 100%)`,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: theme,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            Q
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#27324A" }}>Quivo</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 96, fontWeight: 900, color: "#27324A", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            {name}
          </div>
          {category && (
            <div style={{ fontSize: 28, fontWeight: 700, color: theme, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              {category} · quivo.app/s/{slug}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: theme,
              color: "white",
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            Order online
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#746E73" }}>
            Powered by Quivo · barcode-first kirana commerce
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
