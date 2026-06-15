"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const UUID = z.string().uuid();

const SubmitSchema = z.object({
  orderId: UUID,
  productId: UUID,
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(2000).optional().nullable(),
});

export interface PublicReview {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  reviewer_initial: string;
}

export interface OwnerReviewRow {
  id: string;
  product_id: string;
  product_name: string | null;
  customer_id: string;
  customer_name: string | null;
  rating: number;
  body: string | null;
  status: "pending" | "published" | "hidden";
  created_at: string;
  order_id: string;
}

export async function submitReview(
  input: z.infer<typeof SubmitSchema>,
): Promise<{ id?: string; error?: string }> {
  const parse = SubmitSchema.safeParse(input);
  if (!parse.success)
    return { error: parse.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("submit_review", {
      p_order_id: parse.data.orderId,
      p_product_id: parse.data.productId,
      p_rating: parse.data.rating,
      p_body: parse.data.body ?? null,
    })
    .single<string>();

  if (error) {
    log.warn("submitReview failed", {
      code: error.code,
      message: error.message,
    });
    if (error.message === "not your order")
      return { error: "You can only review your own orders." };
    if (error.message === "order not delivered")
      return { error: "You can only review orders that have been delivered." };
    if (error.message === "product not in this order")
      return { error: "That product isn't on this order." };
    if (error.message === "rating must be 1..5")
      return { error: "Rating must be between 1 and 5." };
    return { error: "Could not submit review." };
  }

  revalidatePath("/order/[orderNumber]", "page");
  revalidatePath("/s/[slug]/product/[barcode]", "page");
  return { id: data };
}

export async function listProductReviews(
  productId: string,
  limit = 20,
): Promise<{ rows: PublicReview[]; error?: string }> {
  const parse = UUID.safeParse(productId);
  if (!parse.success) return { rows: [], error: "Invalid product id" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at, customer_id")
    .eq("product_id", parse.data)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) {
    log.warn("listProductReviews failed", {
      code: error.code,
      message: error.message,
    });
    return { rows: [], error: error.message };
  }

  const rows: PublicReview[] = (data ?? []).map((r) => ({
    id: r.id as string,
    rating: r.rating as number,
    body: (r.body as string | null) ?? null,
    created_at: r.created_at as string,
    // Show only a single-letter initial to keep reviewer identity private.
    reviewer_initial: (
      (r.customer_id as string)?.slice(0, 1) ?? "?"
    ).toUpperCase(),
  }));
  return { rows };
}

export async function listPendingReviewsForShop(
  shopId: string,
): Promise<{ rows: OwnerReviewRow[]; error?: string }> {
  const parse = UUID.safeParse(shopId);
  if (!parse.success) return { rows: [], error: "Invalid shop id" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      id, product_id, customer_id, rating, body, status, created_at, order_id,
      products!inner(name)
    `,
    )
    .eq("shop_id", parse.data)
    .in("status", ["pending", "published", "hidden"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    log.warn("listPendingReviewsForShop failed", {
      code: error.code,
      message: error.message,
    });
    return { rows: [], error: error.message };
  }

  const rows: OwnerReviewRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    product_id: r.product_id as string,
    product_name: (r.products as { name?: string } | null)?.name ?? null,
    customer_id: r.customer_id as string,
    customer_name: null,
    rating: r.rating as number,
    body: (r.body as string | null) ?? null,
    status: r.status as "pending" | "published" | "hidden",
    created_at: r.created_at as string,
    order_id: r.order_id as string,
  }));
  return { rows };
}

export async function moderateReview(
  reviewId: string,
  action: "publish" | "hide",
): Promise<{ ok?: true; error?: string }> {
  const parse = UUID.safeParse(reviewId);
  if (!parse.success) return { error: "Invalid review id" };
  if (action !== "publish" && action !== "hide")
    return { error: "Invalid action" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_review", {
    p_review_id: parse.data,
    p_action: action,
  });

  if (error) {
    log.warn("moderateReview failed", {
      code: error.code,
      message: error.message,
    });
    return { error: "Could not moderate review." };
  }

  revalidatePath("/dashboard/owner/customers/reviews");
  return { ok: true };
}

/** Returns the review the caller has already left for (order, product) — null if none. */
export async function getMyReviewForOrderProduct(
  orderId: string,
  productId: string,
): Promise<{ review: { rating: number; body: string | null } | null }> {
  if (!UUID.safeParse(orderId).success || !UUID.safeParse(productId).success) {
    return { review: null };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { review: null };

  const { data } = await supabase
    .from("reviews")
    .select("rating, body")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (!data) return { review: null };
  return {
    review: {
      rating: data.rating as number,
      body: (data.body as string | null) ?? null,
    },
  };
}
