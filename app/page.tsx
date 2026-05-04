"use client";
// Award upgrade design reminder: Cinematic Quick Inventory Commerce keeps Quivo content intact while adding Awwwards-style scan choreography, tactile glass cards, subtle barcode textures, magnetic pointer interactions, and mobile-safe immediate rendering.
// Revised design reminder: Elegant Nepali retail SaaS color system: rice-paper ivory surfaces, Himalayan ink, aged copper CTAs, muted sage support, porcelain surfaces, and soft clay highlights. Keep Poppins measured and reusable; avoid generic green SaaS color language. Motion is GSAP-first with transform and opacity only.
// Design reminder: Quivo uses a premium barcode-first Nepali retail language with rice-paper warmth, Himalayan ink typography, aged-copper actions, muted sage support accents, and product-led asymmetric layouts. Every responsive or animation choice should reinforce scan-first local shopping rather than generic SaaS polish.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MapViewDynamic as MapView } from "@/components/MapDynamic";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { toast } from "sonner";
import {
  ArrowRight,
  Barcode,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Crosshair,
  Globe2,
  Languages,
  MapPin,
  Menu,
  Minus,
  MessageSquareText,
  Navigation,
  PackageCheck,
  Route,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  SlidersHorizontal,
  Store,
  Smartphone,
  Star,
  Truck,
  UsersRound,
  WalletCards,
  XCircle,
} from "lucide-react";

const heroImage =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663610877397/gFDkdUTrN3mp6bv4rWCT6G/quivo-hero-shopkeeper-inventory-kgFvw7L4GXqgaGBnd4JV5C.webp";
const dashboardImage =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663610877397/gFDkdUTrN3mp6bv4rWCT6G/quivo-dashboard-receipt-panel-CMJw96uG32q4kWkLcgUbqw.webp";
const patternImage =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663610877397/gFDkdUTrN3mp6bv4rWCT6G/quivo-retail-pattern-QepqFeaTxq8yNa7E6GhW35.webp";

const features = [
  {
    icon: PackageCheck,
    title: "Inventory that stays current",
    copy: "See stock levels, low-stock alerts, and fast-moving products without searching through notebooks.",
  },
  {
    icon: ReceiptText,
    title: "Billing in a few taps",
    copy: "Create receipts, invoices, and daily sales records from any device at the counter.",
  },
  {
    icon: Globe2,
    title: "Nearby online ordering",
    copy: "Let customers find your shop by location, filter nearby stores, and send orders at any time.",
  },
  {
    icon: WalletCards,
    title: "Customer credit ledger",
    copy: "Track dues, payments, and reminders clearly so every rupee is easier to follow.",
  },
  {
    icon: Languages,
    title: "Nepali and English ready",
    copy: "Give your team familiar language options with Nepali calendar support for daily work.",
  },
  {
    icon: BarChart3,
    title: "Reports owners can use",
    copy: "Understand sales, stock, and customer activity through calm dashboards, not spreadsheets.",
  },
];

const stats = [
  { value: "1,000+", label: "shops ready to grow" },
  { value: "3 sec", label: "barcode lookup" },
  { value: "6 km", label: "nearby shop discovery" },
  { value: "24/7", label: "scan-to-order" },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    note: "Start with counter basics.",
    items: [
      "POS billing",
      "Basic inventory",
      "Daily summary",
      "Nepali calendar",
    ],
    featured: false,
  },
  {
    name: "Growth",
    price: "NPR 999",
    note: "Add credit, orders, and deeper reports.",
    items: [
      "Starter included",
      "Customer ledger",
      "6km discovery",
      "Advanced reports",
    ],
    featured: true,
  },
];

const pricingComparison = [
  {
    category: "Billing",
    feature: "POS billing and receipt creation",
    benefit: "Keeps checkout moving quickly at the counter.",
    starter: "Included",
    growth: "Included",
  },
  {
    category: "Inventory",
    feature: "Product list and basic stock tracking",
    benefit: "Helps owners see what is available before selling.",
    starter: "Included",
    growth: "Included",
  },
  {
    category: "Inventory",
    feature: "Low-stock alerts and fast-moving product signals",
    benefit: "Reduces missed sales by showing what needs restocking.",
    starter: "Limited",
    growth: "Included",
  },
  {
    category: "Customers",
    feature: "Customer credit ledger and payment history",
    benefit:
      "Makes dues, repayments, and repeat-customer records easier to follow.",
    starter: "Not included",
    growth: "Included",
  },
  {
    category: "Commerce",
    feature: "Shop website, nearby discovery, and online order capture",
    benefit:
      "Lets customers find the shop within 6km and order beyond the physical counter.",
    starter: "Not included",
    growth: "Included",
  },
  {
    category: "Reports",
    feature: "Daily sales summary",
    benefit: "Gives a clear closing view at the end of each business day.",
    starter: "Included",
    growth: "Included",
  },
  {
    category: "Reports",
    feature: "Advanced stock, sales, and customer reports",
    benefit: "Shows patterns owners can use for buying and staffing decisions.",
    starter: "Limited",
    growth: "Included",
  },
  {
    category: "Localisation",
    feature: "Nepali calendar and bilingual-ready workflows",
    benefit: "Keeps daily work familiar for local teams.",
    starter: "Included",
    growth: "Included",
  },
  {
    category: "Hardware",
    feature: "Receipt printer, barcode, and mobile counter workflows",
    benefit: "Supports practical retail hardware as the shop becomes busier.",
    starter: "Limited",
    growth: "Included",
  },
  {
    category: "Support",
    feature: "Setup guidance and priority assistance",
    benefit: "Helps teams move from paper records to Quivo with less friction.",
    starter: "Standard",
    growth: "Priority",
  },
];

