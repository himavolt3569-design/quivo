"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSiteUrl, isSafeHttpUrl } from "@/lib/security";
import { KYC_GRACE_DAYS, sendKycComplianceEmail } from "@/lib/kyc-compliance";
import { log } from "@/lib/log";
import { emitBackground } from "@/lib/events/emit";
import { prisma } from "@/lib/prisma";
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
    try {
      const existing = await prisma.shops.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) break;
    } catch (e: any) {
      log.error("createShop: shops lookup failed", { error: e.message });
      if (e.message?.includes("does not exist")) {
        return {
          error: "Shop tables are not set up yet. Check database configuration."
        };
      }
      return { error: `Database error: ${e.message}` };
    }

    slug = `${base}-${randomSuffix()}`;
    if (attempt === 7) {
      return {
        error: "Could not generate a unique slug. Try a different shop name.",
      };
    }
  }

  let shopId: string;
  let qrToken: string;
  let qrTargetUrl: string;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const newShop = await tx.shops.create({
        data: {
          name: data.name,
          slug,
          owner_id: user.id,
          business_type: data.business_type,
          category: data.category,
          phone: data.phone || null,
          address: data.address || null,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
          description: data.description || null,
          logo_url: data.logo_url ?? null,
          pan_document_url: data.pan_document_url ?? null,
          subdomain: data.subdomain ?? null,
          opening_time: data.opening_time ? new Date(`1970-01-01T${data.opening_time}:00Z`) : null,
          closing_time: data.closing_time ? new Date(`1970-01-01T${data.closing_time}:00Z`) : null,
          status: "active",
          verification_status: "unverified",
          kyc_confidence: null,
          shop_members: {
            create: {
              user_id: user.id,
              role: "owner",
              status: "active",
            },
          },
        },
      });

      const generatedQrToken = Math.random().toString(16).slice(2, 14); // basic hex
      const generatedQrTargetUrl = `${getSiteUrl()}/s/${slug}`;

      const qrCode = await tx.shop_qr_codes.create({
        data: {
          shop_id: newShop.id,
          qr_token: generatedQrToken,
          qr_target_url: generatedQrTargetUrl,
          is_primary: true,
          is_active: true,
        },
      });

      return { newShop, qrCode };
    });

    shopId = result.newShop.id;
    qrToken = result.qrCode.qr_token;
    qrTargetUrl = result.qrCode.qr_target_url;

    await prisma.profiles.update({
      where: { id: user.id },
      data: {
        role: "owner",
        active_shop_id: shopId,
      },
    }).catch(e => {
      log.error("createShop: could not update profile", { error: e.message });
    });

  } catch (err: any) {
    if (err.code === "P2002") {
      return { error: "A shop with that name or subdomain already exists." };
    }
    return { error: `Database error: ${err.message}` };
  }

  // Best-effort KYC welcome email
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
        await prisma.shops.update({
          where: { id: shopId },
          data: { kyc_grace_email_sent_at: new Date() },
        }).catch(e => log.error("createShop: could not mark KYC email sent", { error: e.message }));
      }
    } catch (err) {
      log.error("createShop: KYC welcome email threw", {
        err: err instanceof Error ? err.message : String(err),
      });
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
    shop_id: shopId,
    slug,
    qr_token: qrToken,
    qr_target_url: qrTargetUrl,
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

  const member = await prisma.shop_members.findFirst({
    where: {
      user_id: user.id,
      shop_id: parse.data,
      status: "active",
    },
    select: { shop_id: true }
  }).catch(e => {
    log.error("setActiveShop: membership check failed", { error: e.message });
    return null; // Will trigger the !member check below
  });

  if (!member) return { error: "You are not a member of that shop or the check failed." };

  try {
    await prisma.profiles.update({
      where: { id: user.id },
      data: { active_shop_id: parse.data }
    });
  } catch (updateError: any) {
    log.error("setActiveShop: profile update failed", { error: updateError.message });
    if (updateError.message?.includes("active_shop_id")) {
      return {
        error:
          "active_shop_id column missing. Check database schema.",
      };
    }
    return {
      error: `Update failed: ${updateError.message}`,
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
  max_stock: z.coerce.number().int().min(0).max(1000000).optional(),
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
    max_stock: formData.get("max_stock")?.toString() || undefined,
    barcode: formData.get("barcode")?.toString() || undefined,
    status: "active",
    image_url: imagesList[0] ?? formData.get("image_url")?.toString() ?? "",
    images: imagesList,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  try {
    const data = await prisma.products.create({
      data: {
        shop_id: idParse.data,
        ...parse.data,
      },
      select: { id: true, barcode: true },
    });
    
    revalidatePath("/dashboard/owner/products");
    return { success: true, id: data.id, barcode: data.barcode };
  } catch (error: any) {
    if (error.code === "P2002" && error.message.includes("barcode")) {
      return {
        error: "A product with this barcode already exists in this shop.",
      };
    }
    return { error: `Could not add product: ${error.message}` };
  }
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

  try {
    // Cannot easily call rpc("restock_product") via Prisma. We should just do a raw query to execute the function.
    const result: any[] = await prisma.$queryRaw`
      SELECT new_stock, barcode FROM restock_product(
        ${pidParse.data}::uuid,
        ${sidParse.data}::uuid,
        ${addQty}::numeric,
        ${costPrice ?? null}::numeric,
        ${newPrice ?? null}::numeric
      )
    `;

    if (!result || result.length === 0) {
      return { error: "Failed to restock product." };
    }

    revalidatePath("/dashboard/owner/products");
    return { newStock: Number(result[0].new_stock), barcode: result[0].barcode };
  } catch (error: any) {
    return { error: error.message };
  }
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
    max_stock: formData.get("max_stock")?.toString() || undefined,
    barcode: formData.get("barcode")?.toString() || undefined,
    status:
      (formData.get("status")?.toString() as "active" | "draft" | "archived") ??
      "active",
    image_url: imagesList[0] ?? formData.get("image_url")?.toString() ?? "",
    images: imagesList,
  });
  if (!parse.success) return { error: parse.error.issues[0].message };

  try {
    await prisma.products.update({
      where: {
        id: pidParse.data,
        shop_id: sidParse.data,
      },
      data: parse.data,
    });
    
    revalidatePath("/dashboard/owner/products");
    revalidatePath(`/dashboard/owner/products/${pidParse.data}/edit`);
    return { success: true };
  } catch (error: any) {
    if (error.code === "P2002" && error.message.includes("barcode")) {
      return {
        error: "A product with this barcode already exists in this shop.",
      };
    }
    return { error: `Could not update product: ${error.message}` };
  }
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

  try {
    const product = await prisma.products.findUnique({
      where: {
        id: pidParse.data,
        shop_id: sidParse.data,
      },
      select: { stock: true },
    });

    if (!product) return { error: "Product not found" };

    const newStock = Math.max(0, Number(product.stock) + delta);
    
    await prisma.products.update({
      where: {
        id: pidParse.data,
      },
      data: { stock: newStock },
    });

    revalidatePath("/dashboard/owner/products");
    return { success: true, newStock };
  } catch (error: any) {
    return { error: `Could not update stock: ${error.message}` };
  }
}

