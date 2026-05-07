"use client";

import { MessageSquareText, Truck } from "lucide-react";
import { Eyebrow } from "@/components/Eyebrow";
import { incomingOrders, quickSignals } from "@/lib/data";

export function OwnerOrdersSection() {
  return (
    <section
      id="owner-orders"
      className="reveal-section relative overflow-hidden bg-white py-14 sm:py-20 lg:py-24"
    >
      <div
        className="absolute right-[-5rem] top-20 h-72 w-72 rounded-full bg-[#D8C99A]/22 blur-3xl"
        aria-hidden="true"
      />
      <div className="container relative">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div className="reveal-item">
            <Eyebrow icon={MessageSquareText}>For shop owners</Eyebrow>
            <h2 className="mt-5 text-[clamp(2.25rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[#27324A]">
              Customer requests arrive ready for action.
            </h2>
          </div>
          <p className="reveal-item max-w-3xl text-lg leading-8 text-[#5F5A61]">
            Once customers send a basket, shops see only what matters:
            items, payment, distance, and the next action.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="reveal-item overflow-hidden rounded-[2rem] border border-[#2E3344]/8 bg-[#F7F0E6] shadow-xl shadow-[#27324A]/10">
            <div className="flex flex-col gap-4 border-b border-[#2E3344]/8 bg-[#27324A] p-5 text-white md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D8C99A]">
                  Live order queue
                </p>
                <h3 className="mt-2 text-xl font-bold tracking-[-0.025em] sm:text-2xl">
                  Today’s incoming requests
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white/10 px-3 py-2">
                  3 new
                </span>
                <span className="rounded-full bg-[#D8C99A] px-3 py-2 text-[#27324A]">
                  1 urgent
                </span>
              </div>
            </div>

            <div className="divide-y divide-[#2E3344]/8">
              {incomingOrders.map(order => (
                <article
                  key={order.id}
                  className="grid gap-4 bg-white p-5 transition hover:bg-[#FFFBF4] xl:grid-cols-[0.9fr_1.15fr_0.75fr] xl:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#27324A] px-3 py-1 text-xs font-semibold text-white">
                        {order.id}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${order.priority === "Urgent" ? "bg-[#F3E1CB] text-[#8D5132]" : order.priority === "High" ? "bg-[#FFF0D6] text-[#A7653A]" : "bg-[#E8E3D1] text-[#626A54]"}`}
                      >
                        {order.priority}
                      </span>
                    </div>
                    <h4 className="mt-3 text-lg font-semibold tracking-[-0.015em] text-[#27324A]">
                      {order.customer}
                    </h4>
                    <p className="mt-1 text-sm text-[#746E73]">
                      {order.shop} · {order.distance} · {order.received}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#27324A]">
                      {order.items}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#746E73]">
                      {order.note}
                    </p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
                      {order.payment}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <span className="inline-flex items-center justify-center rounded-full bg-[#F7F0E6] px-3 py-2 text-sm font-semibold text-[#27324A]">
                      {order.status}
                    </span>
                    <div className="grid grid-cols-2 gap-2 min-w-0">
                      <button className="min-h-10 rounded-full bg-[#A7653A] px-3 text-xs font-semibold text-white transition hover:bg-[#8E5432] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2">
                        Accept
                      </button>
                      <button className="min-h-10 rounded-full border border-[#2E3344]/12 bg-white px-3 text-xs font-semibold text-[#27324A] transition hover:border-[#A7653A]/40 focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2">
                        Message
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="reveal-item rounded-[2rem] border border-[#2E3344]/8 bg-[#27324A] p-6 text-white shadow-xl shadow-[#27324A]/16">
            <div className="grid h-13 w-13 place-items-center rounded-2xl bg-[#D8C99A] text-[#27324A]">
              <Truck className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="mt-6 text-2xl font-bold tracking-[-0.025em]">
              Owner actions stay simple.
            </h3>
            <div className="mt-6 space-y-3">
              {[
                [
                  "Accept or review",
                  "Confirm stock before promising the customer.",
                ],
                [
                  "Pack and assign",
                  "Move the request into packing, pickup, or delivery.",
                ],
                [
                  "Message customer",
                  "Clarify substitutions, payment, or delivery notes.",
                ],
              ].map(([title, copy]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/8 p-4"
                >
                  <p className="font-semibold text-[#D8C99A]">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/68">
                    {copy}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {quickSignals.slice(1).map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl bg-white/8 p-3 text-center"
                >
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-white/55">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
