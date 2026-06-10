"use client";

import {
  CreditCard,
  PackageCheck,
  ReceiptText,
  Smartphone,
} from "lucide-react";
import { Eyebrow } from "@/components/Eyebrow";

export function HardwareSupportSection() {
  return (
    <section className="reveal-section bg-white py-14 sm:py-20 lg:py-24">
      <div className="container">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <div className="reveal-item">
            <Eyebrow icon={CreditCard}>Hardware support</Eyebrow>
            <h2 className="mt-5 text-[clamp(2.25rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[#27324A]">
              Works with the counter tools your shop already uses.
            </h2>
          </div>
          <p className="reveal-item max-w-3xl text-lg leading-8 text-[#5F5A61]">
            Receipt printers, barcode lookup, payments, and phones fit the same
            counter flow.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ReceiptText,
              title: "Receipt printers",
              copy: "Prepare bills for compact thermal receipt printers used at busy counters.",
            },
            {
              icon: PackageCheck,
              title: "Barcode workflow",
              copy: "Speed up product lookup and reduce manual entry during daily billing.",
            },
            {
              icon: CreditCard,
              title: "Payment counter",
              copy: "Keep cash, digital wallet, and card records clear in the same sales flow.",
            },
            {
              icon: Smartphone,
              title: "Mobile devices",
              copy: "Use Quivo on phones and tablets when the shop floor gets crowded.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="feature-card magnetic-card reveal-item min-w-0 rounded-[1.35rem] border border-[#2E3344]/8 bg-[#F7F0E6] p-5 shadow-sm transition-shadow hover:shadow-xl hover:shadow-[#27324A]/10 sm:rounded-[1.75rem] sm:p-6"
              >
                <div className="feature-icon grid h-13 w-13 place-items-center rounded-2xl bg-[#E8E3D1] text-[#626A54]">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.015em] text-[#27324A] sm:mt-6 sm:text-xl">
                  {item.title}
                </h3>
                <p className="mt-3 text-[0.98rem] leading-7 text-[#746E73]">
                  {item.copy}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