const pricingFaqs = [
  {
    question: "Can we start with the free Starter plan?",
    answer:
      "Yes. Starter is built for shops that want to begin with billing, basic inventory, daily sales summaries, and Nepali calendar support before moving to a paid plan.",
  },
  {
    question: "When should a shop choose Growth?",
    answer:
      "Choose Growth when customer credit, nearby online orders, low-stock alerts, advanced reports, or priority setup support become important to daily operations.",
  },
  {
    question: "Does Growth include everything in Starter?",
    answer:
      "Yes. Growth includes the Starter tools and adds deeper customer, inventory, nearby ordering, online-store, reporting, hardware, and support capabilities.",
  },
  {
    question: "Can we change plans later?",
    answer:
      "Yes. Shops can begin small and upgrade when they need more operating depth, without changing the way staff use billing and inventory every day.",
  },
];

const customerFallbackLocation = { lat: 27.7108, lng: 85.324 };

type LocationPermissionState =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported";

const nearbyShops = [
  {
    name: "Maitidevi Fresh Mart",
    category: "Grocery",
    distance: 1.2,
    eta: "18 min",
    note: "Barcode-ready pantry staples, snacks, oil, and home basics",
    status: "Accepts scan orders 24/7",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
    position: { lat: 27.7089, lng: 85.3311 },
    queue: 3,
  },
  {
    name: "Patan Care Pharmacy",
    category: "Pharmacy",
    distance: 2.8,
    eta: "24 min",
    note: "Health essentials matched by product barcode and repeat medicine history",
    status: "Night scan orders queued",
    image:
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=900&q=80",
    position: { lat: 27.6887, lng: 85.3191 },
    queue: 6,
  },
  {
    name: "Bhaktapur Mobile Hub",
    category: "Electronics",
    distance: 5.4,
    eta: "42 min",
    note: "Chargers, earbuds, and accessories found from barcode or model search",
    status: "Pickup or delivery",
    image:
      "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=900&q=80",
    position: { lat: 27.6721, lng: 85.3619 },
    queue: 2,
  },
  {
    name: "Kalimati Daily Store",
    category: "Grocery",
    distance: 6.7,
    eta: "Outside range",
    note: "Visible to owner, hidden from customer radius",
    status: "Outside 6km",
    image:
      "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&q=80",
    position: { lat: 27.6982, lng: 85.2915 },
    queue: 1,
  },
];

const orderFilters = ["All", "Grocery", "Pharmacy", "Electronics"];

const popularProducts = [
  {
    id: "rice",
    name: "Jeera Masino Rice 10kg",
    shop: "Maitidevi Fresh Mart",
    category: "Grocery",
    price: "Rs. 1,250",
    priceNumber: 1250,
    barcode: "8941001 204812",
    tag: "Trending",
    stock: "12 packs nearby",
    image:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80",
    accent: "bg-[#F3E1CB] text-[#8D5132]",
  },
  {
    id: "milk",
    name: "Fresh dairy milk 1L",
    shop: "Maitidevi Fresh Mart",
    category: "Grocery",
    price: "Rs. 120",
    priceNumber: 120,
    barcode: "8941001 772019",
    tag: "Morning rush",
    stock: "26 bottles nearby",
    image:
      "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=900&q=80",
    accent: "bg-[#E8E3D1] text-[#626A54]",
  },
  {
    id: "ors",
    name: "ORS hydration pack",
    shop: "Patan Care Pharmacy",
    category: "Pharmacy",
    price: "Rs. 95",
    priceNumber: 95,
    barcode: "8906017 009524",
    tag: "Health",
    stock: "18 strips nearby",
    image:
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=900&q=80",
    accent: "bg-[#FFF0D6] text-[#A7653A]",
  },
  {
    id: "charger",
    name: "USB-C fast charger",
    shop: "Bhaktapur Mobile Hub",
    category: "Electronics",
    price: "Rs. 899",
    priceNumber: 899,
    barcode: "6932172 061638",
    tag: "Pickup today",
    stock: "7 units nearby",
    image:
      "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80",
    accent: "bg-[#F3E1CB] text-[#8D5132]",
  },
  {
    id: "oil",
    name: "Mustard oil 1L",
    shop: "Maitidevi Fresh Mart",
    category: "Grocery",
    price: "Rs. 390",
    priceNumber: 390,
    barcode: "8941001 390204",
    tag: "Restocked",
    stock: "20 bottles nearby",
    image:
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80",
    accent: "bg-[#E8E3D1] text-[#626A54]",
  },
];

const customerDealItems = popularProducts.slice(0, 3);

const customerSearchChips = [
  "Scan rice barcode",
  "Scan milk",
  "Medicine barcode",
  "Phone charger",
  "Baby care",
  "Snacks",
];

const barcodeSteps = [
  { label: "Scan", detail: "Point camera at barcode", icon: Barcode },
  { label: "Match", detail: "Quivo checks nearby stock", icon: Crosshair },
  { label: "Order", detail: "Send basket to the shop", icon: ShoppingBag },
];

const navigationItems = [
  ["Features", "features"],
  ["Shop nearby", "orders"],
  ["For shops", "owner-orders"],
  ["Pricing", "pricing"],
  ["Stories", "stories"],
  ["Security", "security"],
] as const;

const counterFlow = [
  { label: "Bill", detail: "Fast checkout", icon: ReceiptText },
  { label: "Stock", detail: "Auto update", icon: PackageCheck },
  { label: "Credit", detail: "Dues clear", icon: WalletCards },
  { label: "Order", detail: "Nearby request", icon: ShoppingBag },
];

const quickSignals = [
  ["18", "low stock"],
  ["₨ 42k", "today sales"],
  ["7", "credit follow-ups"],
  ["3", "orders waiting"],
];

const incomingOrders = [
  {
    id: "HM-2048",
    customer: "Anita Tamang",
    items: "Rice 10kg, mustard oil, lentils",
    shop: "Maitidevi Fresh Mart",
    distance: "1.2 km",
    received: "2 min ago",
    status: "New",
    priority: "High",
    payment: "Cash on delivery",
    note: "Call before delivery; customer is near the main gate.",
  },
  {
    id: "HM-2047",
    customer: "Rajan Shahi",
    items: "Paracetamol, ORS, thermometer",
    shop: "Patan Care Pharmacy",
    distance: "2.8 km",
    received: "8 min ago",
    status: "Review",
    priority: "Urgent",
    payment: "Wallet pending",
    note: "Medicine order; verify stock before accepting.",
  },
  {
    id: "HM-2044",
    customer: "Mina Karki",
    items: "USB-C charger, earbuds",
    shop: "Bhaktapur Mobile Hub",
    distance: "5.4 km",
    received: "31 min ago",
    status: "Packing",
    priority: "Normal",
    payment: "Paid",
    note: "Pickup requested after 6 PM.",
  },
];

