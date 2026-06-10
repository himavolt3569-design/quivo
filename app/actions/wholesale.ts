"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ApplicationIdSchema = z.string().uuid();
const DiscountSchema = z.number().min(0).max(100).nullable();

export async function approveApplication(id: string, overrideDiscount: number | null = null) {
  const parse = ApplicationIdSchema.safeParse(id);
  if (!parse.success) return { error: "Invalid application ID." };

  const discountParse = DiscountSchema.safeParse(overrideDiscount);
  if (!discountParse.success) return { error: "Invalid discount value." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("wholesale_applications")
    .update({ 
      status: "approved", 
      approved_at: new Date().toISOString(),
      override_discount_percent: discountParse.data
    })
    .eq("id", parse.data)
    .eq("status", "pending");

  if (error) return { error: "Failed to approve application." };
  
  revalidatePath("/dashboard/owner/wholesale/applications");
  return { success: true };
}

export async function rejectApplication(id: string) {
  const parse = ApplicationIdSchema.safeParse(id);
  if (!parse.success) return { error: "Invalid application ID." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("wholesale_applications")
    .update({ 
      status: "rejected", 
      override_discount_percent: null 
    })
    .eq("id", parse.data)
    .eq("status", "pending");

  if (error) return { error: "Failed to reject application." };
  
  revalidatePath("/dashboard/owner/wholesale/applications");
  return { success: true };
}

export async function updateOverrideDiscount(id: string, overrideDiscount: number | null) {
  const parse = ApplicationIdSchema.safeParse(id);
  if (!parse.success) return { error: "Invalid application ID." };

  const discountParse = DiscountSchema.safeParse(overrideDiscount);
  if (!discountParse.success) return { error: "Invalid discount value." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("wholesale_applications")
    .update({ 
      override_discount_percent: discountParse.data
    })
    .eq("id", parse.data)
    .eq("status", "approved");

  if (error) return { error: "Failed to update discount." };
  
  revalidatePath("/dashboard/owner/wholesale/applications");
  return { success: true };
}

export async function applyForWholesale(wholesalerShopId: string, retailerShopId: string) {
  const wParse = ApplicationIdSchema.safeParse(wholesalerShopId);
  const rParse = ApplicationIdSchema.safeParse(retailerShopId);
  
  if (!wParse.success || !rParse.success) return { error: "Invalid shop IDs." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("wholesale_applications")
    .insert({
      wholesaler_shop_id: wParse.data,
      retailer_shop_id: rParse.data,
      status: "pending"
    });

  if (error) {
    if (error.code === '23505') {
      return { error: "Application already exists." };
    }
    return { error: "Failed to submit application." };
  }
  
  revalidatePath("/dashboard/(customer)/shops");
  return { success: true };
}
