"use client";

import { Barcode } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Eyebrow } from "@/components/Eyebrow";
import { popularProducts } from "@/lib/data";

interface TrendingSectionProps {
  addProductToBasket: (productId: string) => void;
}

export function TrendingSection({ addProductToBasket }: TrendingSectionProps) {
  return (
    <section className="reveal-section relative overflow-hidden bg-[#FFFBF4] py-8 sm:py-14">
      <div className="container">
        <div className="reveal-item flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow icon={Barcode}>Popular near you</Eyebrow>
            <h2 className="mt-4 max-w-3xl text-[clamp(2rem,3.5vw,3.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-[#27324A]">
              Trending products customers are scanning today.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-[#5F5A61]">
            Each card starts with a barcode, then shows nearby stock, price, and
            the shop ready to receive the order.
          </p>
        </div>

        <Carousel
          opts={{ align: "start", loop: true }}
          className="reveal-item mt-8"
        >
          <CarouselContent className="-ml-4">
            {popularProducts.map((product) => (
              <CarouselItem
                key={product.id}
                className="basis-full pl-4 min-[430px]:basis-[88%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
              >
                <article className="product-card magnetic-card group overflow-hidden rounded-[1.75rem] border border-[#2E3344]/8 bg-white shadow-xl shadow-[#27324A]/8 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#27324A]/14">
                  <div className="relative h-36 overflow-hidden bg-[#F7F0E6] sm:h-44">
                    <img
                      src={product.image}
                      alt={`${product.name} product photo`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-[#8D5132] shadow-sm">
                      {product.tag}
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 rounded-2xl bg-[#F7F0E6] px-3 py-2 text-xs font-semibold text-[#27324A]">
                      <Barcode
                        className="h-4 w-4 text-[#A7653A]"
                        aria-hidden="true"
                      />
                      {product.barcode}
                    </div>
                    <h3 className="mt-4 text-lg font-bold tracking-[-0.02em] text-[#27324A]">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-[#746E73]">
                      {product.stock} · {product.shop}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xl font-bold text-[#A7653A]">
                        {product.price}
                      </span>
                      <button
                        type="button"
                        onClick={() => addProductToBasket(product.id)}
                        className="rounded-full bg-[#27324A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#A7653A] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-5 flex justify-center gap-3 sm:justify-end">
            <CarouselPrevious className="static translate-y-0" />
            <CarouselNext className="static translate-y-0" />
          </div>
        </Carousel>
      </div>
    </section>
  );
}
