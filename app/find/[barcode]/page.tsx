import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { findShopsByBarcode } from "@/app/actions/customer";
import { BarcodeShopResults } from "@/components/storefront/BarcodeShopResults";

interface Props {
  params: Promise<{ barcode: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { barcode } = await params;
  const code = decodeURIComponent(barcode);
  return {
    title: `Shops carrying ${code} near you · Quivo`,
    description: `Scan-to-order: see which shops stock barcode ${code} in stock and order from the closest one.`,
  };
}

export default async function FindByBarcodePage({ params }: Props) {
  const { barcode } = await params;
  const code = decodeURIComponent(barcode);

  // Unscoped first page (no coordinates) for instant paint + SEO; the client
  // component re-queries with the customer's location once granted.
  const { matches } = await findShopsByBarcode(code);
  const productName = matches?.[0]?.productName ?? null;

  return (
    <div className="min-h-screen bg-[#F7F0E6]">
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#746E73] transition hover:text-[#27324A]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Quivo
        </Link>
      </div>
      <BarcodeShopResults
        barcode={code}
        initialMatches={matches ?? []}
        productName={productName}
      />
    </div>
  );
}