export async function deleteProduct(productId: string, shopId: string) {
  const pidParse = ShopIdSchema.safeParse(productId);
  const sidParse = ShopIdSchema.safeParse(shopId);
  if (!pidParse.success || !sidParse.success) return { error: "Invalid ID" };

  try {
    await prisma.products.update({
      where: {
        id: pidParse.data,
        shop_id: sidParse.data,
      },
      data: { status: "archived" },
    });
    
    revalidatePath("/dashboard/owner/products");
    return { success: true };
  } catch (error: any) {
    return { error: `Could not delete product: ${error.message}` };
  }
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

  try {
    await prisma.shop_customers.create({
      data: {
        shop_id: idParse.data,
        name: parse.data.name,
        phone: parse.data.phone ?? null,
        email: parse.data.email || null,
      }
    });
    
    revalidatePath("/dashboard/owner/customers");
    return { success: true };
  } catch (error: any) {
    if (error.code === "P2002" && error.message.includes("phone")) {
      return { error: "A customer with that phone already exists." };
    }
    return { error: `Could not add customer: ${error.message}` };
  }
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

  try {
    const customer = await prisma.shop_customers.findUnique({
      where: {
        id: cidParse.data,
        shop_id: sidParse.data,
      },
      select: { udhar_balance: true },
    });

    if (!customer) return { error: "Customer not found" };

    const newBalance = Math.max(0, Number(customer.udhar_balance ?? 0) - amount);

    await prisma.$transaction(async (tx) => {
      await tx.shop_customers.update({
        where: { id: cidParse.data },
        data: { udhar_balance: newBalance },
      });

      await tx.shop_transactions.create({
        data: {
          shop_id: sidParse.data,
          amount,
          type: "udhar_payment",
          reference_id: cidParse.data,
          description: `Udhar settled`,
          payment_method: "cash",
        }
      });
    });

    revalidatePath("/dashboard/owner/customers");
    return { success: true };
  } catch (error: any) {
    return { error: "Could not settle udhar." };
  }
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

  try {
    await prisma.shop_suppliers.create({
      data: {
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
      }
    });

    revalidatePath("/dashboard/owner/suppliers");
    return { success: true };
  } catch (error: any) {
    return { error: `Could not add supplier: ${error.message}` };
  }
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

  try {
    const supplier = await prisma.shop_suppliers.findUnique({
      where: {
        id: sidParse.data,
        shop_id: shopIdParse.data,
      },
      select: { balance_due: true },
    });

    if (!supplier) return { error: "Supplier not found" };

    const newBalance = Math.max(0, Number(supplier.balance_due ?? 0) - amount);

    await prisma.$transaction(async (tx) => {
      await tx.shop_suppliers.update({
        where: { id: sidParse.data },
        data: { balance_due: newBalance },
      });

      await tx.shop_transactions.create({
        data: {
          shop_id: shopIdParse.data,
          amount,
          type: "supplier_payment",
          reference_id: sidParse.data,
          description: "Supplier payment",
          payment_method: "cash",
        }
      });
    });

    revalidatePath("/dashboard/owner/suppliers");
    return { success: true };
  } catch (error: any) {
    return { error: "Could not record payment." };
  }
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

  try {
    const supplier = await prisma.shop_suppliers.findUnique({
      where: {
        id: sidParse.data,
        shop_id: shopIdParse.data,
      },
      select: { balance_due: true, name: true },
    });

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

    await prisma.$transaction(async (tx) => {
      await tx.shop_suppliers.update({
        where: { id: sidParse.data },
        data: { balance_due: nextBalance },
      });

      await tx.shop_transactions.create({
        data: {
          shop_id: shopIdParse.data,
          amount: parse.data.amount,
          type: isCredit ? "expense" : "supplier_payment",
          reference_id: sidParse.data,
          description: parse.data.description || defaultDescription,
          payment_method: isCredit ? "udhar" : parse.data.payment_method,
        }
      });
    });

    revalidatePath("/dashboard/owner/suppliers");
    revalidatePath(`/dashboard/owner/suppliers/${sidParse.data}`);
    return { success: true };
  } catch (error: any) {
    return { error: "Could not record supplier ledger entry." };
  }
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

  try {
    await prisma.shop_staff.create({
      data: {
        shop_id: idParse.data,
        name: parse.data.name,
        role: parse.data.role,
        phone: parse.data.phone ?? null,
        email: parse.data.email || null,
        notes: parse.data.notes ?? null,
        image_url: imageUrl,
      }
    });

    revalidatePath("/dashboard/owner/staff");
    return { success: true };
  } catch (error: any) {
    return { error: `Could not add staff: ${error.message}` };
  }
}

