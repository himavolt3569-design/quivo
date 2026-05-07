"use client";

import { CalendarDays, CreditCard, ShieldCheck } from "lucide-react";

export function SecuritySection() {
  return (
    <section id="security" className="reveal-section bg-[#F7F0E6] py-24">
      <div className="container grid gap-5 lg:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: "Data protected",
            copy: "Encrypted transit and cloud backups.",
          },
          {
            icon: CreditCard,
            title: "Counter-ready",
            copy: "Fast billing and receipts.",
          },
          {
            icon: CalendarDays,
            title: "Local workflows",
            copy: "Nepali calendar and bilingual support.",
          },
        ].map(item => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="magnetic-card reveal-item rounded-[1.75rem] bg-[#27324A] p-7 text-white shadow-xl shadow-[#27324A]/14"
            >
              <Icon className="h-8 w-8 text-[#D8C99A]" />
              <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 leading-7 text-white/70">{item.copy}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
