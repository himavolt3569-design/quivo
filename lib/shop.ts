import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ShopRole =
  | "owner"
  | "admin"
  | "manager"
  | "cashier"
  | "inventory"
  | "viewer";

export interface ShopRow {
  id: string;
  slug: string;
  name: string;
  status: "active" | "paused" | "closed";
  logo_url: string | null;
}

export interface MembershipShop extends ShopRow {
  role: ShopRole;
}

/**
 * Returns every shop the current user is an active member of, oldest first.
 * Empty array if unauthenticated or no memberships.
 */
export async function getUserShops(): Promise<MembershipShop[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("shop_members")
    .select("role, shop:shops!inner(id, slug, name, status, logo_url)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error || !data) return [];

  return data
    .map((row) => {
      const shop = Array.isArray(row.shop) ? row.shop[0] : row.shop;
      if (!shop) return null;
      return {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        status: shop.status,
        logo_url: shop.logo_url,
        role: row.role as ShopRole,
      };
    })
    .filter((r): r is MembershipShop => r !== null);
}

/**
 * Returns the user's "active" shop based on `profiles.active_shop_id`,
 * falling back to the oldest membership when not set or stale.
 */
export async function getActiveShop(): Promise<MembershipShop | null> {
  const { activeShop } = await getOwnerContext();
  return activeShop;
}

/**
 * Single cached round-trip that returns the user's shops + currently active one.
 * Wrapped in React.cache() so multiple consumers within one request share the
 * same query (e.g. layout + page both calling it).
 */
export const getOwnerContext = cache(
  async (): Promise<{
    shops: MembershipShop[];
    activeShop: MembershipShop | null;
  }> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { shops: [], activeShop: null };

    const [shopsResult, profileResult] = await Promise.all([
      supabase
        .from("shop_members")
        .select("role, shop:shops!inner(id, slug, name, status, logo_url)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("joined_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("active_shop_id")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const shops: MembershipShop[] = (shopsResult.data ?? [])
      .map((row) => {
        const shop = Array.isArray(row.shop) ? row.shop[0] : row.shop;
        if (!shop) return null;
        return {
          id: shop.id,
          slug: shop.slug,
          name: shop.name,
          status: shop.status,
          logo_url: shop.logo_url,
          role: row.role as ShopRole,
        };
      })
      .filter((r): r is MembershipShop => r !== null);

    if (shops.length === 0) return { shops, activeShop: null };

    const activeId = profileResult.data?.active_shop_id as string | null | undefined;
    const activeShop =
      (activeId && shops.find((s) => s.id === activeId)) || shops[0];

    return { shops, activeShop };
  }
);

const ROLE_PRIORITY: Record<ShopRole, number> = {
  viewer: 0,
  cashier: 1,
  inventory: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

/**
 * Throws if the current user is not an active member of `shopId` with at
 * least `minRole`. Returns their actual role on success.
 */
export async function requireShopAccess(
  shopId: string,
  minRole: ShopRole = "viewer"
): Promise<ShopRole> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: member, error } = await supabase
    .from("shop_members")
    .select("role")
    .eq("shop_id", shopId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error || !member) throw new Error("Forbidden");

  const role = member.role as ShopRole;
  if (ROLE_PRIORITY[role] < ROLE_PRIORITY[minRole]) {
    throw new Error("Forbidden");
  }
  return role;
}
