"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";

import { submitReview } from "@/app/actions/reviews";
import { InteractiveStarRating } from "@/components/ui/StarRating";

interface OrderLine {
  id?: string;
  name: string;
  price: number;
  qty: number;
  image?: string | null;
}

interface ExistingReview {
  productId: string;
  rating: number;
  body: string | null;
}

interface Props {
  orderId: string;
  items: OrderLine[];
  existing?: ExistingReview[];
}

interface LineState {
  rating: number;
  body: string;
  submitted: boolean;
}

export function ReviewProductsForOrder({
  orderId,
  items,
  existing = [],
}: Props) {
  const initial: Record<string, LineState> = {};
  for (const e of existing)
    initial[e.productId] = {
      rating: e.rating,
      body: e.body ?? "",
      submitted: true,
    };

  const [state, setState] = useState<Record<string, LineState>>(initial);
  const [isPending, startTransition] = useTransition();

  const reviewable = items.filter(
    (it): it is OrderLine & { id: string } => typeof it.id === "string",
  );
  if (reviewable.length === 0) return null;

  const update = (pid: string, patch: Partial<LineState>) => {
    setState((s) => ({
      ...s,
      [pid]: {
        rating: s[pid]?.rating ?? 0,
        body: s[pid]?.body ?? "",
        submitted: s[pid]?.submitted ?? false,
        ...patch,
      },
    }));
  };

  const handleSubmit = (pid: string) => {
    const line = state[pid];
    if (!line || line.rating < 1) {
      toast.error("Pick at least 1 star.");
      return;
    }
    startTransition(async () => {
      const res = await submitReview({
        orderId,
        productId: pid,
        rating: line.rating,
        body: line.body.trim() || null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Thanks for the review!");
      update(pid, { submitted: true });
    });
  };

  return (
    <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
          Leave a review
        </p>
        <h2 className="text-base font-black text-gray-900 mt-0.5">
          How was each item?
        </h2>
      </div>
      <ul className="divide-y divide-gray-100">
        {reviewable.map((it) => {
          const pid = it.id;
          const s = state[pid] ?? { rating: 0, body: "", submitted: false };
          return (
            <li key={pid} className="py-4 first:pt-0 last:pb-0 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-gray-900 text-sm">{it.name}</p>
                {s.submitted && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700">
                    <Check className="h-3 w-3" /> Reviewed
                  </span>
                )}
              </div>
              <InteractiveStarRating
                value={s.rating}
                onChange={(n) => update(pid, { rating: n, submitted: false })}
                disabled={isPending}
              />
              <textarea
                value={s.body}
                onChange={(e) =>
                  update(pid, {
                    body: e.target.value.slice(0, 2000),
                    submitted: false,
                  })
                }
                placeholder="Optional — share what worked or didn't."
                rows={2}
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A7653A]/30"
                disabled={isPending}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSubmit(pid)}
                  disabled={isPending || s.rating < 1}
                  className="h-9 px-4 rounded-xl bg-[#27324A] text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {s.submitted ? "Update" : "Submit"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
