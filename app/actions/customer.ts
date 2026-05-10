"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nanoid } from "nanoid";
import { checkRateLimit } from "@/lib/rate-limit";
import { isSafeHttpUrl } from "@/lib/security";

const COVER_GRADIENTS = [
  "from-[#A7653A] via-[#D8C99A] to-[#B76E42]",
  "from-[#27324A] via-[#4A5E82] to-[#1B2030]",
  "from-[#626A54] via-[#8F987D] to-[#464D3B]",
  "from-[#8D5132] via-[#B8714B] to-[#5C331F]",
  "from-[#E8E3D1] via-[#FFFFFF] to-[#D5CDBD]",
] as const;

const ImageUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(isSafeHttpUrl, "Invalid image URL");

const AddressSchema = z.object({
  label: z.string().trim().min(1).max(20).default("Home"),
  address_line: z.string().trim().min(3, "Address is too short").max(200),
  landmark: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  is_default: z.coerce.boolean().optional().default(false),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
});

const PlaceOrderSchema = z.object({
  shop_name: z.string().trim().min(1).max(100),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        price: z.number().min(0).max(1000000),
        quantity: z.number().min(1).max(99),
        image: ImageUrlSchema.optional(),
        barcode: z.string().trim().max(100).optional(),
      })
    )
    .min(1)
    .max(50),
  notes: z.string().trim().max(500).optional(),
  delivery_address: z.string().trim().max(300).optional(),
  eta_minutes: z.number().min(5).max(180).optional().default(20),
});

const SavedShopSchema = z.object({
  shop_name: z.string().trim().min(1).max(100),
  shop_category: z.string().trim().max(50).nullable().optional(),
  shop_distance: z.number().min(0).max(10000).nullable().optional(),
  shop_image: ImageUrlSchema.nullable().optional(),
});

const SavedProductSchema = z.object({
  product_id: z.string().trim().min(1).max(100),
  product_name: z.string().trim().min(1).max(100),
  product_price: z.string().trim().max(20).nullable().optional(),
  product_image: ImageUrlSchema.nullable().optional(),
  product_shop: z.string().trim().max(100).nullable().optional(),
});

const ProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(50, "Name too long")
});

const AvatarUrlSchema = z.string().trim().max(1000).refine(isSafeHttpUrl, "Invalid avatar URL");
const CoverColorSchema = z.enum(COVER_GRADIENTS);
const IdSchema = z.string().uuid("Invalid ID");

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return { supabase, user };
}

// ─── Addresses ───────────────────────────────────────────────────────────────

