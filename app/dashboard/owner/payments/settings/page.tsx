import { getOwnerContext } from "@/lib/shop";
import { getOwnerPaymentConfig } from "@/app/actions/payment-config";
import { PaymentConfigForm } from "@/components/dashboard/owner/payments/PaymentConfigForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PaymentSettingsPage() {
  const ctx = await getOwnerContext();
  const shop = ctx.activeShop ?? null;

  if (!shop) {
    return <div className="p-6 text-sm text-[#746E73]">No shop selected.</div>;
  }

  const res = await getOwnerPaymentConfig(shop.id);
  if (res.error || !res.config) {
    return (
      <div className="p-6 text-sm text-red-600">
        Failed to load: {res.error}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-5">
      <Link
        href="/dashboard/owner/payments"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#27324A] hover:text-[#A7653A]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Payments
      </Link>

      <div>
        <h1 className="text-2xl font-black text-[#27324A]">Payment Methods</h1>
        <p className="text-xs text-[#746E73] mt-0.5">
          Configure which payment methods{" "}
          <span className="font-bold">{shop.name}</span> offers. Each shop has
          its own credentials — they are never shared across shops.
        </p>
      </div>

      <PaymentConfigForm shopId={shop.id} initial={res.config} />
    </div>
  );
}
