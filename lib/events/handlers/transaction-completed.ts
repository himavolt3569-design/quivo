import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/events/notify";
import { log } from "@/lib/log";

/**
 * POS sale closed — let every active shop member with notification rights
 * see it in their in-app bell. Email is left off for POS since the sale is
 * in-person; if the user wants email receipts they enable them via prefs.
 */

interface Payload {
  transaction_id?: string;
  shop_id?: string;
  total?: number;
  tax_amount?: number;
  payment_method?: string;
  item_count?: number;
}

export async function handleTransactionCompleted(
  payload: Payload,
): Promise<void> {
  if (!payload.shop_id || !payload.transaction_id) {
    log.warn("transaction.completed handler: missing ids", { payload });
    return;
  }
  const admin = createAdminClient();

  const [{ data: shop, error: shopErr }, { data: members, error: memErr }] =
    await Promise.all([
      admin
        .from("shops")
        .select("name")
        .eq("id", payload.shop_id)
        .maybeSingle(),
      admin
        .from("shop_members")
        .select("user_id")
        .eq("shop_id", payload.shop_id)
        .eq("status", "active"),
    ]);

  if (shopErr)
    log.error("transaction.completed: shop lookup failed", {
      code: shopErr.code,
    });
  if (memErr) {
    log.error("transaction.completed: members lookup failed", {
      code: memErr.code,
    });
    return;
  }

  const shopName = (shop?.name as string | undefined) ?? "your shop";
  const totalStr =
    typeof payload.total === "number"
      ? `Rs. ${payload.total.toFixed(2)}`
      : "a sale";
  const method = payload.payment_method ?? "cash";

  await Promise.all(
    (members ?? []).map((m) =>
      notifyUser({
        userId: m.user_id as string,
        kind: "transaction.completed",
        shopId: payload.shop_id ?? null,
        inApp: {
          title: `${totalStr} sale closed`,
          body: `${shopName} — paid via ${method}.`,
          linkUrl: `/dashboard/owner/finances`,
          data: {
            transaction_id: payload.transaction_id,
            total: payload.total,
            payment_method: method,
          },
        },
      }).catch((err) =>
        log.error("notifyUser failed", {
          err: err instanceof Error ? err.message : String(err),
        }),
      ),
    ),
  );
}
