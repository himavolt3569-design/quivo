"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSiteUrl, isSafeHttpUrl } from "@/lib/security";
import { getOwnerContext } from "@/lib/shop";

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
  verification_status: z
    .enum(["unverified", "pending", "verified", "rejected"])
    .default("unverified"),
  kyc_confidence: z.coerce.number().min(0).max(100).nullable().optional(),
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
    verification_status: formData.get("verification_status")?.toString() ?? "unverified",
    kyc_confidence: formData.get("kyc_confidence")?.toString() || null,
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
      p_verification_status: data.verification_status,
      p_kyc_confidence: data.kyc_confidence ?? null,
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

// ─── Shared helper ────────────────────────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return { supabase, user };
}

// ─── Products ─────────────────────────────────────────────────────────────────

const SafeUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || isSafeHttpUrl(v), "Invalid URL");

const ProductSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(200),
  brand: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  unit: z.string().trim().max(50).optional(),
  variant: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  price: z.coerce.number().min(0).max(10000000),
  cost_price: z.coerce.number().min(0).max(10000000).optional(),
  stock: z.coerce.number().int().min(0).max(1000000).default(0),
  low_stock_threshold: z.coerce.number().int().min(0).max(100000).default(5),
  barcode: z.string().trim().max(100).optional(),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  image_url: OptionalUrl,
  images: z.array(SafeUrl).max(10).default([]),
});

export async function addProduct(shopId: string, formData: FormData) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const unitSize = formData.get("unit_size")?.toString() ?? "";
  const unitType = formData.get("unit_type")?.toString() ?? "";
  const unit = unitSize && unitType ? `${unitSize} ${unitType}` : (unitSize || unitType || undefined);

  const rawImages = formData.get("images")?.toString();
  let imagesList: string[] = [];
  try { imagesList = rawImages ? JSON.parse(rawImages) : []; } catch { imagesList = []; }

  const parse = ProductSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    brand: formData.get("brand")?.toString() || undefined,
    category: formData.get("category")?.toString() || undefined,
    unit,
    variant: formData.get("variant")?.toString() || undefined,
    description: formData.get("description")?.toString() || undefined,
    price: formData.get("price")?.toString() ?? "0",
    cost_price: formData.get("cost_price")?.toString() || undefined,
    stock: formData.get("stock")?.toString() ?? "0",
    low_stock_threshold: formData.get("low_stock_threshold")?.toString() ?? "5",
    barcode: formData.get("barcode")?.toString() || undefined,
    status: "active",
    image_url: imagesList[0] ?? (formData.get("image_url")?.toString() ?? ""),
    images: imagesList,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { data, error } = await supabase
    .from("products")
    .insert({ shop_id: idParse.data, ...parse.data })
    .select("id, barcode")
    .single();

  if (error) return { error: `Could not add product: ${error.message}` };
  revalidatePath("/dashboard/owner/products");
  return { success: true, id: data.id, barcode: data.barcode };
}

export async function updateProduct(productId: string, shopId: string, formData: FormData) {
  const pidParse = ShopIdSchema.safeParse(productId);
  const sidParse = ShopIdSchema.safeParse(shopId);
  if (!pidParse.success || !sidParse.success) return { error: "Invalid ID" };

  const unitSize = formData.get("unit_size")?.toString() ?? "";
  const unitType = formData.get("unit_type")?.toString() ?? "";
  const unit = unitSize && unitType ? `${unitSize} ${unitType}` : (unitSize || unitType || undefined);

  const rawImages = formData.get("images")?.toString();
  let imagesList: string[] = [];
  try { imagesList = rawImages ? JSON.parse(rawImages) : []; } catch { imagesList = []; }

  const parse = ProductSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    brand: formData.get("brand")?.toString() || undefined,
    category: formData.get("category")?.toString() || undefined,
    unit,
    variant: formData.get("variant")?.toString() || undefined,
    description: formData.get("description")?.toString() || undefined,
    price: formData.get("price")?.toString() ?? "0",
    cost_price: formData.get("cost_price")?.toString() || undefined,
    stock: formData.get("stock")?.toString() ?? "0",
    low_stock_threshold: formData.get("low_stock_threshold")?.toString() ?? "5",
    barcode: formData.get("barcode")?.toString() || undefined,
    status: formData.get("status")?.toString() as "active" | "draft" | "archived" ?? "active",
    image_url: imagesList[0] ?? (formData.get("image_url")?.toString() ?? ""),
    images: imagesList,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { error } = await supabase
    .from("products")
    .update(parse.data)
    .eq("id", pidParse.data)
    .eq("shop_id", sidParse.data);

  if (error) return { error: `Could not update product: ${error.message}` };
  revalidatePath("/dashboard/owner/products");
  revalidatePath(`/dashboard/owner/products/${pidParse.data}/edit`);
  return { success: true };
}

