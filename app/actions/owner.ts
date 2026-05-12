"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSiteUrl, isSafeHttpUrl } from "@/lib/security";

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,49}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const OptionalUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || isSafeHttpUrl(v), "Invalid URL")
  .optional()
  .transform((v) => (v && v !== "" ? v : undefined));

const CreateShopSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Shop name must be at least 2 characters")
    .max(100, "Shop name is too long"),
  business_type: z.enum(["retailer", "wholesale"]).default("retailer"),
  category: z.enum(["kirana"]).default("kirana"),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(300).optional(),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  description: z.string().trim().max(500).optional(),
  logo_url: OptionalUrl,
  pan_document_url: OptionalUrl,
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .max(50)
    .refine(
      (v) => v === "" || SUBDOMAIN_REGEX.test(v),
      "Subdomain must be 2–50 chars, lowercase letters/digits/hyphens"
    )
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  opening_time: z
    .string()
    .trim()
    .regex(TIME_REGEX, "Invalid time")
    .optional()
    .transform((v) => (v ? v : undefined)),
  closing_time: z
    .string()
    .trim()
    .regex(TIME_REGEX, "Invalid time")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function randomSuffix(): string {
  // 4 lowercase alphanumerics, no leading zero issues
  return Math.random().toString(36).slice(2, 6).padEnd(4, "x");
}

export async function createShop(formData: FormData) {
  const rawLat = formData.get("lat")?.toString();
  const rawLng = formData.get("lng")?.toString();

  const parse = CreateShopSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    business_type: formData.get("business_type")?.toString() ?? "retailer",
    category: formData.get("category")?.toString() ?? "kirana",
    phone: formData.get("phone")?.toString() ?? "",
    address: formData.get("address")?.toString() ?? "",
    lat: rawLat ? parseFloat(rawLat) : null,
    lng: rawLng ? parseFloat(rawLng) : null,
    description: formData.get("description")?.toString() ?? "",
    logo_url: formData.get("logo_url")?.toString() ?? "",
    pan_document_url: formData.get("pan_document_url")?.toString() ?? "",
    subdomain: formData.get("subdomain")?.toString() ?? "",
    opening_time: formData.get("opening_time")?.toString() ?? "",
    closing_time: formData.get("closing_time")?.toString() ?? "",
  });

  if (!parse.success) {
    return { error: parse.error.issues[0].message };
  }

  const data = parse.data;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Unauthorized" };

  // Slug generation: prefer subdomain, then name. Retry with random suffix on collision.
  const base = slugify(data.subdomain || data.name);
  if (!base) return { error: "Could not derive a slug from the shop name" };

  let slug = base;
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: existing, error: lookupError } = await supabase
      .from("shops")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "createShop: shops lookup failed",
        lookupError.code,
        lookupError.message,
        lookupError.details
      );
      if (lookupError.code === "42P01") {
        return {
          error:
            "Shop tables are not set up yet. Apply migration 20240101000012_owner_foundation.sql in your Supabase SQL editor and try again.",
        };
      }
      return { error: `Database error: ${lookupError.message}` };
    }

    if (!existing) break;
    slug = `${base}-${randomSuffix()}`;
    if (attempt === 7) {
      return { error: "Could not generate a unique slug. Try a different shop name." };
    }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "create_shop_with_owner",
    {
      p_name: data.name,
      p_slug: slug,
      p_business_type: data.business_type,
      p_category: data.category,
      p_phone: data.phone || null,
      p_address: data.address || null,
      p_lat: data.lat ?? null,
      p_lng: data.lng ?? null,
      p_description: data.description || null,
      p_logo_url: data.logo_url ?? null,
      p_pan_document_url: data.pan_document_url ?? null,
      p_subdomain: data.subdomain ?? null,
      p_opening_time: data.opening_time ?? null,
      p_closing_time: data.closing_time ?? null,
      p_site_origin: getSiteUrl(),
    }
  );

  if (rpcError) {
    console.error(
      "createShop RPC error",
      JSON.stringify(
        {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
        },
        null,
        2
      )
    );
    if (rpcError.code === "23505") {
      return { error: "A shop with that name or subdomain already exists." };
    }
    if (rpcError.code === "42501") {
      return { error: "Unauthorized. Please sign in again." };
    }
    if (rpcError.code === "23514") {
      return { error: `Validation failed: ${rpcError.message}` };
    }
    return {
      error: `RPC ${rpcError.code ?? "?"}: ${rpcError.message ?? "unknown error"}${rpcError.hint ? ` (hint: ${rpcError.hint})` : ""}`,
    };
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!row) {
    console.error("createShop: RPC returned no row", rpcData);
    return { error: "Shop creation returned no result. Check server logs." };
  }

  // Make the new shop the user's active shop. Best-effort: if the column
  // doesn't exist yet (migration 13 not applied), log and continue.
  const { error: activeError } = await supabase
    .from("profiles")
    .update({ active_shop_id: row.shop_id })
    .eq("id", user.id);
  if (activeError && activeError.code !== "42703") {
    console.error("createShop: could not set active_shop_id", activeError.code, activeError.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/owner");

  return {
    success: true,
    shop_id: row.shop_id as string,
    slug,
    qr_token: row.qr_token as string,
    qr_target_url: row.qr_target_url as string,
  };
}

const ShopIdSchema = z.string().uuid("Invalid shop ID");

export async function setActiveShop(shopId: string) {
  const parse = ShopIdSchema.safeParse(shopId);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Verify the caller is an active member of the target shop
  const { data: member, error: memberError } = await supabase
    .from("shop_members")
    .select("shop_id")
    .eq("user_id", user.id)
    .eq("shop_id", parse.data)
    .eq("status", "active")
    .maybeSingle();

  if (memberError) {
    console.error(
      "setActiveShop: membership check failed",
      JSON.stringify(
        {
          code: memberError.code,
          message: memberError.message,
          details: memberError.details,
          hint: memberError.hint,
        },
        null,
        2
      )
    );
    return {
      error: `Membership check failed (${memberError.code ?? "?"}): ${memberError.message ?? "unknown"}`,
    };
  }
  if (!member) return { error: "You are not a member of that shop." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ active_shop_id: parse.data })
    .eq("id", user.id);

  if (updateError) {
    console.error(
      "setActiveShop: profile update failed",
      JSON.stringify(
        {
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        },
        null,
        2
      )
    );
    if (updateError.code === "42703") {
      return {
        error:
          "active_shop_id column missing. Apply migration 20240101000013_profiles_active_shop.sql in your Supabase SQL editor.",
      };
    }
    return {
      error: `Update failed (${updateError.code ?? "?"}): ${updateError.message ?? "unknown"}`,
    };
  }

  revalidatePath("/dashboard/owner");
  return { success: true };
}
