"use client";

import { useRef, useLayoutEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Barcode,
  CheckCircle2,
  Crosshair,
  MapPin,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import {
  stats,
  patternImage,
  customerSearchChips,
  popularProducts,
  nearbyShops,
  barcodeSteps,
  customerDealItems,
  orderFilters,
  customerFallbackLocation,
} from "@/lib/data";
import { MapViewDynamic as MapView } from "@/components/MapDynamic";
import { BarcodeScanner } from "../dashboard/customer/BarcodeScanner";

type LocationPermissionState =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported";

interface HeroSectionProps {
  scrollToSection: (id: string) => void;
  addProductToBasket?: (productId: string) => void;
}

export function HeroSection({ scrollToSection, addProductToBasket: propAddProduct }: HeroSectionProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [basketItems, setBasketItems] = useState<string[]>(["rice", "milk"]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [submittedOrder, setSubmittedOrder] = useState<{
    id: string;
    shop: string;
    total: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] =
    useState<LocationPermissionState>("idle");
  const [customerLocation, setCustomerLocation] = useState(
    customerFallbackLocation,
  );
  const [activeOrderFilter, setActiveOrderFilter] = useState("All");
  const [activeShopName, setActiveShopName] = useState(nearbyShops[0].name);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discoveryMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopMarkersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const radiusCircleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerMarkerRef = useRef<any>(null);

  const shopsInsideRadius = nearbyShops.filter((shop) => shop.distance <= 6);
  const filteredNearbyShops = shopsInsideRadius.filter(
    (shop) =>
      activeOrderFilter === "All" || shop.category === activeOrderFilter,
  );
  const selectedOrderShop =
    filteredNearbyShops.find((shop) => shop.name === activeShopName) ??
    filteredNearbyShops[0] ??
    shopsInsideRadius[0];
  const basketProducts = popularProducts.filter((product) =>
    basketItems.includes(product.id),
  );
  const basketTotal = basketProducts.reduce(
    (total, product) => total + product.priceNumber,
    0,
  );

  const permissionCopy = {
    idle: "Use location to center the 6km radius around the customer.",
    requesting: "Requesting browser permission for nearby shop discovery...",
    granted:
      "Location is ready. Shops are filtered inside the 6km customer radius.",
    denied:
      "Location was blocked. Customers can still browse with a saved neighborhood fallback.",
    unsupported:
      "This device does not support geolocation. Quivo keeps fallback browsing available.",
  }[locationPermission];

  function addProductToBasket(productId: string) {
    if (propAddProduct) {
      propAddProduct(productId);
      return;
    }
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

  function requestCustomerLocation() {
    if (!("geolocation" in navigator)) {
      setLocationPermission("unsupported");
      return;
    }

    setLocationPermission("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomerLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationPermission("granted");
      },
      () => setLocationPermission("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 },
    );
  }

  function submitCustomerOrder() {
    if (!basketProducts.length) {
      toast.error("Add at least one barcode item before sending the order.");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Please add customer name and phone for the shop.");
      return;
    }

    const orderId = `QUIVO-${Math.floor(1000 + Math.random() * 9000)}`;
    const savedOrder = {
      id: orderId,
      shop: selectedOrderShop.name,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryNote: deliveryNote.trim(),
      items: basketProducts.map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.priceNumber,
      })),
      total: basketTotal,
      createdAt: new Date().toISOString(),
    };
    const previousOrders = JSON.parse(
      window.localStorage.getItem("quivo-submitted-orders") ?? "[]",
    ) as (typeof savedOrder)[];
    window.localStorage.setItem(
      "quivo-submitted-orders",
      JSON.stringify([savedOrder, ...previousOrders].slice(0, 20)),
    );
    setSubmittedOrder({
      id: orderId,
      shop: selectedOrderShop.name,
      total: basketTotal,
    });
    toast.success("Order request sent", {
      description: `${orderId} saved and sent to ${selectedOrderShop.name}`,
    });
  }

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isSmallScreen = window.matchMedia("(max-width: 639px)").matches;
    if (reduceMotion || isSmallScreen || !rootRef.current) return;

    const context = gsap.context(() => {
      const heroTimeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      heroTimeline
        .from(".hero-kicker", {
          y: 18,
          duration: 0.55,
          clearProps: "transform",
        })
        .from(
          ".hero-title span",
          { y: 38, duration: 0.82, stagger: 0.09, clearProps: "transform" },
          "-=0.22",
        )
        .from(
          ".hero-copy",
          { y: 22, duration: 0.58, clearProps: "transform" },
          "-=0.28",
        )
        .from(
          ".hero-actions",
          { y: 18, duration: 0.5, clearProps: "transform" },
          "-=0.22",
        )
        .from(
          ".hero-visual",
          {
            x: 52,
            rotateY: -7,
            scale: 0.94,
            duration: 0.9,
            clearProps: "transform",
          },
          "-=0.55",
        )
        .from(
          ".hero-stat",
          { y: 18, duration: 0.45, stagger: 0.08, clearProps: "transform" },
          "-=0.38",
        );

      gsap.to(".scanner-line", {
        xPercent: 118,
        duration: 3.6,
        repeat: -1,
        ease: "none",
      });

      gsap.to(".parallax-orb", {
        y: -48,
        ease: "none",
        scrollTrigger: {
          trigger: ".award-hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.to(".float-card", {
        y: -12,
        duration: 2.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.18,
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

    return () => context.revert();
  }, []);

  return (
    <div ref={rootRef}>
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
      />
      <section className="award-hero relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `url(${patternImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(216,201,154,0.36),transparent_30%),radial-gradient(circle_at_78%_18%,rgba(167,101,58,0.18),transparent_34%),linear-gradient(135deg,rgba(255,251,244,0.86),rgba(247,240,230,0.72))]"
          aria-hidden="true"
        />
        <div
          className="scanner-line absolute top-0 z-[1] hidden h-full w-28 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent mix-blend-soft-light blur-sm md:block"
          aria-hidden="true"
        />
        <div
          className="parallax-orb absolute -right-24 top-24 h-72 w-72 rounded-full bg-[#A7653A]/18 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="parallax-orb absolute -left-24 bottom-12 h-72 w-72 rounded-full bg-[#B76E42]/14 blur-3xl"
          aria-hidden="true"
        />

        <div className="container relative grid min-h-[auto] items-start gap-6 py-6 sm:gap-8 sm:py-10 md:items-center lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:py-16 xl:py-20">
          <div className="max-w-3xl min-w-0">
            <div className="hero-kicker">
              <Eyebrow icon={Barcode}>Barcode-first local shopping</Eyebrow>
            </div>
            <h1 className="hero-title mt-4 max-w-[20.5rem] text-[clamp(2rem,8.8vw,2.42rem)] font-bold leading-[1.04] tracking-[-0.045em] text-[#27324A] min-[430px]:max-w-[24rem] min-[430px]:text-[clamp(2.35rem,8.2vw,3.25rem)] sm:mt-7 sm:max-w-none sm:text-[clamp(3rem,6.3vw,5.9rem)]">
              <span className="block">Scan a barcode.</span>
              <span className="block text-[#A7653A]">Find it nearby.</span>
              <span className="block">Order in minutes.</span>
            </h1>
            <p className="hero-copy mt-3 max-w-[20.5rem] text-[0.95rem] font-normal leading-6 text-[#4A4854] min-[430px]:max-w-[23rem] sm:mt-6 sm:max-w-2xl sm:text-xl sm:leading-8">
              Quivo turns everyday barcodes into nearby shopping: scan rice,
              milk, medicine, or chargers, compare trusted shops within 6km, and
              send a ready basket.
            </p>

            <div className="hero-actions mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
              <button
                onClick={() => setScannerOpen(true)}
                className="group inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#A7653A] px-6 text-sm font-bold text-white shadow-xl shadow-[#A7653A]/25 transition hover:-translate-y-0.5 hover:bg-[#8E5432] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4 sm:w-auto sm:px-8 sm:text-base"
              >
                <Barcode className="h-5 w-5" />
                Scan Barcode
              </button>
              <Link
                href="/?login=true"
                className="inline-flex min-h-14 w-full items-center justify-center rounded-full border border-[#2E3344]/12 bg-white px-6 text-sm font-bold text-[#27324A] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A7653A]/45 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4 sm:w-auto sm:px-8 sm:text-base"
              >
                Sign In / Sign Up
              </Link>
            </div>
            <div className="mt-5 grid w-full max-w-full grid-cols-2 gap-2 text-[0.72rem] font-semibold text-[#746E73] sm:mt-6 sm:flex sm:max-w-none sm:flex-wrap sm:text-sm">
              {customerSearchChips.slice(0, 4).map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[#2E3344]/8 bg-white/82 px-3 py-2 text-center shadow-sm sm:px-4"
                >
                  {chip}
                </span>
              ))}
            </div>
            <div className="mt-5 grid w-full max-w-full grid-cols-2 gap-2.5 sm:mt-10 sm:max-w-2xl sm:grid-cols-4 sm:gap-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="hero-stat float-card rounded-[1.1rem] border border-[#2E3344]/8 bg-white/82 p-3 shadow-sm backdrop-blur sm:rounded-2xl sm:p-4"
                >
                  <div className="text-xl font-bold tracking-[-0.02em] text-[#27324A] sm:text-2xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-[0.64rem] font-semibold uppercase tracking-[0.06em] text-[#746E73] sm:text-xs sm:tracking-[0.08em]">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-visual relative hidden min-w-0 md:block">
            <div className="tilt-card magnetic-card relative overflow-hidden rounded-[1.5rem] border border-white bg-white p-3 shadow-2xl shadow-[#27324A]/16 sm:rounded-[2rem] sm:p-4">
              <div className="scanner-panel relative overflow-hidden rounded-[1.35rem] bg-[#27324A] p-4 text-white sm:rounded-[1.55rem] sm:p-5">
                <div className="scan-beam" aria-hidden="true" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D8C99A]">
                      Live barcode scan
                    </p>
                    <h3 className="mt-2 text-3xl font-bold tracking-[-0.03em]">
                      8941001 204812
                    </h3>
                  </div>
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
                    <Barcode
                      className="h-7 w-7 text-[#D8C99A]"
                      aria-hidden="true"
                    />
                  </span>
                </div>
                <div className="mt-5 rounded-3xl bg-white px-5 py-4 text-[#27324A] shadow-xl shadow-black/10">
                  <div className="flex items-center gap-4">
                    <img
                      src={popularProducts[0].image}
                      alt="Jeera Masino Rice product"
                      className="h-20 w-20 rounded-2xl object-cover"
                    />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8D5132]">
                        Matched nearby
                      </p>
                      <h4 className="mt-1 text-xl font-bold tracking-[-0.02em]">
                        {popularProducts[0].name}
                      </h4>
                      <p className="mt-1 text-sm font-semibold text-[#746E73]">
                        {popularProducts[0].shop} · {popularProducts[0].price}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.55rem] bg-[#F7F0E6] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#8D5132]">
                      Popular near you
                    </p>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#27324A]">
                      Above fold
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {popularProducts.slice(1, 4).map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProductToBasket(product.id)}
                        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A7653A]"
                      >
                        <img
                          src={product.image}
                          alt={`${product.name} product`}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-[#27324A]">
                            {product.name}
                          </span>
                          <span className="block text-xs font-semibold text-[#746E73]">
                            {product.stock}
                          </span>
                        </span>
                        <span className="text-sm font-bold text-[#A7653A]">
                          {product.price}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.55rem] bg-[#FFFBF4] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#8D5132]">
                    Nearby store
                  </p>
                  <img
                    src={nearbyShops[0].image}
                    alt="Maitidevi Fresh Mart storefront"
                    className="mt-3 h-32 w-full rounded-2xl object-cover"
                  />
                  <h4 className="mt-3 text-lg font-bold text-[#27324A]">
                    {nearbyShops[0].name}
                  </h4>
                  <p className="mt-1 text-sm font-medium text-[#746E73]">
                    1.2 km away · accepts scan orders 24/7
                  </p>
                  <button
                    type="button"
                    onClick={() => scrollToSection("orders")}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#A7653A] px-4 text-sm font-semibold text-white transition hover:bg-[#8E5432] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2"
                  >
                    Build basket
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
