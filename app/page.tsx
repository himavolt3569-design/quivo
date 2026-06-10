"use client";

import { useLayoutEffect, useRef, useState, Suspense } from "react";
import { Navbar } from "@/components/sections/Navbar";
import { HeroSection } from "@/components/sections/HeroSection";
import { Footer } from "@/components/sections/Footer";
import { PageLoadingSkeleton } from "@/components/PageLoadingSkeleton";
import { toast } from "sonner";
import { popularProducts } from "@/lib/data";
import { useSearchParams } from "next/navigation";
import { AUTH_ERROR_MESSAGES, isAuthErrorCode } from "@/lib/auth-errors";

import { TrendingSection } from "@/components/sections/TrendingSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { ScanToOrderSection } from "@/components/sections/ScanToOrderSection";
import { OwnerOrdersSection } from "@/components/sections/OwnerOrdersSection";
import { ProductPreviewSection } from "@/components/sections/ProductPreviewSection";
import { HardwareSupportSection } from "@/components/sections/HardwareSupportSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { StoriesSection } from "@/components/sections/StoriesSection";
import { SecuritySection } from "@/components/sections/SecuritySection";
import { CTASection } from "@/components/sections/CTASection";

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
      current.includes(productId) ? current : [...current, productId],
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
      "(prefers-reduced-motion: reduce)",
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
      },
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
