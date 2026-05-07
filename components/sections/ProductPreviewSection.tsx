"use client";

import { Check, ReceiptText } from "lucide-react";
import { Eyebrow } from "@/components/Eyebrow";
import { dashboardImage, patternImage } from "@/lib/data";

export function ProductPreviewSection() {
  return (
    <section className="reveal-section relative overflow-hidden bg-[#222A3D] py-14 text-white sm:py-20 lg:py-24">
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `url(${patternImage})`,
          backgroundSize: "cover",
        }}
        aria-hidden="true"
      />
      <div className="container relative grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="reveal-item">
          <Eyebrow icon={ReceiptText}>Product preview</Eyebrow>
          <h2 className="mt-5 text-[clamp(2.25rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em]">
            A dashboard that feels like your daily operating desk.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 sm:mt-6 sm:text-lg sm:leading-8">
            The main dashboard leads with signals first, not long reports.
          </p>
          <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2">
            {[
              "Fast billing",
              "Stock alerts",
              "Customer credit",
              "Website orders",
            ].map(item => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur"
              >
                <Check className="mr-3 inline h-5 w-5 text-[#D8C99A]" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="reveal-item relative">
          <div
            className="absolute -inset-5 rounded-[2rem] bg-[#A7653A]/15 blur-2xl"
            aria-hidden="true"
          />
          <img
            src={dashboardImage}
            alt="Illustration of Quivo dashboard panels for quick inventory, barcode matching, billing, calendar, and reports"
            className="relative w-full rounded-[1.35rem] border border-white/12 shadow-2xl shadow-black/25 sm:rounded-[2rem]"
          />
        </div>
      </div>
    </section>
  );
}
