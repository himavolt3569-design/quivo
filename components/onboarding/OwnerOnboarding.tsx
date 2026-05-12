"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Store,
  MapPin,
  UploadCloud,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  QrCode,
  AlertCircle,
  Loader2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { createShop } from "@/app/actions/owner";

interface ShopResult {
  shop_id: string;
  slug: string;
  qr_token: string;
  qr_target_url: string;
}

const STEPS = [
  "Business Details",
  "Shop Profile",
  "Location & Documents",
  "Review & Launch",
];

const CATEGORIES = [
  { id: "kirana", label: "Kirana Store", active: true },
  { id: "wine", label: "Wine Shop", active: false },
  { id: "clothes", label: "Clothing", active: false },
  { id: "electronics", label: "Electronics", active: false },
  { id: "mobile", label: "Mobile & Accessories", active: false },
  { id: "laptop", label: "Laptop & Computers", active: false },
  { id: "repair", label: "Repair Center", active: false },
  { id: "others", label: "Others", active: false },
];

export function OwnerOnboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ShopResult | null>(null);
  const [formData, setFormData] = useState({
    businessType: "retailer",
    category: "kirana",
    storeName: "",
    subdomain: "",
    phone: "",
    description: "",
    address: "",
    openingTime: "07:00",
    closingTime: "21:00",
  });

  const nextStep = () => setCurrentStep((p) => Math.min(p + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((p) => Math.max(p - 1, 0));

  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setFormData({ ...formData, subdomain: val });
  };

  const handleSubmit = async () => {
    if (!formData.storeName.trim()) {
      toast.error("Store name is required");
      setCurrentStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("name", formData.storeName.trim());
      fd.set("business_type", formData.businessType);
      fd.set("category", formData.category);
      fd.set("phone", formData.phone.trim());
      fd.set("address", formData.address.trim());
      fd.set("description", formData.description.trim());
      fd.set("subdomain", formData.subdomain.trim());
      fd.set("opening_time", formData.openingTime);
      fd.set("closing_time", formData.closingTime);

      const res = await createShop(fd);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if (!("success" in res) || !res.success) {
        toast.error("Could not create shop. Please try again.");
        return;
      }
      setResult({
        shop_id: res.shop_id,
        slug: res.slug,
        qr_token: res.qr_token,
        qr_target_url: res.qr_target_url,
      });
      setCurrentStep(3);
      toast.success("Shop created");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F0E6] flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-3xl bg-white rounded-[2.5rem] shadow-xl border border-[#2E3344]/8 overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#27324A] p-8 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Store className="h-5 w-5 text-[#D8C99A]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wide">Quivo for Business</h1>
              <p className="text-xs text-white/60 font-medium uppercase tracking-widest">Setup your online shop</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 rounded-full" />
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#A7653A] rounded-full transition-all duration-500" 
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />
            {STEPS.map((step, idx) => (
              <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                  idx <= currentStep ? 'bg-[#A7653A] text-white shadow-lg shadow-[#A7653A]/40' : 'bg-[#1b2333] text-white/40'
                }`}>
                  {idx < currentStep ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-bold text-white/60 uppercase tracking-widest">
            {STEPS.map((step, idx) => (
              <span key={step} className={idx <= currentStep ? 'text-[#D8C99A]' : ''}>{step}</span>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8 sm:p-12">
          {currentStep === 0 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div>
                <h2 className="text-2xl font-black text-[#27324A]">Business Type</h2>
                <p className="text-sm text-[#746E73] mt-1">How do you primarily operate?</p>
                <RadioGroup 
                  defaultValue={formData.businessType} 
                  onValueChange={(v) => setFormData({...formData, businessType: v})}
                  className="grid grid-cols-2 gap-4 mt-4"
                >
                  <Label className="cursor-pointer">
                    <RadioGroupItem value="retailer" className="peer sr-only" />
                    <div className="rounded-2xl border-2 border-[#2E3344]/10 p-4 hover:bg-[#F7F0E6]/50 peer-data-[state=checked]:border-[#A7653A] peer-data-[state=checked]:bg-[#F7F0E6] transition-all">
                      <p className="font-bold text-[#27324A]">Retailer</p>
                      <p className="text-xs text-[#746E73] mt-1">I sell directly to end consumers.</p>
                    </div>
                  </Label>
                  <Label className="cursor-pointer">
                    <RadioGroupItem value="wholesale" className="peer sr-only" />
                    <div className="rounded-2xl border-2 border-[#2E3344]/10 p-4 hover:bg-[#F7F0E6]/50 peer-data-[state=checked]:border-[#A7653A] peer-data-[state=checked]:bg-[#F7F0E6] transition-all">
                      <p className="font-bold text-[#27324A]">Wholesaler</p>
                      <p className="text-xs text-[#746E73] mt-1">I sell in bulk to other businesses.</p>
                    </div>
                  </Label>
                </RadioGroup>
              </div>

              <div>
                <h2 className="text-2xl font-black text-[#27324A]">Shop Category</h2>
                <p className="text-sm text-[#746E73] mt-1">What best describes your store? (Currently only Kirana is supported)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      disabled={!cat.active}
                      onClick={() => setFormData({...formData, category: cat.id})}
                      className={`p-4 rounded-2xl border-2 text-sm font-bold text-center transition-all ${
                        cat.active && formData.category === cat.id
                          ? 'border-[#A7653A] bg-[#F7F0E6] text-[#A7653A]'
                          : cat.active
                          ? 'border-[#2E3344]/10 hover:border-[#A7653A]/40 text-[#27324A]'
                          : 'border-[#2E3344]/5 bg-[#f8f8f7] text-[#2E3344]/30 cursor-not-allowed'
                      }`}
                    >
                      {cat.label}
                      {!cat.active && <span className="block text-[9px] mt-1 uppercase tracking-widest text-[#A7653A]/50">Coming Soon</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-black text-[#27324A]">Shop Profile</h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-[#27324A] font-bold">Store Name</Label>
                  <Input 
                    value={formData.storeName}
                    onChange={(e) => setFormData({...formData, storeName: e.target.value})}
                    placeholder="e.g. Maitidevi Fresh Mart" 
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-[#27324A] font-bold">Public Web Address (Subdomain)</Label>
                  <div className="flex items-center mt-1.5">
                    <Input 
                      value={formData.subdomain}
                      onChange={handleSubdomainChange}
                      placeholder="maitidevi" 
                      className="h-12 rounded-r-none rounded-l-xl text-right font-mono"
                    />
                    <div className="h-12 px-4 bg-[#f8f8f7] border border-l-0 border-[#2E3344]/10 rounded-r-xl flex items-center text-[#746E73] font-mono text-sm">
                      .quivo.com
                    </div>
                  </div>
                  <p className="text-[10px] text-[#746E73] font-bold mt-1.5 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Customers will visit this link to buy from you online.
                  </p>
                </div>
                <div>
                  <Label className="text-[#27324A] font-bold">Store Logo</Label>
                  <div className="mt-1.5 border-2 border-dashed border-[#2E3344]/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-[#F7F0E6]/30 transition cursor-pointer">
                    <div className="h-10 w-10 rounded-full bg-[#A7653A]/10 flex items-center justify-center">
                      <UploadCloud className="h-5 w-5 text-[#A7653A]" />
                    </div>
                    <span className="text-sm font-bold text-[#27324A]">Click to upload logo</span>
                    <span className="text-xs text-[#746E73]">PNG, JPG up to 2MB</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[#27324A] font-bold">Opening Time</Label>
                    <Input type="time" value={formData.openingTime} onChange={(e) => setFormData({...formData, openingTime: e.target.value})} className="h-12 rounded-xl mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-[#27324A] font-bold">Closing Time</Label>
                    <Input type="time" value={formData.closingTime} onChange={(e) => setFormData({...formData, closingTime: e.target.value})} className="h-12 rounded-xl mt-1.5" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h2 className="text-2xl font-black text-[#27324A]">Location & KYC</h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-[#27324A] font-bold flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Shop Address
                  </Label>
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter full street address"
                    className="mt-1.5 rounded-xl resize-none"
                    rows={3}
                  />
                  <Button variant="outline" className="mt-2 text-xs font-bold w-full rounded-xl border-dashed">
                    <MapPin className="h-3 w-3 mr-2" /> Auto-detect Current Location
                  </Button>
                </div>
                <div>
                  <Label className="text-[#27324A] font-bold">PAN / Registration Document</Label>
                  <div className="mt-1.5 border-2 border-dashed border-[#2E3344]/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-[#F7F0E6]/30 transition cursor-pointer">
                    <div className="h-10 w-10 rounded-full bg-[#A7653A]/10 flex items-center justify-center">
                      <UploadCloud className="h-5 w-5 text-[#A7653A]" />
                    </div>
                    <span className="text-sm font-bold text-[#27324A]">Upload Business Document</span>
                    <span className="text-xs text-[#746E73]">Required for verified merchant badge</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 text-center">
              <div className="h-20 w-20 rounded-full bg-[#E8E3D1] mx-auto flex items-center justify-center mb-6">
                <Store className="h-10 w-10 text-[#A7653A]" />
              </div>
              <h2 className="text-3xl font-black text-[#27324A]">Shop Created!</h2>
              <p className="text-[#746E73]">Your Kirana store is live and ready to set up products.</p>

              <div className="bg-[#f8f8f7] rounded-2xl p-6 text-left border border-[#2E3344]/5 max-w-sm mx-auto mt-8">
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
                    aria-label="Copy storefront URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-6 pt-6 border-t border-[#2E3344]/5 flex flex-col items-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#A7653A] mb-3">Shop QR Code</p>
                  <div className="h-32 w-32 bg-white rounded-xl shadow-sm border border-[#2E3344]/5 flex items-center justify-center">
                    <QrCode className="h-20 w-20 text-[#27324A]" />
                  </div>
                  <p className="text-[10px] text-[#746E73] mt-3 text-center font-mono break-all px-2">
                    {result.qr_target_url}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.qr_target_url, "QR target URL")}
                    className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold text-[#A7653A] hover:underline"
                  >
                    <Copy className="h-3 w-3" /> Copy QR link
                  </button>
                  <p className="text-xs text-[#746E73] mt-3 text-center">
                    Printed QR codes will keep working even if you rename your storefront later.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && !result && (
            <div className="text-center py-12 text-sm text-[#746E73]">
              Finish the previous steps to create your shop.
            </div>
          )}

          {/* Footer Navigation */}
          <div className="mt-12 flex items-center justify-between pt-6 border-t border-[#2E3344]/5">
            <Button
              variant="ghost"
              onClick={prevStep}
              disabled={currentStep === 0 || submitting || currentStep === 3}
              className="rounded-xl font-bold"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>

            {currentStep < 2 && (
              <Button
                onClick={nextStep}
                className="rounded-xl font-bold bg-[#A7653A] hover:bg-[#8D5132] text-white"
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {currentStep === 2 && (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-xl font-bold bg-[#A7653A] hover:bg-[#8D5132] text-white"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating shop…
                  </>
                ) : (
                  <>
                    Create shop <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}

            {currentStep === 3 && (
              <Button
                onClick={() => router.push("/dashboard/owner")}
                disabled={!result}
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