export async function addAddress(formData: FormData) {
  const rateLimit = await checkRateLimit("addAddress");
  if (!rateLimit.success) return { error: rateLimit.error };

  const rawLat = formData.get("lat")?.toString();
  const rawLng = formData.get("lng")?.toString();
  const parse = AddressSchema.safeParse({
    label: formData.get("label")?.toString(),
    address_line: formData.get("address_line")?.toString(),
    landmark: formData.get("landmark")?.toString() || undefined,
    phone: formData.get("phone")?.toString() || undefined,
    is_default: formData.get("is_default") === "true",
    lat: rawLat ? parseFloat(rawLat) : null,
    lng: rawLng ? parseFloat(rawLng) : null,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const { data: newId, error } = await supabase.rpc("create_address_atomic", {
    p_label: parse.data.label,
    p_address_line: parse.data.address_line,
    p_landmark: parse.data.landmark ?? null,
    p_phone: parse.data.phone ?? null,
    p_is_default: parse.data.is_default,
    p_lat: parse.data.lat ?? null,
    p_lng: parse.data.lng ?? null,
  });

  if (error) return { error: "Could not add address." };
  revalidatePath("/dashboard");
  return { success: true, id: newId };
}

export async function updateAddress(id: string, formData: FormData) {
  const idParse = IdSchema.safeParse(id);
  if (!idParse.success) return { error: "Invalid address ID" };
  const rateLimit = await checkRateLimit("updateAddress");
  if (!rateLimit.success) return { error: rateLimit.error };

  const rawLat2 = formData.get("lat")?.toString();
  const rawLng2 = formData.get("lng")?.toString();
  const parse = AddressSchema.safeParse({
    label: formData.get("label")?.toString(),
    address_line: formData.get("address_line")?.toString(),
    landmark: formData.get("landmark")?.toString() || undefined,
    phone: formData.get("phone")?.toString() || undefined,
    is_default: formData.get("is_default") === "true",
    lat: rawLat2 ? parseFloat(rawLat2) : null,
    lng: rawLng2 ? parseFloat(rawLng2) : null,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const { error } = await supabase.rpc("update_address_atomic", {
    p_id: idParse.data,
    p_label: parse.data.label,
    p_address_line: parse.data.address_line,
    p_landmark: parse.data.landmark ?? null,
    p_phone: parse.data.phone ?? null,
    p_is_default: parse.data.is_default,
    p_lat: parse.data.lat ?? null,
    p_lng: parse.data.lng ?? null,
  });

  if (error) return { error: "Could not update address." };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteAddress(id: string) {
  const idParse = IdSchema.safeParse(id);
  if (!idParse.success) return { error: "Invalid address ID" };
  const rateLimit = await checkRateLimit("deleteAddress");
  if (!rateLimit.success) return { error: rateLimit.error };

  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", idParse.data)
    .eq("customer_id", user.id);

  if (error) return { error: "Could not delete address." };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function setDefaultAddress(id: string) {
  const idParse = IdSchema.safeParse(id);
  if (!idParse.success) return { error: "Invalid address ID" };
  const rateLimit = await checkRateLimit("setDefaultAddress");
  if (!rateLimit.success) return { error: rateLimit.error };

  const { supabase, user } = await getAuthUser();

  const { error } = await supabase.rpc("set_address_default_atomic", {
    p_id: idParse.data,
  });

  if (error) return { error: "Could not set default address." };
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Saved Items ──────────────────────────────────────────────────────────────

export async function toggleSavedShop(shopData: {
  shop_name: string;
  shop_category?: string | null;
  shop_distance?: number | null;
  shop_image?: string | null;
}) {
  const rateLimit = await checkRateLimit("toggleSavedShop");
  if (!rateLimit.success) return { error: rateLimit.error };

  const parse = SavedShopSchema.safeParse(shopData);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const { data: existing } = await supabase
    .from("saved_shops")
    .select("id")
    .eq("customer_id", user.id)
    .eq("shop_name", parse.data.shop_name)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("saved_shops")
      .delete()
      .eq("id", existing.id)
      .eq("customer_id", user.id);
    if (error) return { error: "Could not update saved shop." };
    return { saved: false };
  } else {
    const { error } = await supabase.from("saved_shops").insert({ customer_id: user.id, ...parse.data });
    if (error) return { error: "Could not update saved shop." };
    return { saved: true };
  }
}

export async function toggleSavedProduct(productData: {
  product_id: string;
  product_name: string;
  product_price?: string | null;
  product_image?: string | null;
  product_shop?: string | null;
}) {
  const rateLimit = await checkRateLimit("toggleSavedProduct");
  if (!rateLimit.success) return { error: rateLimit.error };

  const parse = SavedProductSchema.safeParse(productData);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const { data: existing } = await supabase
    .from("saved_products")
    .select("id")
    .eq("customer_id", user.id)
    .eq("product_id", parse.data.product_id)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("saved_products")
      .delete()
      .eq("id", existing.id)
      .eq("customer_id", user.id);
    if (error) return { error: "Could not update saved product." };
    return { saved: false };
  } else {
    const { error } = await supabase
      .from("saved_products")
      .insert({ customer_id: user.id, ...parse.data });
    if (error) return { error: "Could not update saved product." };
    return { saved: true };
  }
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function placeOrder(data: {
  shop_name: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    image?: string;
    barcode?: string;
  }>;
  notes?: string;
  delivery_address?: string;
  eta_minutes?: number;
}) {
  const rateLimit = await checkRateLimit("placeOrder");
  if (!rateLimit.success) return { error: rateLimit.error };

  const parse = PlaceOrderSchema.safeParse(data);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const total_amount = parse.data.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  if (total_amount > 1000000) {
    return { error: "Order total is too large." };
  }

  const order_number = `QUIVO-${nanoid(6).toUpperCase()}`;

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      customer_id: user.id,
      order_number,
      shop_name: parse.data.shop_name,
      status: "placed",
      total_amount,
      items: parse.data.items,
      notes: parse.data.notes ?? null,
      delivery_address: parse.data.delivery_address ?? null,
      eta_minutes: parse.data.eta_minutes ?? 20,
    })
    .select()
    .single();

  if (error) return { error: "Could not place order." };

  // ── Wallet rewards ─────────────────────────────────────────────────────────
  try {
    await supabase.rpc("award_order_rewards", { p_order_id: order!.id });
  } catch {
    // Wallet update is non-critical — don't block order confirmation
  }

  revalidatePath("/dashboard");
  return {
    success: true,
    order: {
      id: order!.id,
      order_number: order!.order_number,
      shop_name: order!.shop_name,
      status: order!.status,
      total_amount: order!.total_amount,
      items: order!.items,
      notes: order!.notes,
      eta_minutes: order!.eta_minutes,
      delivery_address: order!.delivery_address,
      created_at: order!.created_at,
      updated_at: order!.updated_at,
    },
  };
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function updateAvatar(avatarUrl: string) {
  const parse = AvatarUrlSchema.safeParse(avatarUrl);
  if (!parse.success) return { error: parse.error.issues[0].message };

  const rateLimit = await checkRateLimit("updateAvatar");
  if (!rateLimit.success) return { error: rateLimit.error };

  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: parse.data })
    .eq("id", user.id);

  if (error) return { error: "Could not update avatar." };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateCoverColor(color: string) {
  const parse = CoverColorSchema.safeParse(color);
  if (!parse.success) return { error: "Invalid color" };

  const rateLimit = await checkRateLimit("updateCoverColor");
  if (!rateLimit.success) return { error: rateLimit.error };

  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("profiles")
    .update({ cover_color: parse.data })
    .eq("id", user.id);

  if (error) return { error: "Could not update cover color." };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateFontSize(size: string) {
  const validSizes = ["small", "standard", "large", "xlarge"];
  if (!validSizes.includes(size)) {
    return { error: "Invalid font size" };
  }

  const rateLimit = await checkRateLimit("updateFontSize");
  if (!rateLimit.success) return { error: rateLimit.error };

  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("profiles")
    .update({ font_size: size })
    .eq("id", user.id);

  if (error) return { error: "Could not update font size." };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function changePassword(formData: FormData) {
  const rateLimit = await checkRateLimit("changePassword");
  if (!rateLimit.success) return { error: rateLimit.error };

  const newPassword = formData.get("new_password")?.toString() ?? "";
  const confirmPassword = formData.get("confirm_password")?.toString() ?? "";
  const currentPassword = formData.get("current_password")?.toString() ?? "";

  if (newPassword.length < 8)
    return { error: "Password must be at least 8 characters" };
  if (newPassword !== confirmPassword)
    return { error: "Passwords do not match" };

  const { supabase, user } = await getAuthUser();

  const hasEmailIdentity =
    user.identities?.some((id) => id.provider === "email") ?? false;

  if (hasEmailIdentity) {
    if (!currentPassword) return { error: "Current password is required" };
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });
    if (signInError) return { error: "Current password is incorrect" };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: "Could not update password." };

  return { success: true };
}

export async function updateProfile(formData: FormData) {
  const rateLimit = await checkRateLimit("updateProfile");
  if (!rateLimit.success) return { error: rateLimit.error };

  const parse = ProfileSchema.safeParse({
    full_name: formData.get("full_name")?.toString(),
  });
  
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase, user } = await getAuthUser();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parse.data.full_name })
    .eq("id", user.id);

  if (error) return { error: "Could not update profile." };
  revalidatePath("/dashboard");
  return { success: true };
}