export async function updateShopStaffStatus(
  staffId: string,
  shopId: string,
  status: "active" | "inactive",
) {
  const sidParse = ShopIdSchema.safeParse(staffId);
  const shopParse = ShopIdSchema.safeParse(shopId);
  if (!sidParse.success || !shopParse.success) return { error: "Invalid ID" };

  try {
    await prisma.shop_staff.update({
      where: {
        id: sidParse.data,
        shop_id: shopParse.data,
      },
      data: { status }
    });

    revalidatePath("/dashboard/owner/staff");
    return { success: true };
  } catch (error: any) {
    return { error: "Could not update staff." };
  }
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
  shopId: string,
  status: (typeof OrderStatusValues)[number],
) {
  const oidParse = ShopIdSchema.safeParse(orderId);
  const sidParse = ShopIdSchema.safeParse(shopId);
  if (!oidParse.success || !sidParse.success) return { error: "Invalid ID" };
  if (!OrderStatusValues.includes(status)) return { error: "Invalid status" };

  try {
    await prisma.orders.update({
      where: {
        id: oidParse.data,
        shop_id: sidParse.data,
      },
      data: { status }
    });

    revalidatePath("/dashboard/owner/orders");
    return { success: true };
  } catch (error: any) {
    return { error: `Could not update order: ${error.message}` };
  }
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

  try {
    await prisma.shop_transactions.create({
      data: {
        shop_id: idParse.data,
        amount: parse.data.amount,
        type: "expense",
        description: parse.data.description,
        payment_method: parse.data.payment_method,
      }
    });

    revalidatePath("/dashboard/owner/finances");
    return { success: true };
  } catch (error: any) {
    return { error: `Could not record expense: ${error.message}` };
  }
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
    opening_time: parse.data.opening_time ?? null,
    closing_time: parse.data.closing_time ?? null,
  };
  if (parse.data.vat_registered !== undefined)
    update.vat_registered = parse.data.vat_registered;
  if (parse.data.vat_rate !== undefined) update.vat_rate = parse.data.vat_rate;
  if (parse.data.pan_number !== undefined)
    update.pan_number = parse.data.pan_number ?? null;
  if (parse.data.timezone !== undefined) update.timezone = parse.data.timezone;

  try {
    await prisma.shops.update({
      where: { id: idParse.data },
      data: update
    });

    revalidatePath("/dashboard/owner");
    revalidatePath("/dashboard/owner/settings");
    return { success: true };
  } catch (error: any) {
    return { error: `Could not save settings: ${error.message}` };
  }
}

