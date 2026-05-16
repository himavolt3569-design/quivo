"use client";

import { startTransition, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import {
  Store,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  QrCode,
  AlertCircle,
  Loader2,
  Copy,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  Building2,
  Boxes,
  Clock,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/validated-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createShop } from "@/app/actions/owner";
import { LogoPicker } from "@/components/onboarding/LogoPicker";
import { KYCScanner, type KYCStatus } from "@/components/onboarding/KYCScanner";
import { createClient } from "@/lib/supabase/client";
import type { PinCoords } from "@/components/dashboard/customer/AddressPinPicker";

async function reverseGeocodeDetailed(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en`,
      { headers: { "User-Agent": "QuivoApp/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};

    const parts: string[] = [];
    const houseNum = a.house_number ?? "";
    const road = a.road || a.pedestrian || a.path || a.footway || a.highway || "";
    if (road) parts.push(houseNum ? `${houseNum} ${road}` : road);

    const locality =
      a.neighbourhood || a.quarter || a.suburb || a.village ||
      a.hamlet || a.town || "";
    if (locality && locality !== road) parts.push(locality);

    const city = a.city || a.municipality || a.county || a.state_district || "";
    if (city && city !== locality) parts.push(city);

    if (a.state && a.state !== city) parts.push(a.state);
    if (a.postcode) parts.push(a.postcode);

    return parts.length > 0
      ? parts.join(", ")
      : (data.display_name ?? "").split(",").slice(0, 4).join(",").trim();
  } catch {
    return null;
  }
}

// Leaflet map must not render on server
const AddressPinPicker = dynamic(
  () => import("@/components/dashboard/customer/AddressPinPicker").then((m) => m.AddressPinPicker),
  { ssr: false, loading: () => <div className="h-64 rounded-2xl bg-[#f0ede8] animate-pulse" /> }
);

interface ShopResult {
  shop_id: string;
  slug: string;
  qr_token: string;
  qr_target_url: string;
}

const STEPS = ["Business Type", "Shop Profile", "Location & KYC", "Review & Create"];

const CATEGORIES = [
  { id: "kirana", label: "Kirana Store", emoji: "🛒", active: true },
  { id: "clothes", label: "Clothing", emoji: "👗", active: false },
  { id: "electronics", label: "Electronics", emoji: "📱", active: false },
  { id: "laptop", label: "Computers", emoji: "💻", active: false },
  { id: "wine", label: "Wine Shop", emoji: "🍷", active: false },
  { id: "repair", label: "Repair Center", emoji: "🔧", active: false },
  { id: "mobile", label: "Mobile & Acc.", emoji: "📲", active: false },
  { id: "others", label: "Others", emoji: "📦", active: false },
];

const RETAILER_FEATURES = [
  { icon: <ShoppingCart className="h-4 w-4" />, text: "Public storefront for all customers" },
  { icon: <TrendingUp className="h-4 w-4" />, text: "Daily sales & revenue tracking" },
  { icon: <Users className="h-4 w-4" />, text: "Customer credit (Udhar) management" },
  { icon: <Package className="h-4 w-4" />, text: "Product inventory with alerts" },
];

const WHOLESALE_FEATURES = [
  { icon: <Boxes className="h-4 w-4" />, text: "Bulk order management & MOQ settings" },
  { icon: <Building2 className="h-4 w-4" />, text: "B2B storefront with quote requests" },
  { icon: <TrendingUp className="h-4 w-4" />, text: "Volume pricing & tiered discounts" },
  { icon: <Users className="h-4 w-4" />, text: "Business client relationship tools" },
];

function slugify(val: string): string {
  return val
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function OwnerOnboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ShopResult | null>(null);

  // Step 0
  const [businessType, setBusinessType] = useState<"retailer" | "wholesale">("retailer");
  const [category, setCategory] = useState("kirana");

  // Step 1
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [openingTime, setOpeningTime] = useState("07:00");
  const [closingTime, setClosingTime] = useState("21:00");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");

  // Step 2
  const [coords, setCoords] = useState<PinCoords | null>(null);
  const [address, setAddress] = useState("");
  const [addressFromPin, setAddressFromPin] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [kycStatus, setKycStatus] = useState<KYCStatus>("idle");
  const [kycConfidence, setKycConfidence] = useState(0);
  const [kycFile, setKycFile] = useState<File | null>(null);

  // Auto-derive slug from store name unless user edited it manually
  useEffect(() => {
    if (!slugEdited && storeName) {
      startTransition(() => setSlug(slugify(storeName)));
    }
  }, [storeName, slugEdited]);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugEdited(true);
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  };

  const handleLogoFile = useCallback((file: File, previewUrl: string) => {
    setLogoFile(file);
    setLogoPreviewUrl(previewUrl);
  }, []);

  const handleKYCResult = useCallback((status: KYCStatus, confidence: number, file: File | null) => {
    setKycStatus(status);
    setKycConfidence(confidence);
    setKycFile(file);
  }, []);

  const handleCoordsChange = useCallback(async (newCoords: PinCoords) => {
    setCoords(newCoords);
    setGeocoding(true);
    const detailed = await reverseGeocodeDetailed(newCoords.lat, newCoords.lng);
    setGeocoding(false);
    if (detailed) {
      setAddress(detailed);
      setAddressFromPin(true);
    }
  }, []);

  // Validation per step
  function validateStep(step: number): string | null {
    if (step === 0) {
      if (!category) return "Please select a shop category.";
    }
    if (step === 1) {
      if (!storeName.trim()) return "Store name is required.";
      if (!phone.trim()) return "Phone number is required.";
      if (!description.trim()) return "Description is required.";
      if (!slug.trim()) return "Public web address is required.";
      if (!openingTime || !closingTime) return "Opening and closing times are required.";
    }
    if (step === 2) {
      if (!coords) return "Please pin your shop location on the map.";
      if (!address.trim()) return "Shop address is required.";
      if (kycStatus === "scanning") return "Please wait for the document scan to complete.";
      if (kycStatus === "error") return "Document scan failed. Please upload a clearer image.";
    }
    return null;
  }

  function nextStep() {
    const err = validateStep(currentStep);
    if (err) {
      toast.error(err);
      return;
    }
    setCurrentStep((p) => Math.min(p + 1, STEPS.length - 1));
  }

  function prevStep() {
    setCurrentStep((p) => Math.max(p - 1, 0));
  }

  async function uploadToStorage(file: File, path: string): Promise<string | null> {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("shop_assets")
      .upload(path, file, { upsert: true });
    if (error) {
      console.error("Upload error", error);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage.from("shop_assets").getPublicUrl(data.path);
    return publicUrl;
  }

  async function handleSubmit() {
    const err = validateStep(2);
    if (err) { toast.error(err); return; }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not authenticated."); return; }

      const ts = Date.now();

      // Upload logo
      let logoUrl: string | undefined;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() ?? "png";
        const url = await uploadToStorage(logoFile, `${user.id}/logos/logo_${ts}.${ext}`);
        if (url) logoUrl = url;
      }

      // Upload KYC document
      let kycDocUrl: string | undefined;
      if (kycFile) {
        const ext = kycFile.name.split(".").pop() ?? "jpg";
        const url = await uploadToStorage(kycFile, `${user.id}/kyc/doc_${ts}.${ext}`);
        if (url) kycDocUrl = url;
      }

      const fd = new FormData();
      fd.set("name", storeName.trim());
      fd.set("business_type", businessType);
      fd.set("category", category);
      fd.set("phone", phone.trim());
      fd.set("address", address.trim());
      fd.set("description", description.trim());
      fd.set("subdomain", slug.trim());
      fd.set("opening_time", openingTime);
      fd.set("closing_time", closingTime);
      if (coords) {
        fd.set("lat", String(coords.lat));
        fd.set("lng", String(coords.lng));
      }
      if (logoUrl) fd.set("logo_url", logoUrl);
      if (kycDocUrl) fd.set("pan_document_url", kycDocUrl);
      fd.set("verification_status", kycStatus === "verified" ? "verified" : kycStatus === "pending" ? "pending" : "unverified");
      if (kycConfidence > 0) fd.set("kyc_confidence", String(kycConfidence));

      const res = await createShop(fd);
      if ("error" in res && res.error) { toast.error(res.error); return; }
      if (!("success" in res) || !res.success) { toast.error("Could not create shop. Please try again."); return; }

      setResult({
        shop_id: res.shop_id,
        slug: res.slug,
        qr_token: res.qr_token,
        qr_target_url: res.qr_target_url,
      });
      setCurrentStep(3);
      toast.success("Shop created successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F0E6] flex flex-col sm:items-center sm:justify-center sm:p-4 sm:py-12">
      <div className="w-full flex-1 sm:flex-none sm:max-w-3xl bg-white sm:rounded-[2.5rem] sm:shadow-xl sm:border border-[#2E3344]/8 overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-[#27324A] p-5 sm:p-8 text-white shrink-0">
          <div className="flex items-center gap-3 mb-5 sm:mb-6">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Store className="h-4 w-4 sm:h-5 sm:w-5 text-[#D8C99A]" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-black tracking-wide">Quivo for Business</h1>
              <p className="text-[10px] text-white/60 font-medium uppercase tracking-widest">Set up your online shop</p>
            </div>
          </div>

          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 rounded-full" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#A7653A] rounded-full transition-all duration-500"
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />
            {STEPS.map((step, idx) => (
              <div key={step} className="relative z-10 flex flex-col items-center">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  idx < currentStep
                    ? "bg-[#A7653A] text-white shadow-lg shadow-[#A7653A]/40"
                    : idx === currentStep
                    ? "bg-[#A7653A] text-white ring-2 ring-white/30 ring-offset-1 ring-offset-[#27324A] shadow-lg"
                    : "bg-[#1b2333] text-white/40"
                }`}>
                  {idx < currentStep ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
              </div>
            ))}
          </div>
          {/* Step labels — only visible on sm+ to prevent overflow on phones */}
          <div className="hidden sm:flex justify-between mt-2 text-[9px] font-bold text-white/50 uppercase tracking-widest">
            {STEPS.map((step, idx) => (
              <span key={step} className={idx <= currentStep ? "text-[#D8C99A]" : ""}>{step}</span>
            ))}
          </div>
          {/* Current step name on mobile */}
          <p className="sm:hidden mt-2 text-[10px] font-bold text-[#D8C99A] uppercase tracking-widest text-center">
            Step {currentStep + 1} of {STEPS.length} — {STEPS[currentStep]}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-10">

          {/* ── Step 0: Business Type ── */}
          {currentStep === 0 && (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-right-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#27324A]">Business Type</h2>
                <p className="text-sm text-[#746E73] mt-1">Choose how you primarily operate.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Retailer Card */}
                <button
                  type="button"
                  onClick={() => setBusinessType("retailer")}
                  className={`rounded-2xl border-2 p-4 sm:p-5 text-left transition-all ${
                    businessType === "retailer"
                      ? "border-[#A7653A] bg-[#F7F0E6]"
                      : "border-[#2E3344]/10 hover:border-[#A7653A]/40 hover:bg-[#F7F0E6]/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-[#A7653A]/10 flex items-center justify-center shrink-0">
                        <ShoppingCart className="h-4 w-4 text-[#A7653A]" />
                      </div>
                      <p className="font-black text-[#27324A] text-base">Retailer</p>
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      businessType === "retailer" ? "border-[#A7653A] bg-[#A7653A]" : "border-[#2E3344]/20"
                    }`}>
                      {businessType === "retailer" && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-[#746E73] mb-3">Sell directly to end consumers, both in-store and online.</p>
                  <ul className="space-y-1.5">
                    {RETAILER_FEATURES.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-[#27324A]">
                        <span className="text-[#A7653A] shrink-0">{f.icon}</span>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </button>

                {/* Wholesale Card */}
                <button
                  type="button"
                  onClick={() => setBusinessType("wholesale")}
                  className={`rounded-2xl border-2 p-4 sm:p-5 text-left transition-all ${
                    businessType === "wholesale"
                      ? "border-[#27324A] bg-[#27324A]/5"
                      : "border-[#2E3344]/10 hover:border-[#27324A]/40 hover:bg-[#27324A]/5"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-[#27324A]/10 flex items-center justify-center shrink-0">
                        <Boxes className="h-4 w-4 text-[#27324A]" />
                      </div>
                      <p className="font-black text-[#27324A] text-base">Wholesaler</p>
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      businessType === "wholesale" ? "border-[#27324A] bg-[#27324A]" : "border-[#2E3344]/20"
                    }`}>
                      {businessType === "wholesale" && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                  <p className="text-xs text-[#746E73] mb-3">Sell in bulk to businesses and retailers with MOQ requirements.</p>
                  <ul className="space-y-1.5">
                    {WHOLESALE_FEATURES.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-[#27324A]">
                        <span className="text-[#27324A]/70 shrink-0">{f.icon}</span>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </button>
              </div>

              {/* Category */}
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#27324A] mb-1">
                  Shop Category <span className="text-red-500">*</span>
                </h2>
                <p className="text-xs text-[#746E73] mb-3">What best describes your store?</p>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={!cat.active}
                      onClick={() => cat.active && setCategory(cat.id)}
                      className={`py-2.5 px-1 rounded-xl border-2 text-[11px] sm:text-xs font-bold text-center transition-all leading-tight ${
                        cat.active && category === cat.id
                          ? "border-[#A7653A] bg-[#F7F0E6] text-[#A7653A]"
                          : cat.active
                          ? "border-[#2E3344]/10 hover:border-[#A7653A]/40 text-[#27324A]"
                          : "border-[#2E3344]/5 bg-[#f8f8f7] text-[#2E3344]/30 cursor-not-allowed"
                      }`}
                    >
                      <span className="block text-lg sm:text-xl mb-1">{cat.emoji}</span>
                      {cat.label}
                      {!cat.active && (
                        <span className="block text-[8px] mt-0.5 uppercase tracking-widest text-[#A7653A]/40">Soon</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Shop Profile ── */}
          {currentStep === 1 && (
            <div className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-right-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#27324A]">Shop Profile</h2>
                <p className="text-sm text-[#746E73] mt-1">All fields are required.</p>
              </div>

              <div>
                <Label className="text-[#27324A] font-bold text-sm">
                  Store Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Maitidevi Fresh Mart"
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>

              <div>
                <Label className="text-[#27324A] font-bold text-sm">
                  Public Web Address <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-stretch mt-1.5">
                  <div className="h-12 px-2.5 sm:px-3 bg-[#f0ede8] border border-r-0 border-[#2E3344]/10 rounded-l-xl flex items-center text-[#746E73] font-mono whitespace-nowrap text-[10px] sm:text-xs">
                    <span className="hidden sm:inline">quivo.com</span>/s/
                  </div>
                  <Input
                    value={slug}
                    onChange={handleSlugChange}
                    placeholder="your-shop-name"
                    className="h-12 rounded-l-none rounded-r-xl font-mono text-sm flex-1 min-w-0"
                  />
                </div>
                <p className="text-[10px] text-[#746E73] font-medium mt-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Customers will use this link to shop from you. Cannot be changed later.
                </p>
              </div>

              <div>
                <Label className="text-[#27324A] font-bold text-sm">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <PhoneInput
                  required
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98XXXXXXXX"
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>

              <div>
                <Label className="text-[#27324A] font-bold text-sm">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell customers what you sell and what makes your shop special…"
                  className="mt-1.5 rounded-xl resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[#27324A] font-bold text-sm flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Opening <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-[#27324A] font-bold text-sm flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Closing <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[#27324A] font-bold text-sm mb-2 block">
                  Store Logo <span className="text-[#746E73] font-normal text-xs">(optional — can add later)</span>
                </Label>
                <LogoPicker onFile={handleLogoFile} previewUrl={logoPreviewUrl} />
              </div>
            </div>
          )}

          {/* ── Step 2: Location & KYC ── */}
          {currentStep === 2 && (
            <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#27324A]">Location & KYC</h2>
                <p className="text-sm text-[#746E73] mt-1">
                  Pin your shop location. Business proof can be submitted now or within 30 days after launch.
                </p>
              </div>

              <div>
                <Label className="text-[#27324A] font-bold text-sm flex items-center gap-1.5 mb-2">
                  <MapPin className="h-4 w-4 text-[#A7653A]" />
                  Shop Location <span className="text-red-500">*</span>
                </Label>
                <div className="rounded-2xl overflow-hidden border border-[#2E3344]/10 h-64">
                  <AddressPinPicker
                    value={coords}
                    onChange={handleCoordsChange}
                  />
                </div>
                <p className="text-[10px] text-[#746E73] mt-1.5">Drag the pin, tap the map, or search — address fills automatically.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[#27324A] font-bold text-sm">
                    Shop Address <span className="text-red-500">*</span>
                  </Label>
                  {geocoding && (
                    <span className="flex items-center gap-1 text-[10px] text-[#746E73]">
                      <Loader2 className="h-3 w-3 animate-spin" /> Fetching address…
                    </span>
                  )}
                  {!geocoding && addressFromPin && coords && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-600">
                      <MapPin className="h-3 w-3" /> Synced from pin
                    </span>
                  )}
                  {!geocoding && !addressFromPin && address && (
                    <button
                      type="button"
                      className="text-[10px] font-bold text-[#A7653A] hover:underline"
                      onClick={async () => {
                        if (!coords) return;
                        setGeocoding(true);
                        const detailed = await reverseGeocodeDetailed(coords.lat, coords.lng);
                        setGeocoding(false);
                        if (detailed) { setAddress(detailed); setAddressFromPin(true); }
                      }}
                    >
                      Reset to pin location
                    </button>
                  )}
                </div>
                <Textarea
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setAddressFromPin(false); }}
                  placeholder="Move the pin above — address fills automatically"
                  className="rounded-xl resize-none"
                  rows={2}
                />
              </div>

              <div>
                <Label className="text-[#27324A] font-bold text-sm mb-2 block">
                  Business Document
                  <span className="text-[#746E73] font-normal text-xs block sm:inline sm:ml-2">
                    Optional for first 30 days — PAN / VAT / Registration Certificate
                  </span>
                </Label>
                <KYCScanner onResult={handleKYCResult} />
                <p className="text-[10px] text-[#746E73] mt-2 flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  You can skip this for now. We will email reminders, and owner features require documents after 30 days.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 3: Review & Create ── */}
          {currentStep === 3 && !result && (
            <div className="space-y-5 sm:space-y-6 animate-in fade-in slide-in-from-right-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#27324A]">Review & Launch</h2>
                <p className="text-sm text-[#746E73] mt-1">Everything look correct? Create your shop to go live.</p>
              </div>

              <div className="space-y-3">
                <ReviewRow label="Business Type" value={businessType === "wholesale" ? "Wholesaler" : "Retailer"} />
                <ReviewRow label="Category" value={CATEGORIES.find((c) => c.id === category)?.label ?? category} />
                <ReviewRow label="Store Name" value={storeName} />
                <ReviewRow label="Public URL" value={`quivo.com/s/${slug}`} mono />
                <ReviewRow label="Phone" value={phone} />
                <ReviewRow label="Description" value={description} />
                <ReviewRow label="Hours" value={`${openingTime} – ${closingTime}`} />
                <ReviewRow label="Logo" value={logoFile ? logoFile.name : "Not uploaded (can add later)"} />
                <ReviewRow
                  label="KYC Status"
                  value={
                    kycStatus === "verified"
                      ? `Document uploaded (${kycConfidence}% confidence)`
                      : kycStatus === "pending"
                      ? `Document uploaded (${kycConfidence}% confidence)`
                      : "Due within 30 days"
                  }
                />
                <ReviewRow label="Location" value={coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "—"} />
              </div>

              {kycStatus === "pending" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Your shop will be created now. You have 30 days to submit or re-submit business proof from KYC Settings.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {currentStep === 3 && result && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 text-center">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-green-50 border-2 border-green-200 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-[#27324A]">Shop Created!</h2>
                <p className="text-sm text-[#746E73] mt-1">
                  {kycStatus === "verified"
                    ? "Your shop is live. Submit final business proof from KYC Settings if requested."
                    : "Your shop is live. You have 30 days to submit business proof."}
                </p>
              </div>

              <div className="bg-[#f8f8f7] rounded-2xl p-5 sm:p-6 text-left border border-[#2E3344]/5 max-w-sm mx-auto">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A7653A] mb-3">Your Public Storefront</p>
                <div className="flex items-center gap-2">
                  <a
                    href={`/s/${result.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-[#27324A] font-mono font-bold hover:underline break-all text-sm"
                  >
                    /s/{result.slug}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`${window.location.origin}/s/${result.slug}`, "Storefront URL")}
                    className="rounded-lg p-1.5 text-[#746E73] hover:bg-[#A7653A]/10 hover:text-[#A7653A] transition"
                    aria-label="Copy URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-5 pt-5 border-t border-[#2E3344]/5 flex flex-col items-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#A7653A] mb-3">Shop QR Code</p>
                  <div className="h-32 w-32 bg-white rounded-xl shadow-sm border border-[#2E3344]/5 flex items-center justify-center">
                    <QrCode className="h-20 w-20 text-[#27324A]" />
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.qr_target_url, "QR link")}
                    className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-[#A7653A] hover:underline"
                  >
                    <Copy className="h-3 w-3" /> Copy QR link
                  </button>
                  <p className="text-xs text-[#746E73] mt-2 text-center">
                    Printed QR codes keep working even if you rename your shop later.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 sm:mt-10 flex items-center justify-between pt-5 sm:pt-6 border-t border-[#2E3344]/5">
            <Button
              type="button"
              variant="ghost"
              onClick={prevStep}
              disabled={currentStep === 0 || submitting || (currentStep === 3 && !!result)}
              className="rounded-xl font-bold"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>

            {currentStep < 2 && (
              <Button
                type="button"
                onClick={nextStep}
                className="rounded-xl font-bold bg-[#A7653A] hover:bg-[#8D5132] text-white"
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {currentStep === 2 && (
              <Button
                type="button"
                onClick={nextStep}
                className="rounded-xl font-bold bg-[#A7653A] hover:bg-[#8D5132] text-white"
              >
                Review <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {currentStep === 3 && !result && (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-xl font-bold bg-[#A7653A] hover:bg-[#8D5132] text-white"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating shop…</>
                ) : (
                  <>Create Shop <ChevronRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            )}

            {currentStep === 3 && result && (
              <Button
                type="button"
                onClick={() => router.push("/dashboard/owner")}
                className="rounded-xl font-bold bg-[#27324A] hover:bg-[#1b2333] text-white"
              >
                Go to Dashboard <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-2.5 border-b border-[#2E3344]/5 last:border-0 sm:flex sm:items-start sm:justify-between sm:gap-4">
      <span className="block text-[10px] font-bold text-[#746E73] uppercase tracking-wide mb-0.5 sm:mb-0 sm:shrink-0">{label}</span>
      <span className={`block text-sm text-[#27324A] font-semibold sm:text-right break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}
