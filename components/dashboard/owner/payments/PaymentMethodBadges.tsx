import { createClient } from "@/lib/supabase/server";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from "@/lib/payments/constants";
import type { PaymentMethod } from "@/lib/payments";
import { CheckCircle2, MinusCircle } from "lucide-react";

export async function PaymentMethodBadges({ shopId }: { shopId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_owner_payment_config", { p_shop_id: shopId })
    .maybeSingle<{
      enabled_methods: PaymentMethod[];
      has_esewa_secret: boolean;
      has_khalti_secret: boolean;
    }>();

  const enabled = new Set<string>(data?.enabled_methods ?? ["cod"]);

  return (
    <div className="bg-white rounded-3xl border border-[#2E3344]/8 shadow-sm p-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-[#746E73]">
          Enabled payment methods
        </p>
        <p className="text-xs text-[#746E73] mt-0.5">
          Customers will only see methods enabled here.
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {PAYMENT_METHODS.map((m) => {
          const isOn = enabled.has(m);
          let missing = false;
          if (m === "esewa") missing = isOn && !data?.has_esewa_secret;
          if (m === "khalti") missing = isOn && !data?.has_khalti_secret;
          return (
            <span
              key={m}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                missing
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : isOn
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-gray-50 text-gray-500 border border-gray-200"
              }`}
              title={
                missing ? "Enabled but credentials are missing" : undefined
              }
            >
              {isOn ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <MinusCircle className="h-3 w-3" />
              )}
              {PAYMENT_METHOD_LABELS[m]}
              {missing && <span className="ml-0.5 text-[9px]">⚠</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
