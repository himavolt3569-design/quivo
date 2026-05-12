"use client";

import { useState } from "react";
import { 
  QrCode, 
  Download, 
  Printer, 
  Share2, 
  Globe2, 
  Palette, 
  LayoutTemplate,
  MonitorSmartphone,
  Eye,
  CheckCircle2,
  Copy,
  Plus,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StorefrontManager() {
  const [activeTab, setActiveTab] = useState("qr");

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#27324A]">Storefront & QR</h1>
        <p className="text-sm font-medium text-[#746E73] mt-1">Manage your public website and download your shop's unique QR code.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[#2E3344]/10">
        <button 
          onClick={() => setActiveTab("qr")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === "qr" ? "border-[#A7653A] text-[#A7653A]" : "border-transparent text-[#746E73] hover:text-[#27324A]"}`}
        >
          <div className="flex items-center gap-2"><QrCode className="h-4 w-4" /> Shop QR Code</div>
        </button>
        <button 
          onClick={() => setActiveTab("theme")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === "theme" ? "border-[#A7653A] text-[#A7653A]" : "border-transparent text-[#746E73] hover:text-[#27324A]"}`}
        >
          <div className="flex items-center gap-2"><Palette className="h-4 w-4" /> Theme & Customization</div>
        </button>
      </div>

      {/* QR Code Tab */}
      {activeTab === "qr" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Actions */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm">
              <h2 className="text-lg font-black text-[#27324A]">Share Your Shop</h2>
              <p className="text-xs text-[#746E73] font-medium mt-1">Customers can scan this QR code to visit your public storefront, browse products, and place orders.</p>
              
              <div className="mt-6 space-y-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Public URL</Label>
                  <div className="flex items-center mt-1.5 gap-2">
                    <Input readOnly value="https://maitidevi.quivo.com" className="h-12 rounded-xl bg-[#f8f8f7] font-mono text-sm" />
                    <Button variant="outline" className="h-12 rounded-xl border-[#2E3344]/10 text-[#27324A] font-bold px-4">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#2E3344]/5">
                  <Button className="h-12 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold w-full">
                    <Download className="h-4 w-4 mr-2" /> Download PNG
                  </Button>
                  <Button className="h-12 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold w-full">
                    <Download className="h-4 w-4 mr-2" /> Download PDF
                  </Button>
                  <Button variant="outline" className="h-12 rounded-xl border-[#2E3344]/10 text-[#27324A] font-bold w-full">
                    <Printer className="h-4 w-4 mr-2" /> Print Standee
                  </Button>
                  <Button variant="outline" className="h-12 rounded-xl border-[#2E3344]/10 text-[#27324A] font-bold w-full">
                    <Share2 className="h-4 w-4 mr-2" /> Share Link
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-[#E8E3D1]/50 p-6 rounded-[2rem] border border-[#2E3344]/5">
              <h3 className="text-sm font-black text-[#27324A] flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-[#A7653A]" /> Usage Ideas
              </h3>
              <ul className="mt-3 space-y-2 text-xs font-medium text-[#746E73]">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-green-600" /> Print on billing invoices and receipts</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-green-600" /> Stick on your shop counter / front desk</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-green-600" /> Include in WhatsApp broadcast messages</li>
              </ul>
            </div>
          </div>

          {/* Right: Preview Card */}
          <div className="flex items-center justify-center bg-[#f8f8f7] p-8 rounded-[2.5rem] border border-[#2E3344]/5">
             <div className="bg-white p-8 rounded-[2rem] shadow-xl text-center w-full max-w-sm border border-[#2E3344]/5">
                <div className="mx-auto h-16 w-16 bg-[#27324A] text-white rounded-2xl flex items-center justify-center font-black text-xl mb-4 shadow-sm">
                  M
                </div>
                <h3 className="text-xl font-black text-[#27324A]">Maitidevi Fresh Mart</h3>
                <p className="text-[10px] uppercase tracking-widest text-[#A7653A] font-bold mt-1">Scan to order online</p>
                
                <div className="mt-8 mb-6 p-4 bg-white border-4 border-[#2E3344] rounded-3xl inline-block">
                   {/* Placeholder for actual QR code SVG/Canvas */}
                   <QrCode className="h-48 w-48 text-[#27324A]" />
                </div>
                
                <p className="text-xs font-bold text-[#746E73] font-mono">maitidevi.quivo.com</p>
             </div>
          </div>
        </div>
      )}

      {/* Theme Tab */}
      {activeTab === "theme" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Customization Options */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-6">
              <div>
                <Label className="font-bold text-[#27324A]">Brand Color</Label>
                <div className="flex gap-2 mt-2">
                  {['#A7653A', '#27324A', '#41A560', '#D84B4B', '#6B46C1'].map(color => (
                    <button key={color} className="h-8 w-8 rounded-full shadow-sm hover:scale-110 transition-transform" style={{ backgroundColor: color }} />
                  ))}
                  <button className="h-8 w-8 rounded-full border-2 border-dashed border-[#2E3344]/20 flex items-center justify-center hover:bg-[#f8f8f7]">
                    <Plus className="h-3 w-3 text-[#746E73]" />
                  </button>
                </div>
              </div>

              <div>
                <Label className="font-bold text-[#27324A]">Storefront Layout</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button className="border-2 border-[#A7653A] bg-[#F7F0E6] rounded-xl p-3 flex flex-col items-center gap-2">
                    <LayoutTemplate className="h-5 w-5 text-[#A7653A]" />
                    <span className="text-[10px] font-bold text-[#A7653A]">Modern Grid</span>
                  </button>
                  <button className="border border-[#2E3344]/10 rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-[#f8f8f7] transition">
                    <LayoutTemplate className="h-5 w-5 text-[#746E73]" />
                    <span className="text-[10px] font-bold text-[#746E73]">List View</span>
                  </button>
                </div>
              </div>
              
              <div>
                <Label className="font-bold text-[#27324A]">Hero Banner Image</Label>
                <div className="mt-2 border-2 border-dashed border-[#2E3344]/10 rounded-2xl h-24 flex flex-col items-center justify-center hover:bg-[#F7F0E6]/30 transition cursor-pointer">
                  <span className="text-xs font-bold text-[#27324A]">Upload Banner</span>
                </div>
              </div>

              <Button className="w-full h-12 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold">
                Publish Changes
              </Button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="lg:col-span-8 bg-[#27324A] p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden flex flex-col">
            <div className="flex items-center justify-between text-white/60 mb-6">
              <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4" /> Live Preview
              </span>
              <button className="flex items-center gap-1.5 text-xs font-bold hover:text-white transition">
                <Eye className="h-4 w-4" /> View Full Screen
              </button>
            </div>

            {/* Mock Phone Container */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] border-8 border-black/10 shadow-2xl overflow-hidden mx-auto w-full max-w-[375px]">
               {/* Mock Public Storefront */}
               <div className="h-40 bg-[#A7653A] flex flex-col items-center justify-center text-white relative">
                 <div className="absolute top-4 right-4"><Share2 className="h-5 w-5 text-white/80" /></div>
                 <div className="h-16 w-16 bg-white text-[#27324A] rounded-2xl flex items-center justify-center font-black text-2xl mb-2 shadow-lg">
                   M
                 </div>
                 <h4 className="font-black text-lg">Maitidevi Fresh Mart</h4>
                 <p className="text-[10px] font-medium opacity-80 mt-1">Open • Closes at 9:00 PM</p>
               </div>
               <div className="p-4 space-y-4">
                 <div className="h-10 bg-[#f8f8f7] rounded-xl px-4 flex items-center">
                   <Search className="h-4 w-4 text-[#746E73] mr-2" />
                   <span className="text-xs text-[#746E73]">Search products...</span>
                 </div>
                 <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                   {['Offers', 'Grocery', 'Dairy', 'Snacks'].map(c => (
                     <div key={c} className="px-3 py-1.5 bg-[#f8f8f7] rounded-lg text-[10px] font-bold text-[#27324A] shrink-0">{c}</div>
                   ))}
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div className="border border-[#2E3344]/10 rounded-xl p-3 flex flex-col">
                     <div className="h-20 bg-[#f8f8f7] rounded-lg mb-2" />
                     <span className="text-xs font-bold text-[#27324A]">Aarati Rice 25kg</span>
                     <span className="text-[10px] text-[#A7653A] font-black mt-1">Rs. 2450</span>
                   </div>
                   <div className="border border-[#2E3344]/10 rounded-xl p-3 flex flex-col">
                     <div className="h-20 bg-[#f8f8f7] rounded-lg mb-2" />
                     <span className="text-xs font-bold text-[#27324A]">DDC Milk 1L</span>
                     <span className="text-[10px] text-[#A7653A] font-black mt-1">Rs. 120</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