export async function adjustStock(productId: string, shopId: string, delta: number) {
  const pidParse = ShopIdSchema.safeParse(productId);
  const sidParse = ShopIdSchema.safeParse(shopId);
  if (!pidParse.success || !sidParse.success) return { error: "Invalid ID" };
  if (!Number.isInteger(delta) || delta === 0) return { error: "Invalid delta" };

  const { supabase } = await getAuthUser();
  const { data: product } = await supabase
    .from("products")
    .select("stock")
    .eq("id", pidParse.data)
    .eq("shop_id", sidParse.data)
    .single();

  if (!product) return { error: "Product not found" };

  const newStock = Math.max(0, product.stock + delta);
  const { error } = await supabase
    .from("products")
    .update({ stock: newStock })
    .eq("id", pidParse.data)
    .eq("shop_id", sidParse.data);

  if (error) return { error: `Could not update stock: ${error.message}` };
  revalidatePath("/dashboard/owner/products");
  return { success: true, newStock };
}

export async function deleteProduct(productId: string, shopId: string) {
  const pidParse = ShopIdSchema.safeParse(productId);
  const sidParse = ShopIdSchema.safeParse(shopId);
  if (!pidParse.success || !sidParse.success) return { error: "Invalid ID" };

  const { supabase } = await getAuthUser();
  const { error } = await supabase
    .from("products")
    .update({ status: "archived" })
    .eq("id", pidParse.data)
    .eq("shop_id", sidParse.data);

  if (error) return { error: `Could not delete product: ${error.message}` };
  revalidatePath("/dashboard/owner/products");
  return { success: true };
}

// ─── Customers (Shop CRM) ─────────────────────────────────────────────────────

const ShopCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

export async function addShopCustomer(shopId: string, formData: FormData) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const parse = ShopCustomerSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    phone: formData.get("phone")?.toString() || undefined,
    email: formData.get("email")?.toString() || undefined,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.from("shop_customers").insert({
    shop_id: idParse.data,
    name: parse.data.name,
    phone: parse.data.phone ?? null,
    email: parse.data.email || null,
  });

  if (error?.code === "23505") return { error: "A customer with that phone already exists." };
  if (error) return { error: `Could not add customer: ${error.message}` };
  revalidatePath("/dashboard/owner/customers");
  return { success: true };
}

export async function settleUdhar(customerId: string, shopId: string, amount: number) {
  const cidParse = ShopIdSchema.safeParse(customerId);
  const sidParse = ShopIdSchema.safeParse(shopId);
  if (!cidParse.success || !sidParse.success) return { error: "Invalid ID" };
  if (amount <= 0) return { error: "Amount must be positive" };

  const { supabase } = await getAuthUser();

  const { data: customer } = await supabase
    .from("shop_customers")
    .select("udhar_balance")
    .eq("id", cidParse.data)
    .eq("shop_id", sidParse.data)
    .single();

  if (!customer) return { error: "Customer not found" };

  const newBalance = Math.max(0, (customer.udhar_balance ?? 0) - amount);

  const [updateResult, txnResult] = await Promise.all([
    supabase.from("shop_customers").update({ udhar_balance: newBalance })
      .eq("id", cidParse.data).eq("shop_id", sidParse.data),
    supabase.from("shop_transactions").insert({
      shop_id: sidParse.data,
      amount,
      type: "udhar_payment",
      reference_id: cidParse.data,
      description: `Udhar settled`,
      payment_method: "cash",
    }),
  ]);

  if (updateResult.error) return { error: "Could not settle udhar." };
  revalidatePath("/dashboard/owner/customers");
  return { success: true };
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

const SupplierSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(200),
  contact_person: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional(),
  category: z.string().trim().max(100).optional(),
});

