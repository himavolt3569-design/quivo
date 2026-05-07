import {
  PackageCheck,
  ReceiptText,
  Globe2,
  WalletCards,
  Languages,
  BarChart3,
  Barcode,
  Crosshair,
  ShoppingBag,
} from "lucide-react";

export const heroImage =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663610877397/gFDkdUTrN3mp6bv4rWCT6G/quivo-hero-shopkeeper-inventory-kgFvw7L4GXqgaGBnd4JV5C.webp";
export const dashboardImage =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663610877397/gFDkdUTrN3mp6bv4rWCT6G/quivo-dashboard-receipt-panel-CMJw96uG32q4kWkLcgUbqw.webp";
export const patternImage =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663610877397/gFDkdUTrN3mp6bv4rWCT6G/quivo-retail-pattern-QepqFeaTxq8yNa7E6GhW35.webp";

export const features = [
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

export const stats = [
  { value: "1,000+", label: "shops ready to grow" },
  { value: "3 sec", label: "barcode lookup" },
  { value: "6 km", label: "nearby shop discovery" },
  { value: "24/7", label: "scan-to-order" },
];

export const plans = [
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

export const pricingComparison = [
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

export const pricingFaqs = [
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

export const customerFallbackLocation = { lat: 27.7108, lng: 85.324 };

export const nearbyShops = [
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

export const orderFilters = ["All", "Grocery", "Pharmacy", "Electronics"];

export const popularProducts = [
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

export const customerDealItems = popularProducts.slice(0, 3);

export const customerSearchChips = [
  "Scan rice barcode",
  "Scan milk",
  "Medicine barcode",
  "Phone charger",
  "Baby care",
  "Snacks",
];

export const barcodeSteps = [
  { label: "Scan", detail: "Point camera at barcode", icon: Barcode },
  { label: "Match", detail: "Quivo checks nearby stock", icon: Crosshair },
  { label: "Order", detail: "Send basket to the shop", icon: ShoppingBag },
];

export const navigationItems = [
  ["Features", "features"],
  ["Shop nearby", "orders"],
  ["For shops", "owner-orders"],
  ["Pricing", "pricing"],
  ["Stories", "stories"],
  ["Security", "security"],
] as const;

export const counterFlow = [
  { label: "Bill", detail: "Fast checkout", icon: ReceiptText },
  { label: "Stock", detail: "Auto update", icon: PackageCheck },
  { label: "Credit", detail: "Dues clear", icon: WalletCards },
  { label: "Order", detail: "Nearby request", icon: ShoppingBag },
];

export const quickSignals = [
  ["18", "low stock"],
  ["₨ 42k", "today sales"],
  ["7", "credit follow-ups"],
  ["3", "orders waiting"],
];

export const incomingOrders = [
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

export const testimonials = [
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
