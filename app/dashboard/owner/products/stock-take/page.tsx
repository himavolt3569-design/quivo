import { createClient } from "@/lib/supabase/server";
import { getOwnerContext } from "@/lib/shop";
import { StockTakeView } from "@/components/dashboard/owner/products/StockTakeView";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StockTakePage() {
  const ctx = await getOwnerContext();
  const shop = ctx.activeShop;
  if (!shop) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <p className="text-lg font-bold text-[#27324A]">No shop selected.</p>
        <Link
          href="/onboarding/owner"
          className="text-sm text-[#A7653A] hover:underline font-bold"
        >
          Create your first shop →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: products }, { data: openTake }, { data: history }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, brand, unit, stock")
        .eq("shop_id", shop.id)
        .eq("status", "active")
        .order("name", { ascending: true }),
      supabase
        .from("stock_takes")
        .select("id, status, started_at, completed_at, notes")
        .eq("shop_id", shop.id)
        .eq("status", "open")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("stock_takes")
        .select("id, status, started_at, completed_at, notes")
        .eq("shop_id", shop.id)
        .neq("status", "open")
        .order("started_at", { ascending: false })
        .limit(30),
    ]);

  let openTakeWithCounts: {
    row: {
      id: string;
      status: "open";
      started_at: string;
      completed_at: string | null;
      notes: string | null;
    };
    counts: {
      product_id: string;
      system_qty: number;
      counted_qty: number;
      variance: number;
    }[];
  } | null = null;

  if (openTake) {
    const { data: counts } = await supabase
      .from("stock_take_counts")
      .select("product_id, system_qty, counted_qty, variance")
      .eq("stock_take_id", openTake.id as string);
    openTakeWithCounts = {
      row: {
        id: openTake.id as string,
        status: "open",
        started_at: openTake.started_at as string,
        completed_at: (openTake.completed_at as string | null) ?? null,
        notes: (openTake.notes as string | null) ?? null,
      },
      counts: (counts ?? []) as {
        product_id: string;
        system_qty: number;
        counted_qty: number;
        variance: number;
      }[],
    };
  }

  return (
    <StockTakeView
      shopId={shop.id}
      shopName={shop.name}
      products={
        (products ?? []) as {
          id: string;
          name: string;
          brand: string | null;
          unit: string | null;
          stock: number;
        }[]
      }
      openTake={openTakeWithCounts}
      history={
        (history ?? []) as {
          id: string;
          status: "open" | "completed" | "cancelled";
          started_at: string;
          completed_at: string | null;
          notes: string | null;
        }[]
      }
    />
  );
}