export async function addSupplier(shopId: string, formData: FormData) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const parse = SupplierSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    contact_person: formData.get("contact_person")?.toString() || undefined,
    phone: formData.get("phone")?.toString() || undefined,
    email: formData.get("email")?.toString() || undefined,
    address: formData.get("address")?.toString() || undefined,
    category: formData.get("category")?.toString() || undefined,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.from("shop_suppliers").insert({
    shop_id: idParse.data,
    name: parse.data.name,
    contact_person: parse.data.contact_person ?? null,
    phone: parse.data.phone ?? null,
    email: parse.data.email || null,
    address: parse.data.address ?? null,
  });

  if (error) return { error: `Could not add supplier: ${error.message}` };
  revalidatePath("/dashboard/owner/suppliers");
  return { success: true };
}

export async function paySupplierDue(supplierId: string, shopId: string, amount: number) {
  const sidParse = ShopIdSchema.safeParse(supplierId);
  const shopIdParse = ShopIdSchema.safeParse(shopId);
  if (!sidParse.success || !shopIdParse.success) return { error: "Invalid ID" };
  if (amount <= 0) return { error: "Amount must be positive" };

  const { supabase } = await getAuthUser();

  const { data: supplier } = await supabase
    .from("shop_suppliers")
    .select("balance_due")
    .eq("id", sidParse.data)
    .eq("shop_id", shopIdParse.data)
    .single();

  if (!supplier) return { error: "Supplier not found" };

  const newBalance = Math.max(0, (supplier.balance_due ?? 0) - amount);

  const [updateResult] = await Promise.all([
    supabase.from("shop_suppliers").update({ balance_due: newBalance })
      .eq("id", sidParse.data).eq("shop_id", shopIdParse.data),
    supabase.from("shop_transactions").insert({
      shop_id: shopIdParse.data,
      amount,
      type: "supplier_payment",
      reference_id: sidParse.data,
      description: "Supplier payment",
      payment_method: "cash",
    }),
  ]);

  if (updateResult.error) return { error: "Could not record payment." };
  revalidatePath("/dashboard/owner/suppliers");
  return { success: true };
}

// ─── Staff ────────────────────────────────────────────────────────────────────

const StaffRoleSchema = z.enum(["manager", "cashier", "inventory", "viewer"]);

const ShopStaffSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  role: StaffRoleSchema.default("cashier"),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional(),
});

export async function addShopStaff(shopId: string, formData: FormData) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const parse = ShopStaffSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    role: formData.get("role")?.toString() ?? "cashier",
    phone: formData.get("phone")?.toString() || undefined,
    email: formData.get("email")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.from("shop_staff").insert({
    shop_id: idParse.data,
    name: parse.data.name,
    role: parse.data.role,
    phone: parse.data.phone ?? null,
    email: parse.data.email || null,
    notes: parse.data.notes ?? null,
  });

  if (error) return { error: `Could not add staff: ${error.message}` };
  revalidatePath("/dashboard/owner/staff");
  return { success: true };
}

export async function updateShopStaffStatus(staffId: string, shopId: string, status: "active" | "inactive") {
  const sidParse = ShopIdSchema.safeParse(staffId);
  const shopParse = ShopIdSchema.safeParse(shopId);
  if (!sidParse.success || !shopParse.success) return { error: "Invalid ID" };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.from("shop_staff")
    .update({ status })
    .eq("id", sidParse.data)
    .eq("shop_id", shopParse.data);

  if (error) return { error: "Could not update staff." };
  revalidatePath("/dashboard/owner/staff");
  return { success: true };
}

// ─── Orders ───────────────────────────────────────────────────────────────────

const OrderStatusValues = ["placed", "confirmed", "packing", "out_for_delivery", "delivered", "cancelled"] as const;

export async function updateOrderStatus(orderId: string, shopId: string, status: typeof OrderStatusValues[number]) {
  const oidParse = ShopIdSchema.safeParse(orderId);
  const sidParse = ShopIdSchema.safeParse(shopId);
  if (!oidParse.success || !sidParse.success) return { error: "Invalid ID" };
  if (!OrderStatusValues.includes(status)) return { error: "Invalid status" };

  const { supabase } = await getAuthUser();
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", oidParse.data)
    .eq("shop_id", sidParse.data);

  if (error) return { error: `Could not update order: ${error.message}` };
  revalidatePath("/dashboard/owner/orders");
  return { success: true };
}

