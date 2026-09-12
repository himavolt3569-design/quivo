import { Store, MapPin, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";

export interface Shop {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  image_url: string | null;
  created_at: Date | string;
}

export function ShopsSection({ shops }: { shops: Shop[] }) {
  if (!shops || shops.length === 0) return null;

  return (
    <section className="reveal-section relative border-t border-[#1E293B]/5 bg-[#F8FAFC] py-20 sm:py-32 overflow-hidden">
      <div className="container relative z-10">
        <div className="reveal-item flex flex-col items-center text-center">
          <Eyebrow icon={Store}>Local Partners</Eyebrow>
          <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-[#0F172A] sm:text-5xl">
            Discover Shops Near You
          </h2>
          <p className="mt-4 max-w-xl text-[0.95rem] leading-7 text-[#4A4854] sm:text-lg">
            Shop from trusted local retailers directly through Quivo.
          </p>
        </div>

        <div className="reveal-item mt-12 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shops.map((shop) => (
            <Link
              key={shop.id}
              href={`/s/${shop.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-md hover:ring-slate-300"
            >
              <div className="relative h-40 bg-slate-100 overflow-hidden">
                {shop.image_url ? (
                  <img
                    src={shop.image_url}
                    alt={shop.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-100">
                    <Store className="h-10 w-10 text-slate-300" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/80 via-transparent to-transparent" />
                <h3 className="absolute bottom-4 left-4 right-4 text-lg font-bold text-white line-clamp-1">
                  {shop.name}
                </h3>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start gap-2 text-sm text-slate-500">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                  <span className="line-clamp-2">
                    {shop.address || "Local Store"}
                  </span>
                </div>
                <div className="mt-auto pt-4 flex items-center text-sm font-semibold text-[#0F172A] transition-colors group-hover:text-[#1E293B]">
                  Visit Shop <ChevronRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