// ─── Storefront / Theme ───────────────────────────────────────────────────────

export async function updateStorefrontTheme(
  shopId: string,
  themeColor: string,
  themeLayout: "modern" | "list",
) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  try {
    await prisma.shops.update({
      where: { id: idParse.data },
      data: {
        theme_color: themeColor,
        theme_layout: themeLayout,
      }
    });

    revalidatePath("/dashboard/owner/storefront");
    return { success: true };
  } catch (error: any) {
    return { error: `Could not update theme: ${error.message}` };
  }
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

  try {
    const result = await prisma.$queryRaw`
      SELECT complete_pos_sale_v4(
        ${idParse.data}::uuid,
        ${JSON.stringify(input.items)}::jsonb,
        ${input.subtotal}::numeric,
        ${input.discount}::numeric,
        ${input.taxRate}::numeric,
        ${input.taxAmount}::numeric,
        ${input.total}::numeric,
        ${input.paymentMethod},
        ${input.notes ?? null},
        ${input.splits && input.splits.length > 0 ? JSON.stringify(input.splits) : null}::jsonb
      ) as transaction_id;
    `;
    const data = (result as any[])[0]?.transaction_id;


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
  } catch (error: any) {
    return { error: `Transaction failed: ${error.message}` };
  }
}

// ─── Delete Shop ──────────────────────────────────────────────────────────────

export async function deleteShop(shopId: string) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  const { user } = await getAuthUser();

  try {
    const member = await prisma.shop_members.findFirst({
      where: {
        shop_id: idParse.data,
        user_id: user.id,
        role: "owner",
        status: "active",
      },
      select: { role: true }
    });

    if (!member) return { error: "You must be the shop owner to delete it." };

    await prisma.$transaction(async (tx) => {
      await tx.profiles.updateMany({
        where: {
          id: user.id,
          active_shop_id: idParse.data,
        },
        data: { active_shop_id: null },
      });

      await tx.shops.delete({
        where: { id: idParse.data },
      });
    });

    revalidatePath("/dashboard/owner");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    return { error: `Could not delete shop: ${error.message}` };
  }
}

export async function submitKYCDocuments(shopId: string, docUrls: string[]) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };
  if (!docUrls.length) return { error: "Upload at least one document." };

  try {
    await prisma.$queryRaw`
      SELECT submit_kyc_review(
        ${idParse.data}::uuid,
        ${docUrls}::text[]
      );
    `;
    
    revalidatePath("/dashboard/owner");
    revalidatePath("/dashboard/owner/settings");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getKYCStatus(shopId: string) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  try {
    const data = await prisma.shops.findUnique({
      where: { id: idParse.data },
      select: {
        verification_status: true,
        kyc_submitted_at: true,
        kyc_rejection_reason: true,
        kyc_document_urls: true,
        kyc_confidence: true,
      }
    });

    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteShopCustomer(customerId: string, shopId: string) {
  const idParse = ShopIdSchema.safeParse(shopId);
  if (!idParse.success) return { error: "Invalid shop ID" };

  try {
    const customer = await prisma.shop_customers.findUnique({
      where: {
        id: customerId,
        shop_id: idParse.data,
      },
      select: { udhar_balance: true },
    });

    if (!customer) return { error: "Customer not found." };
    if (Number(customer.udhar_balance) > 0)
      return { error: "Cannot delete customer with pending Udhar." };

    await prisma.shop_customers.delete({
      where: {
        id: customerId,
        shop_id: idParse.data,
      }
    });

    revalidatePath("/dashboard/owner/customers");
    return { success: true };
  } catch (error: any) {
    return { error: `Could not delete customer: ${error.message}` };
  }
}