// ─── Finances ─────────────────────────────────────────────────────────────────

const ExpenseSchema = z.object({
  amount: z.coerce.number().min(0.01).max(100000000),
  description: z.string().trim().min(1, "Description required").max(500),
  payment_method: z.enum(["cash", "card", "online", "udhar"]).default("cash"),
});

export async function addExpense(shopId: string, formData: FormData) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const parse = ExpenseSchema.safeParse({
    amount: formData.get("amount")?.toString() ?? "0",
    description: formData.get("description")?.toString() ?? "",
    payment_method: formData.get("payment_method")?.toString() ?? "cash",
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.from("shop_transactions").insert({
    shop_id: idParse.data,
    amount: parse.data.amount,
    type: "expense",
    description: parse.data.description,
    payment_method: parse.data.payment_method,
  });

  if (error) return { error: `Could not record expense: ${error.message}` };
  revalidatePath("/dashboard/owner/finances");
  return { success: true };
}

// ─── Shop Settings ────────────────────────────────────────────────────────────

const ShopSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(20).optional(),
  opening_time: z.string().trim().regex(TIME_REGEX, "Invalid time").optional().transform(v => v || undefined),
  closing_time: z.string().trim().regex(TIME_REGEX, "Invalid time").optional().transform(v => v || undefined),
});

export async function updateShopSettings(shopId: string, formData: FormData) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const parse = ShopSettingsSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() || undefined,
    phone: formData.get("phone")?.toString() || undefined,
    opening_time: formData.get("opening_time")?.toString() || undefined,
    closing_time: formData.get("closing_time")?.toString() || undefined,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.from("shops").update({
    name: parse.data.name,
    description: parse.data.description ?? null,
    phone: parse.data.phone ?? null,
    opening_time: parse.data.opening_time ?? null,
    closing_time: parse.data.closing_time ?? null,
  }).eq("id", idParse.data);

  if (error) return { error: `Could not save settings: ${error.message}` };
  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/owner/settings");
  return { success: true };
}

// ─── Storefront / Theme ───────────────────────────────────────────────────────

export async function updateStorefrontTheme(shopId: string, themeColor: string, themeLayout: "modern" | "list") {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.from("shops").update({
    theme_color: themeColor,
    theme_layout: themeLayout,
  }).eq("id", idParse.data);

  if (error) return { error: `Could not update theme: ${error.message}` };
  revalidatePath("/dashboard/owner/storefront");
  return { success: true };
}

// ─── POS ──────────────────────────────────────────────────────────────────────

export async function completePOSSale(
  shopId: string,
  items: Array<{ product_id: string; qty: number; name: string; price: number }>,
  total: number,
  paymentMethod: string,
  notes?: string
) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };
  if (!items.length) return { error: "Cart is empty" };

  const { supabase } = await getAuthUser();
  const { data, error } = await supabase.rpc("complete_pos_sale", {
    p_shop_id: idParse.data,
    p_items: items,
    p_total: total,
    p_payment_method: paymentMethod,
    p_notes: notes ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/owner/pos");
  revalidatePath("/dashboard/owner/products");
  return { success: true, transaction_id: data };
}

// ─── Delete Shop ──────────────────────────────────────────────────────────────

export async function deleteShop(shopId: string) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const { supabase, user } = await getAuthUser();

  // Must be the owner role
  const { data: member } = await supabase
    .from("shop_members")
    .select("role")
    .eq("shop_id", idParse.data)
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();

  if (!member) return { error: "You must be the shop owner to delete it." };

  // Clear active_shop_id if pointing to this shop so the user isn't stuck
  await supabase
    .from("profiles")
    .update({ active_shop_id: null })
    .eq("id", user.id)
    .eq("active_shop_id", idParse.data);

  const { error } = await supabase
    .from("shops")
    .delete()
    .eq("id", idParse.data);

  if (error) return { error: `Could not delete shop: ${error.message}` };

  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard");
  return { success: true };
}
