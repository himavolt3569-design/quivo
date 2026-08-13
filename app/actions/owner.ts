"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSiteUrl, isSafeHttpUrl } from "@/lib/security";
import { KYC_GRACE_DAYS, sendKycComplianceEmail } from "@/lib/kyc-compliance";
import { log } from "@/lib/log";
import { emitBackground } from "@/lib/events/emit";
import { orderTransitionError } from "@/lib/orders";
import {
  OptionalPhoneSchema,
  OptionalEmailSchema,
  ShopNameSchema,
  PersonNameSchema,
  OptionalAddressSchema,
  TimeOfDaySchema,
  OptionalShortText,
} from "@/lib/validation";

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,49}$/;

const OptionalUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || isSafeHttpUrl(v), "Invalid URL")
  .optional()
  .transform((v) => (v && v !== "" ? v : undefined));

const CreateShopSchema = z.object({
  name: ShopNameSchema,
  business_type: z.enum(["retailer", "wholesale"]).default("retailer"),
  category: z.enum(["kirana"]).default("kirana"),
  phone: OptionalPhoneSchema,
  address: OptionalAddressSchema,
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  description: OptionalShortText(500, "Description"),
  logo_url: OptionalUrl,
  pan_document_url: OptionalUrl,
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .max(50)
    .refine(
      (v) => v === "" || SUBDOMAIN_REGEX.test(v),
      "Subdomain must be 2–50 chars, lowercase letters/digits/hyphens",
    )
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  opening_time: TimeOfDaySchema.optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  closing_time: TimeOfDaySchema.optional()
    .or(z.literal(""))
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
      log.error("createShop: shops lookup failed", {
        code: lookupError.code,
        message: lookupError.message,
        details: lookupError.details,
      });
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
      return {
        error: "Could not generate a unique slug. Try a different shop name.",
      };
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
      p_opening_time: data.opening_time ? `${data.opening_time}:00` : null,
      p_closing_time: data.closing_time ? `${data.closing_time}:00` : null,
      p_site_origin: getSiteUrl(),
      p_verification_status: "unverified",
      p_kyc_confidence: null,
    },
  );

  if (rpcError) {
    log.error("createShop RPC error", {
      code: rpcError.code,
      message: rpcError.message,
      details: rpcError.details,
      hint: rpcError.hint,
    });
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
    log.error("createShop: RPC returned no row", { rpcData });
    return { error: "Shop creation returned no result. Check server logs." };
  }

  // Make the new shop the user's active shop. Best-effort: if the column
  // doesn't exist yet (migration 13 not applied), log and continue.
  const { error: activeError } = await supabase
    .from("profiles")
    .update({ active_shop_id: row.shop_id })
    .eq("id", user.id);
  if (activeError && activeError.code !== "42703") {
    log.error("createShop: could not set active_shop_id", {
      code: activeError.code,
      message: activeError.message,
    });
  }

  // Best-effort KYC welcome email — must NEVER block shop creation. The
  // shop is already inserted in the DB at this point; any email/network
  // failure here is informational only.
  if (user.email) {
    try {
      const graceEndsAt = new Date(
        Date.now() + KYC_GRACE_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const emailResult = await sendKycComplianceEmail({
        to: user.email,
        shopName: data.name,
        stage: "grace",
        graceEndsAt,
        daysRemaining: KYC_GRACE_DAYS,
      });
      if (emailResult.ok) {
        const { error: emailMarkError } = await supabase
          .from("shops")
          .update({ kyc_grace_email_sent_at: new Date().toISOString() })
          .eq("id", row.shop_id);
        if (emailMarkError && emailMarkError.code !== "42703") {
          log.error("createShop: could not mark KYC email sent", {
            code: emailMarkError.code,
            message: emailMarkError.message,
          });
        }
      }
    } catch (err) {
      log.error("createShop: KYC welcome email threw", {
        err: err instanceof Error ? err.message : String(err),
      });
      // Continue — the shop already exists.
    }
  }

  // Burn the onboarding intent cookie so a fresh URL hit re-triggers the gate.
  try {
    const { clearOnboardingIntent } = await import("@/app/actions/onboarding");
    await clearOnboardingIntent();
  } catch {
    /* best-effort */
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
    log.error("setActiveShop: membership check failed", {
      code: memberError.code,
      message: memberError.message,
      details: memberError.details,
      hint: memberError.hint,
    });
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
    log.error("setActiveShop: profile update failed", {
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
    });
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
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
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
  const unit =
    unitSize && unitType
      ? `${unitSize} ${unitType}`
      : unitSize || unitType || undefined;

  const rawImages = formData.get("images")?.toString();
  let imagesList: string[] = [];
  try {
    imagesList = rawImages ? JSON.parse(rawImages) : [];
  } catch {
    imagesList = [];
  }

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
    image_url: imagesList[0] ?? formData.get("image_url")?.toString() ?? "",
    images: imagesList,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { data, error } = await supabase
    .from("products")
    .insert({ shop_id: idParse.data, ...parse.data })
    .select("id, barcode")
    .single();

  if (error) {
    if (
      error.code === "23505" &&
      error.message.includes("idx_products_barcode_unique")
    ) {
      return {
        error: "A product with this barcode already exists in this shop.",
      };
    }
    return { error: `Could not add product: ${error.message}` };
  }
  revalidatePath("/dashboard/owner/products");
  return { success: true, id: data.id, barcode: data.barcode };
}

export async function restockProduct(
  productId: string,
  shopId: string,
  addQty: number,
  costPrice: number | null,
  newPrice: number | null,
): Promise<{ error?: string; newStock?: number; barcode?: string }> {
  const pidParse = ShopIdSchema.safeParse(productId);
  const sidParse = ShopIdSchema.safeParse(shopId);
  if (!pidParse.success || !sidParse.success) return { error: "Invalid ID" };
  if (addQty <= 0) return { error: "Quantity must be greater than 0" };

  const { supabase } = await getAuthUser();
  const { data, error } = await supabase
    .rpc("restock_product", {
      p_product_id: pidParse.data,
      p_shop_id: sidParse.data,
      p_add_qty: addQty,
      p_cost_price: costPrice ?? undefined,
      p_new_price: newPrice ?? undefined,
    })
    .single<{ new_stock: number; barcode: string }>();

  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner/products");
  return { newStock: data.new_stock, barcode: data.barcode };
}

export async function updateProduct(
  productId: string,
  shopId: string,
  formData: FormData,
) {
  const pidParse = ShopIdSchema.safeParse(productId);
  const sidParse = ShopIdSchema.safeParse(shopId);
  if (!pidParse.success || !sidParse.success) return { error: "Invalid ID" };

  const unitSize = formData.get("unit_size")?.toString() ?? "";
  const unitType = formData.get("unit_type")?.toString() ?? "";
  const unit =
    unitSize && unitType
      ? `${unitSize} ${unitType}`
      : unitSize || unitType || undefined;

  const rawImages = formData.get("images")?.toString();
  let imagesList: string[] = [];
  try {
    imagesList = rawImages ? JSON.parse(rawImages) : [];
  } catch {
    imagesList = [];
  }

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
    status:
      (formData.get("status")?.toString() as "active" | "draft" | "archived") ??
      "active",
    image_url: imagesList[0] ?? formData.get("image_url")?.toString() ?? "",
    images: imagesList,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const { error } = await supabase
    .from("products")
    .update(parse.data)
    .eq("id", pidParse.data)
    .eq("shop_id", sidParse.data);

  if (error) {
    if (
      error.code === "23505" &&
      error.message.includes("idx_products_barcode_unique")
    ) {
      return {
        error: "A product with this barcode already exists in this shop.",
      };
    }
    return { error: `Could not update product: ${error.message}` };
  }
  revalidatePath("/dashboard/owner/products");
  revalidatePath(`/dashboard/owner/products/${pidParse.data}/edit`);
  return { success: true };
}

export async function adjustStock(
  productId: string,
  shopId: string,
  delta: number,
) {
  const pidParse = ShopIdSchema.safeParse(productId);
  const sidParse = ShopIdSchema.safeParse(shopId);
  if (!pidParse.success || !sidParse.success) return { error: "Invalid ID" };
  if (!Number.isInteger(delta) || delta === 0)
    return { error: "Invalid delta" };

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
  name: PersonNameSchema,
  phone: OptionalPhoneSchema,
  email: OptionalEmailSchema,
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

  if (error?.code === "23505")
    return { error: "A customer with that phone already exists." };
  if (error) return { error: `Could not add customer: ${error.message}` };
  revalidatePath("/dashboard/owner/customers");
  return { success: true };
}

export async function settleUdhar(
  customerId: string,
  shopId: string,
  amount: number,
) {
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
    supabase
      .from("shop_customers")
      .update({ udhar_balance: newBalance })
      .eq("id", cidParse.data)
      .eq("shop_id", sidParse.data),
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
  name: ShopNameSchema,
  contact_person: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((v) => (v == null ? "" : v.trim()))
    .refine(
      (v) => v === "" || v.length >= 2,
      "Contact name must be at least 2 characters",
    )
    .refine((v) => v.length <= 120, "Contact name is too long")
    .transform((v) => (v === "" ? undefined : v)),
  phone: OptionalPhoneSchema,
  email: OptionalEmailSchema,
  address: OptionalAddressSchema,
  category: OptionalShortText(100, "Category"),
  logo_url: OptionalUrl,
  tax_id: OptionalShortText(80, "Tax ID"),
  notes: OptionalShortText(500, "Notes"),
  opening_balance: z.coerce
    .number()
    .min(0, "Opening balance cannot be negative")
    .max(99_999_999)
    .default(0),
});

