import type { MetadataRoute } from "next";

/**
 * PWA manifest. Customers and owners can both install the app to their home
 * screen; `start_url=/dashboard` lands signed-in users straight into work.
 * The `?source=pwa` query lets analytics distinguish PWA opens from web hits.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quivo — Kirana POS & Storefront",
    short_name: "Quivo",
    description: "Nepal-first POS, inventory, payments and storefront for kirana shops.",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#F7F0E6",
    theme_color: "#27324A",
    orientation: "portrait-primary",
    categories: ["business", "productivity", "shopping"],
    lang: "en-NP",
    // SVG icons scale to any size and ship today without a raster pipeline.
    // For best iOS/Android home-screen fidelity, drop in 192/512 PNGs later
    // (icon-192.png, icon-512.png, icon-maskable-512.png) and add them here.
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Point of Sale",
        short_name: "POS",
        description: "Ring up an in-store sale",
        url: "/dashboard/owner/pos?source=pwa-shortcut",
      },
      {
        name: "Online orders",
        short_name: "Orders",
        description: "Storefront orders to fulfill",
        url: "/dashboard/owner/orders?source=pwa-shortcut",
      },
      {
        name: "Customer home",
        short_name: "Home",
        description: "Browse shops near you",
        url: "/dashboard/home?source=pwa-shortcut",
      },
    ],
  };
}
