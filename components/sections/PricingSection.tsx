"use client";

import { ArrowRight, Check, Minus, WalletCards } from "lucide-react";
import { Eyebrow } from "@/components/Eyebrow";
import { plans, pricingComparison, pricingFaqs } from "@/lib/data";

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="reveal-section bg-[#F7F0E6] py-14 sm:py-20 lg:py-24"
    >
      <div className="container">
        <div className="reveal-item max-w-3xl">
          <Eyebrow icon={WalletCards}>Pricing teaser</Eyebrow>
          <h2 className="mt-5 text-[clamp(2.25rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[#27324A]">
            Start free. Grow when your shop is ready.
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#5F5A61]">
            Two clear choices, with the detailed comparison tucked away when
            needed.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`reveal-item rounded-[1.5rem] p-5 shadow-lg sm:rounded-[2rem] sm:p-8 ${plan.featured ? "bg-[#A7653A] text-white shadow-[#A7653A]/18" : "bg-white text-[#2E3344] shadow-[#27324A]/8"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3
                    className={`text-2xl font-semibold ${plan.featured ? "text-white" : "text-[#27324A]"}`}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className={`mt-3 max-w-lg leading-7 ${plan.featured ? "text-white/78" : "text-[#746E73]"}`}
                  >
                    {plan.note}
                  </p>
                </div>
                {plan.featured && (
                  <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
                    Popular
                  </span>
                )}
              </div>
              <div className="mt-7 flex items-end gap-2">
                <span className="text-5xl font-bold tracking-[-0.035em]">
                  {plan.price}
                </span>
                {plan.price !== "Free" && (
                  <span className="pb-2 text-sm font-medium opacity-75">
                    / month
                  </span>
                )}
              </div>
              <ul className="mt-7 space-y-3">
                {plan.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm font-medium"
                  >
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full ${plan.featured ? "bg-white/18" : "bg-[#E8E3D1] text-[#626A54]"}`}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                className={`mt-8 min-h-13 w-full rounded-full px-6 text-base font-semibold transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-4 ${plan.featured ? "bg-white text-[#8E5432] hover:bg-[#F3E1CB] focus:ring-white focus:ring-offset-[#A7653A]" : "bg-[#27324A] text-white hover:bg-[#A7653A] focus:ring-[#A7653A]"}`}
              >
                Select plan
              </button>
            </article>
          ))}
        </div>

        <details className="reveal-item group mt-10 overflow-hidden rounded-[2rem] border border-[#2E3344]/8 bg-white shadow-xl shadow-[#27324A]/8">
          <summary className="flex cursor-pointer list-none flex-col gap-4 bg-[#FFFBF4] px-4 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A7653A] focus-visible:ring-offset-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6 lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8D5132]">
                Plan comparison
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#27324A]">
                Need details? Open the feature table
              </h3>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#27324A] px-4 py-2 text-sm font-semibold text-white">
              <span className="group-open:hidden">Show table</span>
              <span className="hidden group-open:inline">Hide table</span>
              <Minus
                className="hidden h-4 w-4 group-open:block"
                aria-hidden="true"
              />
              <ArrowRight
                className="h-4 w-4 group-open:hidden"
                aria-hidden="true"
              />
            </span>
          </summary>

          <div className="overflow-x-auto border-t border-[#2E3344]/8">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <caption className="sr-only">
                Detailed comparison of Quivo Starter and Growth pricing plans
              </caption>
              <thead>
                <tr className="bg-[#F7F0E6] text-sm font-semibold text-[#27324A]">
                  <th scope="col" className="w-[15%] px-6 py-4 lg:px-8">
                    Area
                  </th>
                  <th scope="col" className="w-[30%] px-6 py-4">
                    Feature
                  </th>
                  <th scope="col" className="w-[27%] px-6 py-4">
                    Shop impact
                  </th>
                  <th scope="col" className="w-[14%] px-6 py-4 text-center">
                    Starter
                  </th>
                  <th scope="col" className="w-[14%] px-6 py-4 text-center">
                    Growth
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E3344]/8">
                {pricingComparison.map((row) => (
                  <tr
                    key={`${row.category}-${row.feature}`}
                    className="transition hover:bg-[#F7F0E6]/70"
                  >
                    <td className="px-6 py-5 align-top lg:px-8">
                      <span className="rounded-full bg-[#E8E3D1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#626A54]">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-6 py-5 align-top text-[0.98rem] font-semibold leading-6 text-[#27324A]">
                      {row.feature}
                    </td>
                    <td className="px-6 py-5 align-top text-sm leading-6 text-[#746E73]">
                      {row.benefit}
                    </td>
                    {[row.starter, row.growth].map((value, index) => (
                      <td
                        key={`${row.feature}-${index}`}
                        className="px-6 py-5 text-center align-top"
                      >
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                            value === "Included" || value === "Priority"
                              ? "bg-[#E8E3D1] text-[#626A54]"
                              : value === "Limited" || value === "Standard"
                                ? "bg-[#F3E1CB] text-[#8D5132]"
                                : "bg-[#2E3344]/8 text-[#746E73]"
                          }`}
                        >
                          {value === "Included" || value === "Priority" ? (
                            <Check
                              className="mr-1.5 h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          ) : null}
                          {value}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <div className="reveal-item mt-8 rounded-[2rem] border border-[#2E3344]/8 bg-[#FFFBF4] p-6 shadow-sm shadow-[#27324A]/6 lg:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8D5132]">
                Plan FAQ
              </p>
              <h3 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#27324A]">
                Common questions before choosing a plan
              </h3>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#746E73]">
              Short answers for shop owners comparing the free and paid options.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {pricingFaqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-[1.25rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm transition hover:border-[#A7653A]/28 hover:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-semibold leading-6 text-[#27324A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A7653A] focus-visible:ring-offset-4 focus-visible:ring-offset-white">
                  {faq.question}
                  <span
                    className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#E8E3D1] text-[#626A54] transition group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-7 text-[#746E73]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
