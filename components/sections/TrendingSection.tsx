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
import { TrendingProduct } from "@/lib/types";

interface TrendingSectionProps {
  addProductToBasket: (productId: string) => void;
  trendingProducts: TrendingProduct[];
}

export function TrendingSection({ addProductToBasket, trendingProducts }: TrendingSectionProps) {
  return (
    <section className="reveal-section relative overflow-hidden bg-slate-50 py-8 sm:py-14">
      <div className="container">
        <div className="reveal-item flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow icon={Barcode}>Popular near you</Eyebrow>
            <h2 className="mt-4 max-w-3xl text-[clamp(2rem,3.5vw,3.75rem)] font-bold leading-[1.05] tracking-[-0.035em] text-slate-900">
              Trending products customers are scanning today.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-slate-500">
            Each card starts with a barcode, then shows nearby stock, price, and
            the shop ready to receive the order.
          </p>
        </div>

        <Carousel
          opts={{ align: "start", loop: true }}
          className="reveal-item mt-8"
        >
          <CarouselContent className="-ml-4">
            {trendingProducts.map((product) => (
              <CarouselItem
                key={product.id}
                className="basis-full pl-4 min-[430px]:basis-[88%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
              >
                <article className="product-card magnetic-card group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/10">
                  <div className="relative h-36 overflow-hidden bg-slate-100 sm:h-44">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={`${product.name} product photo`}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                        <Barcode className="h-12 w-12 opacity-20" />
                      </div>
                    )}
                    <div className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-blue-600 shadow-sm">
                      {product.stock && product.stock < 10 ? "Low Stock" : "In Stock"}
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900">
                      <Barcode
                        className="h-4 w-4 text-blue-500"
                        aria-hidden="true"
                      />
                      {product.barcode || "No Barcode"}
                    </div>
                    <h3 className="mt-4 text-lg font-bold tracking-[-0.02em] text-slate-900">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-slate-500 truncate">
                      {product.stock || 0} in stock · {product.shop_name}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xl font-bold text-blue-600">
                        ${product.price}
                      </span>
                      <button
                        type="button"
                        onClick={() => addProductToBasket(product.id)}
                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
