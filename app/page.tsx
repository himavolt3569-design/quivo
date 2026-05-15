"use client";

import { useLayoutEffect, useRef, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/sections/Navbar";
import { HeroSection } from "@/components/sections/HeroSection";
import { Footer } from "@/components/sections/Footer";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";
import { toast } from "sonner";
import { popularProducts } from "@/lib/data";
import { useSearchParams } from "next/navigation";
import { AUTH_ERROR_MESSAGES, isAuthErrorCode } from "@/lib/auth-errors";

function SectionFallback() {
  return (
    <section className="bg-[#F7F0E6] py-14 sm:py-20">
      <div className="container">
        <div className="soft-skeleton h-8 w-56 rounded-2xl" />
        <div className="soft-skeleton mt-5 h-14 max-w-2xl rounded-3xl" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="soft-skeleton h-52 rounded-[1.75rem]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const TrendingSection = dynamic(
  () =>
    import("@/components/sections/TrendingSection").then(
      (mod) => mod.TrendingSection
    ),
  { loading: SectionFallback }
);
const FeaturesSection = dynamic(
  () =>
    import("@/components/sections/FeaturesSection").then(
      (mod) => mod.FeaturesSection
    ),
  { loading: SectionFallback }
);
const ScanToOrderSection = dynamic(
  () =>
    import("@/components/sections/ScanToOrderSection").then(
      (mod) => mod.ScanToOrderSection
    ),
  { loading: SectionFallback }
);
const OwnerOrdersSection = dynamic(
  () =>
    import("@/components/sections/OwnerOrdersSection").then(
      (mod) => mod.OwnerOrdersSection
    ),
  { loading: SectionFallback }
);
const ProductPreviewSection = dynamic(
  () =>
    import("@/components/sections/ProductPreviewSection").then(
      (mod) => mod.ProductPreviewSection
    ),
  { loading: SectionFallback }
);
const HardwareSupportSection = dynamic(
  () =>
    import("@/components/sections/HardwareSupportSection").then(
      (mod) => mod.HardwareSupportSection
    ),
  { loading: SectionFallback }
);
const PricingSection = dynamic(
  () =>
    import("@/components/sections/PricingSection").then(
      (mod) => mod.PricingSection
    ),
  { loading: SectionFallback }
);
const StoriesSection = dynamic(
  () =>
    import("@/components/sections/StoriesSection").then(
      (mod) => mod.StoriesSection
    ),
  { loading: SectionFallback }
);
const SecuritySection = dynamic(
  () =>
    import("@/components/sections/SecuritySection").then(
      (mod) => mod.SecuritySection
    ),
  { loading: SectionFallback }
);
const CTASection = dynamic(
  () =>
    import("@/components/sections/CTASection").then((mod) => mod.CTASection),
  { loading: SectionFallback }
);

function scrollToSection(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function HomeContent() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [basketItems, setBasketItems] = useState<string[]>(["rice", "milk"]);
  const searchParams = useSearchParams();

  useLayoutEffect(() => {
    const code = searchParams.get("auth_error");
    if (!isAuthErrorCode(code)) return;
    const { title, description } = AUTH_ERROR_MESSAGES[code](searchParams);
    toast.error(title, { description, duration: 10000 });
  }, [searchParams]);

  function addProductToBasket(productId: string) {
    const product = popularProducts.find((item) => item.id === productId);
    setBasketItems((current) =>
      current.includes(productId) ? current : [...current, productId]
    );
    if (product) {
      toast.success(`${product.name} added by barcode`, {
        description: `${product.barcode} · ${product.shop}`,
      });
    }
  }

  function removeProductFromBasket(productId: string) {
    setBasketItems((current) => current.filter((item) => item !== productId));
  }

  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isSmallScreen = window.matchMedia("(max-width: 639px)").matches;
    if (reduceMotion || isSmallScreen || !rootRef.current) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([gsapModule, scrollTriggerModule]) => {
        if (cancelled || !rootRef.current) return;

        const gsap = gsapModule.default;
        gsap.registerPlugin(scrollTriggerModule.ScrollTrigger);

        const context = gsap.context(() => {
          gsap.utils
            .toArray<HTMLElement>(".reveal-section")
            .forEach((section) => {
              gsap.from(section.querySelectorAll(".reveal-item"), {
                opacity: 0,
                y: 32,
                duration: 0.65,
                stagger: 0.09,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: section,
                  start: "top 78%",
                  once: true,
                },
              });
            });

          gsap.utils.toArray<HTMLElement>(".feature-card").forEach((card) => {
            const icon = card.querySelector(".feature-icon");
            card.addEventListener("mouseenter", () => {
              gsap.to(card, { y: -8, duration: 0.28, ease: "power2.out" });
              if (icon) {
                gsap.to(icon, {
                  rotate: -5,
                  scale: 1.08,
                  duration: 0.28,
                  ease: "back.out(1.6)",
                });
              }
            });
            card.addEventListener("mouseleave", () => {
              gsap.to(card, { y: 0, duration: 0.28, ease: "power2.out" });
              if (icon) {
                gsap.to(icon, {
                  rotate: 0,
                  scale: 1,
                  duration: 0.28,
                  ease: "power2.out",
                });
              }
            });
          });

          gsap.utils.toArray<HTMLElement>(".magnetic-card").forEach((card) => {
            card.addEventListener("mousemove", (event) => {
              const bounds = card.getBoundingClientRect();
              const x = event.clientX - bounds.left;
              const y = event.clientY - bounds.top;
              const rotateY = (x / bounds.width - 0.5) * 6;
              const rotateX = -(y / bounds.height - 0.5) * 6;
              gsap.to(card, {
                rotateX,
                rotateY,
                y: -6,
                duration: 0.32,
                ease: "power2.out",
                transformPerspective: 900,
              });
            });
            card.addEventListener("mouseleave", () => {
              gsap.to(card, {
                rotateX: 0,
                rotateY: 0,
                y: 0,
                duration: 0.45,
                ease: "elastic.out(1, 0.55)",
              });
            });
          });
        }, rootRef);

        cleanup = () => context.revert();
      }
    );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="quivo-award-shell min-h-screen overflow-hidden bg-[#F7F0E6] font-[Poppins] text-[#2E3344]"
    >
      <Navbar scrollToSection={scrollToSection} />

      <main id="top" className="pt-16 sm:pt-20">
        <HeroSection 
          scrollToSection={scrollToSection} 
          addProductToBasket={addProductToBasket} 
        />
        <TrendingSection addProductToBasket={addProductToBasket} />
        <FeaturesSection />
        <ScanToOrderSection 
          basketItems={basketItems}
          addProductToBasket={addProductToBasket}
          removeProductFromBasket={removeProductFromBasket}
          scrollToSection={scrollToSection}
        />
        <OwnerOrdersSection />
        <ProductPreviewSection />
        <HardwareSupportSection />
        <PricingSection />
        <StoriesSection />
        <SecuritySection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="marketing" />}>
      <HomeContent />
    </Suspense>
  );
}
