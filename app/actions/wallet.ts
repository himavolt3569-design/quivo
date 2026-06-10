"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UUID = z.string().uuid();

export async function getMyWalletBalance(): Promise<{ balance: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { balance: 0 };
  const { data } = await supabase
    .from("profiles")
    .select("wallet_balance")
    .eq("id", user.id)
    .maybeSingle();
  return { balance: Number((data?.wallet_balance as number | undefined) ?? 0) };
}

/** Returns the max rupee amount the caller can apply to an order of size
 *  `subtotal` against `shopId`. Capped by both the customer's balance and
 *  the shop's max_wallet_redeem_pct. Returns 0 if anonymous. */
export async function getWalletRedeemMax(
  shopId: string,
  subtotal: number,
): Promise<{ max: number }> {
  const parse = UUID.safeParse(shopId);
  if (!parse.success || !(subtotal > 0)) return { max: 0 };
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_wallet_redeem_max", {
      p_shop_id: parse.data,
      p_subtotal: subtotal,
    })
    .maybeSingle<number>();
  return { max: Number(data ?? 0) };
}
