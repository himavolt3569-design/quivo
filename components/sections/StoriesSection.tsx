"use client";

import { Star, UsersRound } from "lucide-react";
import { Eyebrow } from "@/components/Eyebrow";
import { testimonials } from "@/lib/data";

export function StoriesSection() {
  return (
    <section
      id="stories"
      className="reveal-section bg-white py-14 sm:py-20 lg:py-24"
    >
      <div className="container grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="reveal-item">
          <Eyebrow icon={UsersRound}>Shop owner stories</Eyebrow>
          <h2 className="mt-5 text-[clamp(2.25rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[#27324A]">
            Practical software for real local commerce.
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#5F5A61]">
            Shorter queues, clearer credit, fewer stock surprises.
          </p>
        </div>
        <div className="grid gap-5">
          {testimonials.map(testimonial => (
            <blockquote
              key={testimonial.name}
              className="magnetic-card reveal-item rounded-[1.75rem] border border-[#2E3344]/8 bg-[#F7F0E6] p-6 shadow-sm"
            >
              <div className="flex gap-1 text-[#B76E42]" aria-hidden="true">
                {[0, 1, 2, 3, 4].map(star => (
                  <Star key={star} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-base leading-7 text-[#4A4854]">
                “{testimonial.quote}”
              </p>
              <footer className="mt-5 text-sm font-semibold text-[#27324A]">
                {testimonial.name}{" "}
                <span className="font-normal text-[#746E73]">
                  — {testimonial.role}
                </span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
