"use client";

import { Save, Store, MapPin, Phone, Clock, FileText, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFontSize } from "@/components/FontProvider";
import { useState } from "react";
import { toast } from "sonner";
import { updateOwnerFontSize } from "@/app/actions/customer";

const FONT_SIZES = [
  { id: "small", label: "Small" },
  { id: "standard", label: "Std" },
  { id: "large", label: "Large" },
  { id: "xlarge", label: "XL" },
] as const;

export function ShopSettings() {
  const { ownerFontSize, setOwnerFontSize } = useFontSize();
  const [updatingFontSize, setUpdatingFontSize] = useState(false);

  const handleUpdateFontSize = async (size: (typeof FONT_SIZES)[number]["id"]) => {
    setUpdatingFontSize(true);
    setOwnerFontSize(size); // Optimistic UI update
    
    const result = await updateOwnerFontSize(size);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Owner UI scale set to ${size}`);
    }
    setUpdatingFontSize(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 text-[1rem]">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#27324A]">Shop Settings</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">Manage your basic business information and preferences.</p>
        </div>
        <Button className="rounded-xl h-11 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold px-6 shadow-sm">
          <Save className="h-4 w-4 mr-2" /> Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-2">
          {['General Details', 'Location & Hours', 'Payment Methods', 'Receipt Settings'].map((item, i) => (
            <button key={i} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition ${i === 0 ? 'bg-[#27324A] text-white shadow-md' : 'text-[#746E73] hover:bg-[#F7F0E6] hover:text-[#27324A]'}`}>
              {item}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3 flex items-center gap-2">
              <Store className="h-4 w-4" /> General Details
            </h2>
            <div className="space-y-4">
              <div>
                <Label className="font-bold text-[#27324A]">Store Name</Label>
                <Input defaultValue="Maitidevi Fresh Mart" className="h-12 rounded-xl mt-1.5" />
              </div>
              <div>
                <Label className="font-bold text-[#27324A]">Description / Tagline</Label>
                <Textarea defaultValue="Your friendly neighborhood grocery store. Quality products at the best prices." className="mt-1.5 rounded-xl resize-none" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Phone Number</Label>
                  <Input defaultValue="9800000000" className="h-12 rounded-xl mt-1.5" />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">PAN Number</Label>
                  <Input defaultValue="123456789" className="h-12 rounded-xl mt-1.5 bg-[#f8f8f7]" readOnly />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3 flex items-center gap-2">
              <Type className="h-4 w-4" /> Display Preference
            </h2>
            <div>
              <Label className="font-bold text-[#27324A] mb-3 block text-xs uppercase tracking-wider opacity-60">Dashboard UI Scale</Label>
              <div className="flex p-1 bg-[#E8E3D1]/40 rounded-2xl gap-1">
                {FONT_SIZES.map((sz) => (
                  <button
                    key={sz.id}
                    disabled={updatingFontSize}
                    onClick={() => handleUpdateFontSize(sz.id)}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition ${
                      ownerFontSize === sz.id
                        ? "bg-white text-[#27324A] shadow-sm"
                        : "text-[#746E73] hover:text-[#27324A]"
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#746E73] mt-3 font-medium italic text-center">
                Note: This scale only applies to the Shop Owner dashboard.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Operations
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-bold text-[#27324A]">Opening Time</Label>
                <Input type="time" defaultValue="07:00" className="h-12 rounded-xl mt-1.5" />
              </div>
              <div>
                <Label className="font-bold text-[#27324A]">Closing Time</Label>
                <Input type="time" defaultValue="21:00" className="h-12 rounded-xl mt-1.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