const testimonials = [
  {
    quote:
      "Stock, credit, and sales are now visible from one screen. It feels made for how our shop actually works.",
    name: "Kiran Shrestha",
    role: "Grocery owner, Kathmandu",
  },
  {
    quote:
      "Our staff learned billing quickly, and Nepali calendar support made daily closing easier.",
    name: "Sita Maharjan",
    role: "Retail operator, Lalitpur",
  },
  {
    quote:
      "The online store gave regular customers another way to order without adding extra complexity.",
    name: "Aashish Gurung",
    role: "Shop manager, Pokhara",
  },
];

function scrollToSection(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Eyebrow({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: typeof PackageCheck;
}) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-[#F3E1CB] px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </p>
  );
}

export default function Home() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discoveryMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopMarkersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const radiusCircleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerMarkerRef = useRef<any>(null);
  const [activeOrderFilter, setActiveOrderFilter] = useState("All");
  const [locationPermission, setLocationPermission] =
    useState<LocationPermissionState>("idle");
  const [customerLocation, setCustomerLocation] = useState(
    customerFallbackLocation
  );
  const [activeShopName, setActiveShopName] = useState(nearbyShops[0].name);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [basketItems, setBasketItems] = useState<string[]>(["rice", "milk"]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [submittedOrder, setSubmittedOrder] = useState<{
    id: string;
    shop: string;
    total: number;
  } | null>(null);

  const shopsInsideRadius = nearbyShops.filter(shop => shop.distance <= 6);
  const filteredNearbyShops = shopsInsideRadius.filter(
    shop => activeOrderFilter === "All" || shop.category === activeOrderFilter
  );
  const selectedOrderShop =
    filteredNearbyShops.find(shop => shop.name === activeShopName) ??
    filteredNearbyShops[0] ??
    shopsInsideRadius[0];
  const basketProducts = popularProducts.filter(product =>
    basketItems.includes(product.id)
  );
  const basketTotal = basketProducts.reduce(
    (total, product) => total + product.priceNumber,
    0
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

  function navigateFromMobileMenu(id: string) {
    setMobileMenuOpen(false);
    window.setTimeout(() => scrollToSection(id), 80);
  }

  function requestCustomerLocation() {
    if (!("geolocation" in navigator)) {
      setLocationPermission("unsupported");
      return;
    }

    setLocationPermission("requesting");
    navigator.geolocation.getCurrentPosition(
      position => {
        setCustomerLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationPermission("granted");
      },
      () => setLocationPermission("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }
    );
  }

  function addProductToBasket(productId: string) {
    const product = popularProducts.find(item => item.id === productId);
    setBasketItems(current =>
      current.includes(productId) ? current : [...current, productId]
    );
    if (product) {
      toast.success(`${product.name} added by barcode`, {
        description: `${product.barcode} · ${product.shop}`,
      });
    }
  }

  function removeProductFromBasket(productId: string) {
    setBasketItems(current => current.filter(item => item !== productId));
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
      items: basketProducts.map(product => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.priceNumber,
      })),
      total: basketTotal,
      createdAt: new Date().toISOString(),
    };
    const previousOrders = JSON.parse(
      window.localStorage.getItem("quivo-submitted-orders") ?? "[]"
    ) as (typeof savedOrder)[];
    window.localStorage.setItem(
      "quivo-submitted-orders",
      JSON.stringify([savedOrder, ...previousOrders].slice(0, 20))
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

  useEffect(() => {
    const map = discoveryMapRef.current;
    if (!map) return;

    import("leaflet").then(Leaflet => {
      if (!map.getContainer()) return;

      shopMarkersRef.current.forEach((marker: any) => marker.remove());
      shopMarkersRef.current = [];

      if (radiusCircleRef.current) radiusCircleRef.current.remove();
      if (customerMarkerRef.current) customerMarkerRef.current.remove();

      map.setView(
        [customerLocation.lat, customerLocation.lng],
        map.getZoom() || 13
      );

      radiusCircleRef.current = Leaflet.circle(
        [customerLocation.lat, customerLocation.lng],
        {
          radius: 6000,
          color: "#A7653A",
          opacity: 0.9,
          weight: 2,
          fillColor: "#A7653A",
          fillOpacity: 0.08,
        }
      ).addTo(map);

      customerMarkerRef.current = Leaflet.marker(
        [customerLocation.lat, customerLocation.lng],
        {
          title:
            locationPermission === "granted"
              ? "Customer location"
              : "Fallback customer area",
        }
      ).addTo(map);

      const boundsPoints: [number, number][] = [
        [customerLocation.lat, customerLocation.lng],
      ];
      filteredNearbyShops.forEach(shop => {
        const marker = Leaflet.marker([shop.position.lat, shop.position.lng], {
          title: `${shop.name} \u00b7 ${shop.distance}km`,
        }).addTo(map);
        marker.on("click", () => setActiveShopName(shop.name));
        shopMarkersRef.current.push(marker);
        boundsPoints.push([shop.position.lat, shop.position.lng]);
      });

      map.fitBounds(Leaflet.latLngBounds(boundsPoints), { padding: [72, 72] });
    });
  }, [customerLocation, filteredNearbyShops, locationPermission]);

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isSmallScreen = window.matchMedia("(max-width: 639px)").matches;
    if (reduceMotion || isSmallScreen || !rootRef.current) return;

    const context = gsap.context(() => {
      const heroTimeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      heroTimeline
        .from(".award-header", {
          y: -18,
          duration: 0.55,
          clearProps: "transform",
        })
        .from(
          ".hero-kicker",
          { y: 18, duration: 0.55, clearProps: "transform" },
          "-=0.18"
        )
        .from(
          ".hero-title span",
          { y: 38, duration: 0.82, stagger: 0.09, clearProps: "transform" },
          "-=0.22"
        )
        .from(
          ".hero-copy",
          { y: 22, duration: 0.58, clearProps: "transform" },
          "-=0.28"
        )
        .from(
          ".hero-actions",
          { y: 18, duration: 0.5, clearProps: "transform" },
          "-=0.22"
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
          "-=0.55"
        )
        .from(
          ".hero-stat",
          { y: 18, duration: 0.45, stagger: 0.08, clearProps: "transform" },
          "-=0.38"
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

      gsap.utils.toArray<HTMLElement>(".reveal-section").forEach(section => {
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

      gsap.utils.toArray<HTMLElement>(".feature-card").forEach(card => {
        const icon = card.querySelector(".feature-icon");
        card.addEventListener("mouseenter", () => {
          gsap.to(card, { y: -8, duration: 0.28, ease: "power2.out" });
          gsap.to(icon, {
            rotate: -5,
            scale: 1.08,
            duration: 0.28,
            ease: "back.out(1.6)",
          });
        });
        card.addEventListener("mouseleave", () => {
          gsap.to(card, { y: 0, duration: 0.28, ease: "power2.out" });
          gsap.to(icon, {
            rotate: 0,
            scale: 1,
            duration: 0.28,
            ease: "power2.out",
          });
        });
      });

      gsap.utils.toArray<HTMLElement>(".magnetic-card").forEach(card => {
        card.addEventListener("mousemove", event => {
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
    <div
      ref={rootRef}
      className="quivo-award-shell min-h-screen overflow-hidden bg-[#F7F0E6] font-[Poppins] text-[#2E3344]"
    >
      <header className="award-header fixed inset-x-0 top-0 z-50 border-b border-[#2E3344]/8 bg-[#F7F0E6]/85 backdrop-blur-2xl">
        <div className="container flex h-16 items-center justify-between gap-2 sm:h-20 lg:gap-4">
          <a
            href="#top"
            className="flex min-w-0 shrink items-center justify-between gap-2.5 sm:shrink-0 sm:justify-start sm:gap-3"
            aria-label="Quivo home"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#27324A] text-lg font-bold text-white shadow-lg shadow-[#27324A]/18 sm:h-11 sm:w-11">
              Q
            </span>
            <span className="leading-none">
              <span className="block text-xl font-bold tracking-[-0.02em] text-[#27324A]">
                Quivo
              </span>
              <span className="block max-w-[8.75rem] truncate text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-[#7A7378] sm:max-w-none sm:text-[0.67rem] sm:tracking-[0.16em]">
                Quick Inventory OS
              </span>
            </span>
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 lg:flex"
          >
            {navigationItems.map(([label, id]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className="text-sm font-medium text-[#2E3344]/70 transition hover:text-[#A7653A] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4 focus:ring-offset-[#F7F0E6]"
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={() => scrollToSection("orders")}
              className="rounded-full border border-[#2E3344]/12 bg-white px-5 py-3 text-sm font-semibold text-[#27324A] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A7653A]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4"
            >
              Scan barcode
            </button>
            <button
              onClick={() => scrollToSection("owner-orders")}
              className="rounded-full bg-[#A7653A] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#A7653A]/25 transition hover:-translate-y-0.5 hover:bg-[#8E5432] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4"
            >
              For shop owners
            </button>
          </div>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#2E3344]/12 bg-white text-[#27324A] shadow-sm ring-1 ring-[#27324A]/5 lg:hidden"
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation-menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="max-h-dvh w-[min(92vw,24rem)] overflow-y-auto border-[#2E3344]/10 bg-[#F7F0E6] px-0 pt-2 text-[#27324A] sm:max-w-sm"
            >
              <SheetHeader className="border-b border-[#2E3344]/8 px-6 pb-5 pt-6 text-left">
                <SheetTitle className="flex items-center gap-3 text-[#27324A]">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#27324A] font-bold text-white">
                    Q
                  </span>
                  Quivo menu
                </SheetTitle>
                <SheetDescription className="text-[#746E73]">
                  Jump to the product section you want to review.
                </SheetDescription>
              </SheetHeader>
              <div id="mobile-navigation-menu" className="grid gap-2 px-4 py-5">
                {navigationItems.map(([label, id]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigateFromMobileMenu(id)}
                    className="flex min-h-12 items-center justify-between rounded-2xl bg-white px-4 text-left text-base font-semibold text-[#27324A] shadow-sm transition hover:bg-[#FFFBF4] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2 focus:ring-offset-[#F7F0E6]"
                  >
                    {label}
                    <ArrowRight
                      className="h-4 w-4 text-[#A7653A]"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
              <div className="mt-auto grid gap-3 border-t border-[#2E3344]/8 px-4 py-5">
                <SheetClose asChild>
                  <button
                    onClick={() =>
                      window.setTimeout(() => scrollToSection("orders"), 80)
                    }
                    className="min-h-12 rounded-full border border-[#2E3344]/12 bg-white px-5 text-sm font-semibold text-[#27324A]"
                  >
                    Scan barcode
                  </button>
                </SheetClose>
                <SheetClose asChild>
                  <button
                    onClick={() =>
                      window.setTimeout(
                        () => scrollToSection("owner-orders"),
                        80
                      )
                    }
                    className="min-h-12 rounded-full bg-[#A7653A] px-5 text-sm font-semibold text-white shadow-lg shadow-[#A7653A]/20"
                  >
                    For shop owners
                  </button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main id="top" className="pt-16 sm:pt-20">
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
                milk, medicine, or chargers, compare trusted shops within 6km,
                and send a ready basket.
              </p>
              <div className="glass-panel hero-mobile-shop-strip mt-4 max-w-[21rem] rounded-[1.2rem] border border-[#2E3344]/8 bg-white/88 p-3 shadow-xl shadow-[#27324A]/8 backdrop-blur min-[430px]:max-w-[24rem] md:rounded-[1.5rem] lg:hidden">
                <div className="mb-3 flex items-center justify-between gap-2 px-1">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8D5132]">
                    Popular near you
                  </span>
                  <span className="hidden text-xs font-semibold text-[#746E73] min-[430px]:inline">
                    Tap to add
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 min-w-0">
                  {popularProducts.slice(0, 2).map(product => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProductToBasket(product.id)}
                      className="rounded-[1rem] bg-[#F7F0E6] p-2 text-left transition hover:-translate-y-0.5 hover:bg-[#EFE5D6] focus:outline-none focus:ring-2 focus:ring-[#A7653A]"
                    >
                      <img
                        src={product.image}
                        alt={`${product.name} product`}
                        className="h-14 w-full rounded-[0.9rem] object-cover sm:h-20"
                      />
                      <span className="mt-2 block truncate text-[0.82rem] font-bold text-[#27324A] sm:text-sm">
                        {product.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.68rem] font-semibold text-[#A7653A] sm:text-xs">
                        {product.price} · barcode match
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="hero-actions mt-5 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:gap-4">
                <button
                  onClick={() => scrollToSection("orders")}
                  className="award-button group inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[#A7653A] px-6 text-sm font-semibold text-white shadow-xl shadow-[#A7653A]/25 transition hover:-translate-y-0.5 hover:bg-[#8E5432] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4 sm:min-h-14 sm:w-auto sm:px-7 sm:text-base"
                >
                  Start barcode shopping
                  <ArrowRight className="ml-2 h-5 w-5 transition group-hover:translate-x-1" />
                </button>
                <button
                  onClick={() => scrollToSection("owner-orders")}
                  className="inline-flex min-h-13 w-full items-center justify-center rounded-full border border-[#2E3344]/12 bg-white px-6 text-sm font-semibold text-[#27324A] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A7653A]/45 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4 sm:min-h-14 sm:w-auto sm:px-7 sm:text-base"
                >
                  I own a shop
                </button>
              </div>
              <div className="mt-5 grid w-full max-w-full grid-cols-2 gap-2 text-[0.72rem] font-semibold text-[#746E73] sm:mt-6 sm:flex sm:max-w-none sm:flex-wrap sm:text-sm">
                {customerSearchChips.slice(0, 4).map(chip => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#2E3344]/8 bg-white/82 px-3 py-2 text-center shadow-sm sm:px-4"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-5 grid w-full max-w-full grid-cols-2 gap-2.5 sm:mt-10 sm:max-w-2xl sm:grid-cols-4 sm:gap-3">
                {stats.map(stat => (
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
                      {popularProducts.slice(1, 4).map(product => (
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
                Each card starts with a barcode, then shows nearby stock, price,
                and the shop ready to receive the order.
              </p>
            </div>

            <Carousel
              opts={{ align: "start", loop: true }}
              className="reveal-item mt-8"
            >
              <CarouselContent className="-ml-4">
                {popularProducts.map(product => (
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

        <section
          id="features"
          className="reveal-section bg-white py-14 sm:py-20 lg:py-24"
        >
          <div className="container">
            <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
              <div className="reveal-item">
                <Eyebrow icon={PackageCheck}>Features & benefits</Eyebrow>
                <h2 className="mt-5 text-[clamp(2.25rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[#27324A]">
                  Daily shop work, designed into one calm system.
                </h2>
              </div>
              <p className="reveal-item max-w-3xl self-end text-lg leading-8 text-[#5F5A61]">
                Less reading, more doing: each action connects to the next
                counter task.
              </p>
            </div>

            <div className="reveal-item mt-10 grid gap-3 rounded-[1.35rem] border border-[#2E3344]/8 bg-[#F7F0E6] p-3 shadow-inner shadow-[#27324A]/5 sm:gap-4 sm:rounded-[2rem] sm:p-4 md:grid-cols-4">
              {counterFlow.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.label}
                    className="magnetic-card relative min-w-0 rounded-[1.15rem] bg-white p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5"
                  >
                    {index < counterFlow.length - 1 ? (
                      <ArrowRight
                        className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 rounded-full bg-[#A7653A] p-1 text-white md:block"
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E8E3D1] text-[#626A54]">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-lg font-bold text-[#27324A]">
                          {step.label}
                        </p>
                        <p className="text-sm font-medium text-[#746E73]">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map(feature => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="feature-card magnetic-card reveal-item min-w-0 rounded-[1.35rem] border border-[#2E3344]/8 bg-[#F7F0E6] p-5 shadow-sm transition-shadow hover:shadow-xl hover:shadow-[#27324A]/10 sm:rounded-[1.75rem] sm:p-6"
                  >
                    <div className="feature-icon grid h-13 w-13 place-items-center rounded-2xl bg-[#E8E3D1] text-[#626A54]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold tracking-[-0.015em] text-[#27324A] sm:mt-6 sm:text-xl">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#746E73] sm:mt-3">
                      {feature.copy}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="orders"
          className="reveal-section relative overflow-hidden bg-[#F7F0E6] py-14 sm:py-20 lg:py-24"
        >
          <div
            className="absolute -right-24 top-20 h-72 w-72 rounded-full bg-[#A7653A]/12 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute left-[-6rem] bottom-10 h-72 w-72 rounded-full bg-[#626A54]/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="container relative">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div className="reveal-item">
                <Eyebrow icon={Barcode}>Scan-to-order experience</Eyebrow>
                <h2 className="mt-5 text-[clamp(2.35rem,4.7vw,4.8rem)] font-bold leading-[1.03] tracking-[-0.04em] text-[#27324A]">
                  Barcode is the shortcut from shelf to nearby shop.
                </h2>
              </div>
              <div className="reveal-item max-w-3xl">
                <p className="text-lg leading-8 text-[#5F5A61]">
                  Customers scan the product they already know, Quivo checks
                  quick inventory around them, and the basket goes straight to
                  the selected shop.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {barcodeSteps.map(step => {
                    const StepIcon = step.icon;
                    return (
                      <div
                        key={step.label}
                        className="magnetic-card rounded-2xl bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8E3D1] text-[#626A54]">
                            <StepIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div>
                            <p className="font-bold text-[#27324A]">
                              {step.label}
                            </p>
                            <p className="text-xs font-medium text-[#746E73]">
                              {step.detail}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-5 sm:mt-12 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="reveal-item space-y-5">
                <div className="overflow-hidden rounded-[2.25rem] border border-[#2E3344]/8 bg-white shadow-2xl shadow-[#27324A]/12">
                  <div className="bg-[#27324A] p-4 text-white sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D8C99A]">
                          Barcode basket builder
                        </p>
                        <h3 className="mt-2 text-3xl font-bold tracking-[-0.03em]">
                          Scan, match, add.
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={requestCustomerLocation}
                        disabled={locationPermission === "requesting"}
                        className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#27324A] transition hover:-translate-y-0.5 hover:bg-[#F3E1CB] disabled:cursor-wait disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-4 focus:ring-offset-[#27324A]"
                      >
                        <Crosshair
                          className="mr-2 h-4 w-4"
                          aria-hidden="true"
                        />
                        {locationPermission === "granted"
                          ? "Location ready"
                          : locationPermission === "requesting"
                            ? "Checking..."
                            : "Find shops near me"}
                      </button>
                    </div>

                    <div
                      className={`mt-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${
                        locationPermission === "denied" ||
                        locationPermission === "unsupported"
                          ? "bg-[#F3E1CB] text-[#27324A]"
                          : "bg-white/10 text-white/76"
                      }`}
                    >
                      {locationPermission === "granted" ? (
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#D8C99A]"
                          aria-hidden="true"
                        />
                      ) : locationPermission === "denied" ||
                        locationPermission === "unsupported" ? (
                        <XCircle
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#8D5132]"
                          aria-hidden="true"
                        />
                      ) : (
                        <MapPin
                          className="mt-0.5 h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span>{permissionCopy}</span>
                    </div>
                  </div>

                  <div className="grid gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-5">
                    {customerDealItems.map(deal => (
                      <article
                        key={deal.name}
                        className="product-card magnetic-card overflow-hidden rounded-[1.35rem] bg-[#F7F0E6] shadow-inner shadow-[#27324A]/5"
                      >
                        <img
                          src={deal.image}
                          alt={`${deal.name} product`}
                          className="h-24 w-full object-cover sm:h-28"
                        />
                        <div className="p-4">
                          <div
                            className={`inline-flex rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] ${deal.accent}`}
                          >
                            {deal.tag}
                          </div>
                          <h4 className="mt-3 text-base font-bold tracking-[-0.02em] text-[#27324A]">
                            {deal.name}
                          </h4>
                          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#746E73]">
                            <Barcode className="h-3.5 w-3.5" /> {deal.barcode}
                          </p>
                          <button
                            type="button"
                            onClick={() => addProductToBasket(deal.id)}
                            className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-[#27324A] shadow-sm transition hover:bg-[#27324A] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2"
                          >
                            Add to basket
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <form
                  className="rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5"
                  onSubmit={event => {
                    event.preventDefault();
                    submitCustomerOrder();
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
                        Checkout preview
                      </p>
                      <h4 className="mt-2 text-xl font-bold leading-tight text-[#27324A] sm:text-2xl">
                        {basketProducts.length} barcode items · Rs.{" "}
                        {basketTotal.toLocaleString()}
                      </h4>
                    </div>
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E8E3D1] text-[#626A54]">
                      <ShoppingBag className="h-6 w-6" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {basketProducts.length ? (
                      basketProducts.map(item => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 rounded-2xl bg-[#F7F0E6] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <span className="font-semibold text-[#27324A]">
                              {item.name}
                            </span>
                            <p className="mt-1 text-xs font-medium text-[#746E73]">
                              {item.barcode} · {item.shop}
                            </p>
                          </div>
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="font-semibold text-[#A7653A]">
                              {item.price}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeProductFromBasket(item.id)}
                              className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#8D5132] transition hover:bg-[#F3E1CB] focus:outline-none focus:ring-2 focus:ring-[#A7653A]"
                              aria-label={`Remove ${item.name}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl bg-[#F7F0E6] px-4 py-5 text-sm font-semibold text-[#746E73]">
                        Scan or add a popular product to begin the basket.
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold text-[#27324A]">
                      Customer name
                      <input
                        value={customerName}
                        onChange={event => setCustomerName(event.target.value)}
                        placeholder="e.g. Anita Tamang"
                        className="min-h-12 rounded-2xl border border-[#2E3344]/10 bg-[#FFFBF4] px-4 text-sm outline-none transition focus:border-[#A7653A] focus:ring-2 focus:ring-[#A7653A]/20"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#27324A]">
                      Phone number
                      <input
                        value={customerPhone}
                        onChange={event => setCustomerPhone(event.target.value)}
                        placeholder="98XXXXXXXX"
                        className="min-h-12 rounded-2xl border border-[#2E3344]/10 bg-[#FFFBF4] px-4 text-sm outline-none transition focus:border-[#A7653A] focus:ring-2 focus:ring-[#A7653A]/20"
                      />
                    </label>
                  </div>
                  <label className="mt-3 grid gap-2 text-sm font-semibold text-[#27324A]">
                    Delivery note
                    <textarea
                      value={deliveryNote}
                      onChange={event => setDeliveryNote(event.target.value)}
                      placeholder="Gate color, substitution preference, pickup time..."
                      rows={3}
                      className="rounded-2xl border border-[#2E3344]/10 bg-[#FFFBF4] px-4 py-3 text-sm outline-none transition focus:border-[#A7653A] focus:ring-2 focus:ring-[#A7653A]/20"
                    />
                  </label>
                  <button
                    type="submit"
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#A7653A] px-5 text-sm font-semibold text-white shadow-lg shadow-[#A7653A]/18 transition hover:-translate-y-0.5 hover:bg-[#8E5432] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4"
                  >
                    Send order to {selectedOrderShop.name}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </button>

                  {submittedOrder ? (
                    <div className="mt-4 rounded-2xl border border-[#626A54]/20 bg-[#E8E3D1] px-4 py-3 text-sm font-semibold text-[#27324A]">
                      Order {submittedOrder.id} sent to {submittedOrder.shop}.
                      Estimated total: Rs.{" "}
                      {submittedOrder.total.toLocaleString()}.
                    </div>
                  ) : null}
                </form>
              </div>

              <div className="reveal-item min-w-0 rounded-[1.5rem] border border-[#2E3344]/8 bg-[#FFFBF4] p-3 shadow-2xl shadow-[#27324A]/12 sm:rounded-[2.25rem] sm:p-6">
                <div className="flex flex-col gap-4 rounded-[1.75rem] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
                      Stores with matching barcode stock
                    </p>
                    <h3 className="mt-1 text-2xl font-bold tracking-[-0.025em] text-[#27324A]">
                      Choose a shop inside 6km
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {orderFilters.map(filter => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setActiveOrderFilter(filter)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2 ${
                          activeOrderFilter === filter
                            ? "bg-[#A7653A] text-white"
                            : "bg-[#F7F0E6] text-[#746E73] hover:bg-[#F3E1CB]"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[#2E3344]/8 bg-white shadow-sm">
                  <div className="relative">
                    <MapView
                      initialCenter={customerFallbackLocation}
                      initialZoom={13}
                      className="h-[240px] w-full sm:h-[300px] lg:h-[340px]"
                      onMapReady={map => {
                        discoveryMapRef.current = map;
                      }}
                    />
                    <div className="absolute left-3 top-3 rounded-2xl bg-white/92 px-3 py-2 shadow-lg shadow-[#27324A]/12 backdrop-blur sm:left-4 sm:top-4 sm:px-4 sm:py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
                        Discovery radius
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#27324A]">
                        6km around customer
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredNearbyShops.map(shop => (
                    <button
                      key={shop.name}
                      type="button"
                      onClick={() => setActiveShopName(shop.name)}
                      className={`overflow-hidden rounded-[1.35rem] border text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-3 ${
                        selectedOrderShop.name === shop.name
                          ? "border-[#A7653A]/45 bg-[#FFF6EA]"
                          : "border-[#2E3344]/8 bg-white"
                      }`}
                    >
                      <img
                        src={shop.image}
                        alt={`${shop.name} storefront`}
                        className="h-28 w-full object-cover sm:h-24"
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
                              {shop.category}
                            </p>
                            <h4 className="mt-1 truncate text-base font-bold tracking-[-0.015em] text-[#27324A]">
                              {shop.name}
                            </h4>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#E8E3D1] px-2.5 py-1 text-[0.68rem] font-semibold text-[#626A54]">
                            {shop.distance} km
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-5 text-[#746E73]">
                          {shop.note}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] font-semibold text-[#746E73]">
                          <span className="rounded-full bg-[#F7F0E6] px-3 py-1">
                            {shop.eta}
                          </span>
                          <span className="rounded-full bg-[#F3E1CB] px-3 py-1 text-[#8D5132]">
                            {shop.status}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <aside className="mt-4 rounded-[1.35rem] border border-[#2E3344]/8 bg-[#27324A] p-4 text-white shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#D8C99A]">
                        Selected barcode-ready shop
                      </p>
                      <h4 className="mt-2 text-xl font-bold tracking-[-0.025em] sm:text-2xl">
                        {selectedOrderShop.name}
                      </h4>
                      <p className="mt-2 text-sm text-white/65">
                        {selectedOrderShop.distance} km away ·{" "}
                        {selectedOrderShop.eta} · {selectedOrderShop.queue}{" "}
                        orders in queue
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        addProductToBasket(
                          popularProducts.find(
                            product => product.shop === selectedOrderShop.name
                          )?.id ?? popularProducts[0].id
                        )
                      }
                      className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#27324A] transition hover:-translate-y-0.5 hover:bg-[#F3E1CB] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-4 focus:ring-offset-[#27324A] sm:w-auto"
                    >
                      Add shop match
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section
          id="owner-orders"
          className="reveal-section relative overflow-hidden bg-white py-14 sm:py-20 lg:py-24"
        >
          <div
            className="absolute right-[-5rem] top-20 h-72 w-72 rounded-full bg-[#D8C99A]/22 blur-3xl"
            aria-hidden="true"
          />
          <div className="container relative">
            <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
              <div className="reveal-item">
                <Eyebrow icon={MessageSquareText}>For shop owners</Eyebrow>
                <h2 className="mt-5 text-[clamp(2.25rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[#27324A]">
                  Customer requests arrive ready for action.
                </h2>
              </div>
              <p className="reveal-item max-w-3xl text-lg leading-8 text-[#5F5A61]">
                Once customers send a basket, shops see only what matters:
                items, payment, distance, and the next action.
              </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
              <div className="reveal-item overflow-hidden rounded-[2rem] border border-[#2E3344]/8 bg-[#F7F0E6] shadow-xl shadow-[#27324A]/10">
                <div className="flex flex-col gap-4 border-b border-[#2E3344]/8 bg-[#27324A] p-5 text-white md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D8C99A]">
                      Live order queue
                    </p>
                    <h3 className="mt-2 text-xl font-bold tracking-[-0.025em] sm:text-2xl">
                      Today’s incoming requests
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-white/10 px-3 py-2">
                      3 new
                    </span>
                    <span className="rounded-full bg-[#D8C99A] px-3 py-2 text-[#27324A]">
                      1 urgent
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-[#2E3344]/8">
                  {incomingOrders.map(order => (
                    <article
                      key={order.id}
                      className="grid gap-4 bg-white p-5 transition hover:bg-[#FFFBF4] xl:grid-cols-[0.9fr_1.15fr_0.75fr] xl:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#27324A] px-3 py-1 text-xs font-semibold text-white">
                            {order.id}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${order.priority === "Urgent" ? "bg-[#F3E1CB] text-[#8D5132]" : order.priority === "High" ? "bg-[#FFF0D6] text-[#A7653A]" : "bg-[#E8E3D1] text-[#626A54]"}`}
                          >
                            {order.priority}
                          </span>
                        </div>
                        <h4 className="mt-3 text-lg font-semibold tracking-[-0.015em] text-[#27324A]">
                          {order.customer}
                        </h4>
                        <p className="mt-1 text-sm text-[#746E73]">
                          {order.shop} · {order.distance} · {order.received}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#27324A]">
                          {order.items}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#746E73]">
                          {order.note}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
                          {order.payment}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <span className="inline-flex items-center justify-center rounded-full bg-[#F7F0E6] px-3 py-2 text-sm font-semibold text-[#27324A]">
                          {order.status}
                        </span>
                        <div className="grid grid-cols-2 gap-2 min-w-0">
                          <button className="min-h-10 rounded-full bg-[#A7653A] px-3 text-xs font-semibold text-white transition hover:bg-[#8E5432] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2">
                            Accept
                          </button>
                          <button className="min-h-10 rounded-full border border-[#2E3344]/12 bg-white px-3 text-xs font-semibold text-[#27324A] transition hover:border-[#A7653A]/40 focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2">
                            Message
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="reveal-item rounded-[2rem] border border-[#2E3344]/8 bg-[#27324A] p-6 text-white shadow-xl shadow-[#27324A]/16">
                <div className="grid h-13 w-13 place-items-center rounded-2xl bg-[#D8C99A] text-[#27324A]">
                  <Truck className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-6 text-2xl font-bold tracking-[-0.025em]">
                  Owner actions stay simple.
                </h3>
                <div className="mt-6 space-y-3">
                  {[
                    [
                      "Accept or review",
                      "Confirm stock before promising the customer.",
                    ],
                    [
                      "Pack and assign",
                      "Move the request into packing, pickup, or delivery.",
                    ],
                    [
                      "Message customer",
                      "Clarify substitutions, payment, or delivery notes.",
                    ],
                  ].map(([title, copy]) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-white/10 bg-white/8 p-4"
                    >
                      <p className="font-semibold text-[#D8C99A]">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/68">
                        {copy}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {quickSignals.slice(1).map(([value, label]) => (
                    <div
                      key={label}
                      className="rounded-2xl bg-white/8 p-3 text-center"
                    >
                      <p className="text-xl font-bold text-white">{value}</p>
                      <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-white/55">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="reveal-section relative overflow-hidden bg-[#222A3D] py-14 text-white sm:py-20 lg:py-24">
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `url(${patternImage})`,
              backgroundSize: "cover",
            }}
            aria-hidden="true"
          />
          <div className="container relative grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="reveal-item">
              <Eyebrow icon={ReceiptText}>Product preview</Eyebrow>
              <h2 className="mt-5 text-[clamp(2.25rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em]">
                A dashboard that feels like your daily operating desk.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 sm:mt-6 sm:text-lg sm:leading-8">
                The main dashboard leads with signals first, not long reports.
              </p>
              <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2">
                {[
                  "Fast billing",
                  "Stock alerts",
                  "Customer credit",
                  "Website orders",
                ].map(item => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur"
                  >
                    <Check className="mr-3 inline h-5 w-5 text-[#D8C99A]" />
                    <span className="font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="reveal-item relative">
              <div
                className="absolute -inset-5 rounded-[2rem] bg-[#A7653A]/15 blur-2xl"
                aria-hidden="true"
              />
              <img
                src={dashboardImage}
                alt="Illustration of Quivo dashboard panels for quick inventory, barcode matching, billing, calendar, and reports"
                className="relative w-full rounded-[1.35rem] border border-white/12 shadow-2xl shadow-black/25 sm:rounded-[2rem]"
              />
            </div>
          </div>
        </section>

        <section className="reveal-section bg-white py-14 sm:py-20 lg:py-24">
          <div className="container">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div className="reveal-item">
                <Eyebrow icon={CreditCard}>Hardware support</Eyebrow>
                <h2 className="mt-5 text-[clamp(2.25rem,4vw,4rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[#27324A]">
                  Works with the counter tools your shop already uses.
                </h2>
              </div>
              <p className="reveal-item max-w-3xl text-lg leading-8 text-[#5F5A61]">
                Receipt printers, barcode lookup, payments, and phones fit the
                same counter flow.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: ReceiptText,
                  title: "Receipt printers",
                  copy: "Prepare bills for compact thermal receipt printers used at busy counters.",
                },
                {
                  icon: PackageCheck,
                  title: "Barcode workflow",
                  copy: "Speed up product lookup and reduce manual entry during daily billing.",
                },
                {
                  icon: CreditCard,
                  title: "Payment counter",
                  copy: "Keep cash, digital wallet, and card records clear in the same sales flow.",
                },
                {
                  icon: Smartphone,
                  title: "Mobile devices",
                  copy: "Use Quivo on phones and tablets when the shop floor gets crowded.",
                },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="feature-card magnetic-card reveal-item min-w-0 rounded-[1.35rem] border border-[#2E3344]/8 bg-[#F7F0E6] p-5 shadow-sm transition-shadow hover:shadow-xl hover:shadow-[#27324A]/10 sm:rounded-[1.75rem] sm:p-6"
                  >
                    <div className="feature-icon grid h-13 w-13 place-items-center rounded-2xl bg-[#E8E3D1] text-[#626A54]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold tracking-[-0.015em] text-[#27324A] sm:mt-6 sm:text-xl">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-[0.98rem] leading-7 text-[#746E73]">
                      {item.copy}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

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
              {plans.map(plan => (
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
                    {plan.items.map(item => (
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
                    Detailed comparison of Quivo Starter and Growth pricing
                    plans
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
                    {pricingComparison.map(row => (
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
                  Short answers for shop owners comparing the free and paid
                  options.
                </p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {pricingFaqs.map(faq => (
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
      </main>

      <footer className="bg-[#1B2030] py-12 text-white">
        <div className="container flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#A7653A] font-bold">
                Q
              </span>
              <span className="text-xl font-bold">Quivo</span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/58">
              Quivo means Quick + Inventory: built for Nepali businesses that
              need fast stock answers, secure records, and easier shop
              operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm font-medium text-white/68">
            {["Features", "Pricing", "Support", "Privacy", "Terms"].map(
              link => (
                <a
                  key={link}
                  href="#top"
                  className="transition hover:text-[#D8C99A]"
                >
                  {link}
                </a>
              )
            )}
          </div>
          <p className="text-sm text-white/45">© 2026 Quivo Inc.</p>
        </div>
      </footer>
    </div>
  );
}