const SupplierLedgerEntrySchema = z.object({
  entry_type: z.enum([
    "purchase",
    "payment",
    "credit_adjustment",
    "debit_adjustment",
  ]),
  amount: z.coerce.number().positive("Amount must be positive").max(99999999),
  description: z.string().trim().max(240).optional(),
  payment_method: z.enum(["cash", "card", "online", "udhar"]).default("cash"),
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
    logo_url: formData.get("logo_url")?.toString() || undefined,
    tax_id: formData.get("tax_id")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
    opening_balance: formData.get("opening_balance")?.toString() || "0",
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
    category: parse.data.category ?? null,
    logo_url: parse.data.logo_url ?? null,
    tax_id: parse.data.tax_id ?? null,
    notes: parse.data.notes ?? null,
    opening_balance: parse.data.opening_balance,
    balance_due: parse.data.opening_balance,
  });

  if (error) return { error: `Could not add supplier: ${error.message}` };
  revalidatePath("/dashboard/owner/suppliers");
  return { success: true };
}

export async function paySupplierDue(
  supplierId: string,
  shopId: string,
  amount: number,
) {
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
    supabase
      .from("shop_suppliers")
      .update({ balance_due: newBalance })
      .eq("id", sidParse.data)
      .eq("shop_id", shopIdParse.data),
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

export async function recordSupplierLedgerEntry(
  supplierId: string,
  shopId: string,
  formData: FormData,
) {
  const sidParse = ShopIdSchema.safeParse(supplierId);
  const shopIdParse = ShopIdSchema.safeParse(shopId);
  if (!sidParse.success || !shopIdParse.success) return { error: "Invalid ID" };

  const parse = SupplierLedgerEntrySchema.safeParse({
    entry_type: formData.get("entry_type")?.toString() ?? "purchase",
    amount: formData.get("amount")?.toString() ?? "",
    description: formData.get("description")?.toString() || undefined,
    payment_method: formData.get("payment_method")?.toString() || "cash",
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();

  const { data: supplier } = await supabase
    .from("shop_suppliers")
    .select("balance_due, name")
    .eq("id", sidParse.data)
    .eq("shop_id", shopIdParse.data)
    .single();

  if (!supplier) return { error: "Supplier not found" };

  const isCredit =
    parse.data.entry_type === "purchase" ||
    parse.data.entry_type === "credit_adjustment";
  const currentBalance = Number(supplier.balance_due ?? 0);
  const nextBalance = isCredit
    ? currentBalance + parse.data.amount
    : Math.max(0, currentBalance - parse.data.amount);

  const defaultDescription =
    parse.data.entry_type === "purchase"
      ? `Purchase from ${supplier.name}`
      : parse.data.entry_type === "payment"
        ? `Payment to ${supplier.name}`
        : parse.data.entry_type === "credit_adjustment"
          ? `Credit adjustment for ${supplier.name}`
          : `Debit adjustment for ${supplier.name}`;

  const [updateResult, insertResult] = await Promise.all([
    supabase
      .from("shop_suppliers")
      .update({ balance_due: nextBalance })
      .eq("id", sidParse.data)
      .eq("shop_id", shopIdParse.data),
    supabase.from("shop_transactions").insert({
      shop_id: shopIdParse.data,
      amount: parse.data.amount,
      type: isCredit ? "expense" : "supplier_payment",
      reference_id: sidParse.data,
      description: parse.data.description || defaultDescription,
      payment_method: isCredit ? "udhar" : parse.data.payment_method,
    }),
  ]);

  if (updateResult.error || insertResult.error) {
    return { error: "Could not record supplier ledger entry." };
  }

  revalidatePath("/dashboard/owner/suppliers");
  revalidatePath(`/dashboard/owner/suppliers/${sidParse.data}`);
  return { success: true };
}

// ─── Staff ────────────────────────────────────────────────────────────────────

const StaffRoleSchema = z.enum(["manager", "cashier", "inventory", "viewer"]);

const ShopStaffSchema = z.object({
  name: PersonNameSchema,
  role: StaffRoleSchema.default("cashier"),
  phone: OptionalPhoneSchema,
  email: OptionalEmailSchema,
  notes: OptionalShortText(500, "Notes"),
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

  const imageUrl = formData.get("image_url")?.toString() || null;

  const { supabase } = await getAuthUser();
  const { error } = await supabase.from("shop_staff").insert({
    shop_id: idParse.data,
    name: parse.data.name,
    role: parse.data.role,
    phone: parse.data.phone ?? null,
    email: parse.data.email || null,
    notes: parse.data.notes ?? null,
    image_url: imageUrl,
  });

  if (error) return { error: `Could not add staff: ${error.message}` };
  revalidatePath("/dashboard/owner/staff");
  return { success: true };
}

export async function updateShopStaffStatus(
  staffId: string,
  shopId: string,
  status: "active" | "inactive",
) {
  const sidParse = ShopIdSchema.safeParse(staffId);
  const shopParse = ShopIdSchema.safeParse(shopId);
  if (!sidParse.success || !shopParse.success) return { error: "Invalid ID" };

  const { supabase } = await getAuthUser();
  const { error } = await supabase
    .from("shop_staff")
    .update({ status })
    .eq("id", sidParse.data)
    .eq("shop_id", shopParse.data);

  if (error) return { error: "Could not update staff." };
  revalidatePath("/dashboard/owner/staff");
  return { success: true };
}

// ─── Orders ───────────────────────────────────────────────────────────────────

const OrderStatusValues = [
  "placed",
  "confirmed",
  "packing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export async function updateOrderStatus(
  orderId: string,
  status: (typeof OrderStatusValues)[number],
  expectedStatus?: (typeof OrderStatusValues)[number],
  reason?: string,
) {
  const oidParse = ShopIdSchema.safeParse(orderId);
  if (!oidParse.success) return { error: "Invalid ID" };
  if (!OrderStatusValues.includes(status)) return { error: "Invalid status" };

  const { supabase } = await getAuthUser();
  const { data, error } = await supabase
    .rpc("transition_order_status", {
      p_order_id: oidParse.data,
      p_new_status: status,
      p_expected_status: expectedStatus ?? null,
      p_reason: reason ?? null,
    })
    .maybeSingle<{ status: string; payment_status: string }>();

  if (error) return { error: orderTransitionError(error.message) };
  revalidatePath("/dashboard/owner/orders");
  return {
    success: true as const,
    status: data?.status,
    paymentStatus: data?.payment_status,
  };
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

// IANA timezone names — short whitelist; UI ships a select restricted to these.
const TimezoneSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .refine(
    (v) => /^[A-Za-z_]+\/[A-Za-z_+/-]+$|^UTC$/.test(v),
    "Invalid timezone",
  );

const ShopSettingsSchema = z.object({
  name: ShopNameSchema,
  description: OptionalShortText(500, "Description"),
  phone: OptionalPhoneSchema,
  opening_time: TimeOfDaySchema.optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  closing_time: TimeOfDaySchema.optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  vat_registered: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .optional(),
  vat_rate: z.coerce.number().min(0).max(100).optional(),
  pan_number: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  timezone: TimezoneSchema.optional(),
});

export async function updateShopSettings(shopId: string, formData: FormData) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const rawVatRegistered = formData.get("vat_registered");
  const rawVatRate = formData.get("vat_rate");
  const rawPan = formData.get("pan_number");
  const rawTz = formData.get("timezone");

  const parse = ShopSettingsSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    description: formData.get("description")?.toString() || undefined,
    phone: formData.get("phone")?.toString() || undefined,
    opening_time: formData.get("opening_time")?.toString() || undefined,
    closing_time: formData.get("closing_time")?.toString() || undefined,
    vat_registered:
      rawVatRegistered === null ? undefined : rawVatRegistered.toString(),
    vat_rate:
      rawVatRate === null || rawVatRate === ""
        ? undefined
        : rawVatRate.toString(),
    pan_number: rawPan === null ? undefined : rawPan.toString(),
    timezone: rawTz === null || rawTz === "" ? undefined : rawTz.toString(),
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  const { supabase } = await getAuthUser();
  const update: Record<string, unknown> = {
    name: parse.data.name,
    description: parse.data.description ?? null,
    phone: parse.data.phone ?? null,
    opening_time: parse.data.opening_time ? `${parse.data.opening_time}:00` : null,
    closing_time: parse.data.closing_time ? `${parse.data.closing_time}:00` : null,
  };
  if (parse.data.vat_registered !== undefined)
    update.vat_registered = parse.data.vat_registered;
  if (parse.data.vat_rate !== undefined) update.vat_rate = parse.data.vat_rate;
  if (parse.data.pan_number !== undefined)
    update.pan_number = parse.data.pan_number ?? null;
  if (parse.data.timezone !== undefined) update.timezone = parse.data.timezone;

  const { error } = await supabase
    .from("shops")
    .update(update)
    .eq("id", idParse.data);

  if (error) return { error: `Could not save settings: ${error.message}` };
  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/owner/settings");
  return { success: true };
}

// ─── Storefront / Theme ───────────────────────────────────────────────────────

export async function updateStorefrontTheme(
  shopId: string,
  themeColor: string,
  themeLayout: "modern" | "list",
) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const { supabase } = await getAuthUser();
  const { error } = await supabase
    .from("shops")
    .update({
      theme_color: themeColor,
      theme_layout: themeLayout,
    })
    .eq("id", idParse.data);

  if (error) return { error: `Could not update theme: ${error.message}` };
  revalidatePath("/dashboard/owner/storefront");
  return { success: true };
}

// ─── POS ──────────────────────────────────────────────────────────────────────

export interface POSSaleLine {
  product_id: string;
  qty: number;
  name: string;
  unit_price: number;
  line_discount: number;
}

export interface POSSaleSplit {
  method: "cash" | "card" | "online" | "udhar" | "wallet" | "qr";
  amount: number;
  reference?: string | null;
}

export interface POSSaleInput {
  shopId: string;
  items: POSSaleLine[];
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
  splits?: POSSaleSplit[] | null;
  notes?: string | null;
}

export async function completePOSSale(input: POSSaleInput) {
  const idParse = ShopIdSchema.safeParse(input.shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };
  if (!input.items?.length) return { error: "Cart is empty" };

  const { supabase } = await getAuthUser();
  // Phase 3: prefer FEFO v4 (drains soonest-expiry batch first); falls back
  // to legacy products.stock for products without batches.
  const { data, error } = await supabase.rpc("complete_pos_sale_v4", {
    p_shop_id: idParse.data,
    p_items: input.items,
    p_subtotal: input.subtotal,
    p_discount: input.discount,
    p_tax_rate: input.taxRate,
    p_tax_amount: input.taxAmount,
    p_total: input.total,
    p_payment_method: input.paymentMethod,
    p_notes: input.notes ?? null,
    p_split_payments:
      input.splits && input.splits.length > 0 ? input.splits : null,
  });

  if (error) return { error: error.message };

  // Fire-and-forget the domain event for downstream consumers (email, in-app
  // notifications). Phase 2 wires the handler; today the row sits unprocessed.
  if (data) {
    emitBackground({
      name: "transaction.completed",
      payload: {
        transaction_id: data as string,
        shop_id: idParse.data,
        total: input.total,
        tax_amount: input.taxAmount,
        payment_method:
          input.splits && input.splits.length > 0
            ? "split"
            : input.paymentMethod,
        item_count: input.items.length,
      },
      shopId: idParse.data,
      aggregateId: data as string,
      idempotencyKey: `pos:${data}`,
    });
  }

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

export async function submitKYCDocuments(shopId: string, docUrls: string[]) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };
  if (!docUrls.length) return { error: "Upload at least one document." };

  const { supabase } = await getAuthUser();
  const { error } = await supabase.rpc("submit_kyc_review", {
    p_shop_id: idParse.data,
    p_doc_urls: docUrls,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/owner");
  revalidatePath("/dashboard/owner/settings");
  return { success: true };
}

export async function getKYCStatus(shopId: string) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const { supabase } = await getAuthUser();
  const { data, error } = await supabase
    .from("shops")
    .select(
      "verification_status, kyc_submitted_at, kyc_rejection_reason, kyc_document_urls, kyc_confidence",
    )
    .eq("id", idParse.data)
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function deleteShopCustomer(customerId: string, shopId: string) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const { supabase } = await getAuthUser();

  // Verify customer belongs to shop
  const { data: customer } = await supabase
    .from("shop_customers")
    .select("udhar_balance")
    .eq("id", customerId)
    .eq("shop_id", idParse.data)
    .single();

  if (!customer) return { error: "Customer not found." };
  if (customer.udhar_balance > 0)
    return { error: "Cannot delete customer with pending Udhar." };

  const { error } = await supabase
    .from("shop_customers")
    .delete()
    .eq("id", customerId)
    .eq("shop_id", idParse.data);

  if (error) return { error: `Could not delete customer: ${error.message}` };

  revalidatePath("/dashboard/owner/customers");
  return { success: true };
}
