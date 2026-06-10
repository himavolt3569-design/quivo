"use client";

import { PackageCheck, ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/Eyebrow";
import { counterFlow, features } from "@/lib/data";

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="reveal-section bg-white py-14 sm:py-20 lg:py-24"
    >
      <div className="container">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="reveal-item">
            <Eyebrow icon={PackageCheck}>Features & benefits</Eyebrow>
            <h2 className="mt-5 text-[clamp(2.25rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[#27324A]">
              Daily shop work, designed into one calm system.
            </h2>
          </div>
          <p className="reveal-item max-w-3xl self-end text-lg leading-8 text-[#5F5A61]">
            Less reading, more doing: each action connects to the next counter
            task.
          </p>
        </div>

        <div className="reveal-item mt-10 grid gap-3 rounded-[1.35rem] border border-[#2E3344]/8 bg-[#F7F0E6] p-3 shadow-inner shadow-[#27324A]/5 sm:gap-4 sm:rounded-[2rem] sm:p-4 md:grid-cols-4">
          {counterFlow.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.label}
                className="magnetic-card relative min-w-0 rounded-[1.15rem] bg-white p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5"
              >
                {index < counterFlow.length - 1 ? (
                  <ArrowRight
                    className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 rounded-full bg-[#A7653A] p-1 text-white md:block"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E8E3D1] text-[#626A54]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-lg font-bold text-[#27324A]">
                      {step.label}
                    </p>
                    <p className="text-sm font-medium text-[#746E73]">
                      {step.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="feature-card magnetic-card reveal-item min-w-0 rounded-[1.35rem] border border-[#2E3344]/8 bg-[#F7F0E6] p-5 shadow-sm transition-shadow hover:shadow-xl hover:shadow-[#27324A]/10 sm:rounded-[1.75rem] sm:p-6"
              >
                <div className="feature-icon grid h-13 w-13 place-items-center rounded-2xl bg-[#E8E3D1] text-[#626A54]">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.015em] text-[#27324A] sm:mt-6 sm:text-xl">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#746E73] sm:mt-3">
                  {feature.copy}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
