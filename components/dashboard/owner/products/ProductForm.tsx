"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft,
  Save,
  Barcode,
  Image as ImageIcon,
  AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProductForm() {
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [productName, setProductName] = useState("");

  const handleNameBlur = () => {
    // Simulate duplicate detection logic
    if (productName.toLowerCase().includes("jeera")) {
      setDuplicateWarning(true);
    } else {
      setDuplicateWarning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/owner/products">
            <Button variant="ghost" className="h-10 w-10 p-0 rounded-full hover:bg-white">
              <ArrowLeft className="h-5 w-5 text-[#27324A]" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-[#27324A]">Add Product</h1>
            <p className="text-xs font-medium text-[#746E73] mt-0.5">Create a new item in your catalog</p>
          </div>
        </div>
        <Button className="rounded-xl h-11 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold px-6">
          <Save className="h-4 w-4 mr-2" /> Save Product
        </Button>
      </div>

      {duplicateWarning && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-black text-orange-900">Similar Product Found</h3>
              <p className="text-xs text-orange-800 font-medium mt-1">A product named "{productName}" already exists in your inventory. Do you want to update its stock instead of creating a duplicate?</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" className="bg-white border-orange-200 text-orange-700 hover:bg-orange-100 rounded-xl h-9 text-xs">
              View Existing
            </Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-9 text-xs font-bold">
              Update Stock
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <Label className="font-bold text-[#27324A]">Product Name <span className="text-red-500">*</span></Label>
                <Input 
                  placeholder="e.g. Current Noodles" 
                  className="h-12 rounded-xl mt-1.5" 
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  onBlur={handleNameBlur}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Brand / Manufacturer</Label>
                  <Input placeholder="e.g. CG Foods" className="h-12 rounded-xl mt-1.5" />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">Category <span className="text-red-500">*</span></Label>
                  <select className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 mt-1.5">
                    <option>Grocery</option>
                    <option>Dairy</option>
                    <option>Beverages</option>
                    <option>Personal Care</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Unit Size</Label>
                  <Input placeholder="e.g. 75" className="h-12 rounded-xl mt-1.5" />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">Unit Type</Label>
                  <select className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm mt-1.5 outline-none focus:ring-1">
                    <option>g</option>
                    <option>kg</option>
                    <option>ml</option>
                    <option>L</option>
                    <option>pcs</option>
                    <option>packet</option>
                    <option>sack</option>
                  </select>
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">Variant/Flavor</Label>
                  <Input placeholder="e.g. Hot & Spicy" className="h-12 rounded-xl mt-1.5" />
                </div>
              </div>

              <div>
                <Label className="font-bold text-[#27324A]">Description</Label>
                <Textarea placeholder="Optional details..." className="mt-1.5 rounded-xl resize-none min-h-[100px]" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">Pricing & Inventory</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Cost Price (Rs.)</Label>
                  <Input type="number" placeholder="0.00" className="h-12 rounded-xl mt-1.5 bg-[#f8f8f7]" />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">Selling Price (Rs.) <span className="text-red-500">*</span></Label>
                  <Input type="number" placeholder="0.00" className="h-12 rounded-xl mt-1.5" />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Current Stock</Label>
                  <Input type="number" placeholder="0" className="h-12 rounded-xl mt-1.5" />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">Low Stock Alert At</Label>
                  <Input type="number" placeholder="5" className="h-12 rounded-xl mt-1.5" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">Product Image</h2>
            <div className="border-2 border-dashed border-[#2E3344]/10 rounded-2xl h-48 flex flex-col items-center justify-center gap-2 hover:bg-[#F7F0E6]/30 transition cursor-pointer">
              <div className="h-10 w-10 rounded-full bg-[#f8f8f7] flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-[#746E73]" />
              </div>
              <span className="text-xs font-bold text-[#27324A]">Upload Image</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">Barcode (SKU)</h2>
            <div className="space-y-4">
              <div>
                <Label className="font-bold text-[#27324A]">Scan or Enter Barcode</Label>
                <div className="flex mt-1.5">
                  <Input placeholder="e.g. 8941000..." className="h-12 rounded-r-none rounded-l-xl font-mono" />
                  <Button className="h-12 rounded-l-none rounded-r-xl bg-[#F7F0E6] text-[#A7653A] hover:bg-[#A7653A] hover:text-white border border-l-0 border-[#2E3344]/10 shadow-none px-4">
                    <Barcode className="h-5 w-5" />
                  </Button>
                </div>
                <p className="text-[10px] text-[#746E73] mt-1 font-medium">Leave blank to auto-generate a Quivo barcode.</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
