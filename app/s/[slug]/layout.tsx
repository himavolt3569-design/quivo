import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Google Fonts preload — all storefront fonts in one request */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;900&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
