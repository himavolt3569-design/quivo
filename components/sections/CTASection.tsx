"use client";

export function CTASection() {
  return (
    <section className="reveal-section bg-[#27324A] py-20 text-white">
      <div className="container grid items-center gap-8 lg:grid-cols-[1fr_auto]">
        <div className="reveal-item">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/70">
            Ready to digitise your shop?
          </p>
          <h2 className="mt-4 max-w-3xl text-[clamp(2.2rem,4vw,4.2rem)] font-bold leading-[1.08] tracking-[-0.03em]">
            Make the shop counter feel lighter.
          </h2>
        </div>
        <button className="reveal-item min-h-14 rounded-full bg-white px-8 text-base font-semibold text-[#27324A] shadow-xl shadow-[#1B2030]/20 transition hover:-translate-y-0.5 hover:bg-[#F3E1CB] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-4 focus:ring-offset-[#27324A]">
          Start free trial
        </button>
      </div>
    </section>
  );
}
