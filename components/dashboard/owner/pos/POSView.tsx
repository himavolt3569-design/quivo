"use client";

import { useState } from "react";
import { 
  Barcode, 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus,
  CreditCard,
  Banknote,
  User,
  QrCode,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

export function POSView() {
  const [cart, setCart] = useState([
    { id: "1", name: "Current Noodles", price: 20, qty: 5 },
    { id: "2", name: "Amul Butter 500g", price: 650, qty: 1 },
  ]);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  const CartContent = () => (
    <div className="w-full h-full flex flex-col bg-white lg:rounded-[2rem] lg:border border-[#2E3344]/8 lg:shadow-sm overflow-hidden shrink-0">
      {/* Cart Header */}
      <div className="p-5 border-b border-[#2E3344]/8 flex items-center justify-between bg-[#F7F0E6]/30">
        <h2 className="font-black text-[#27324A] flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-[#A7653A]" /> Current Sale
        </h2>
        <button onClick={() => setCart([])} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition">Clear All</button>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-2">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#746E73]">
            <ShoppingCart className="h-12 w-12 opacity-20 mb-3" />
            <p className="font-medium text-sm">Cart is empty</p>
            <p className="text-xs mt-1">Scan or tap products to add</p>
          </div>
        ) : (
          <div className="space-y-1">
            {cart.map(item => (
              <div key={item.id} className="flex flex-col p-3 hover:bg-[#f8f8f7] rounded-xl group transition">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-bold text-[#27324A] line-clamp-1 pr-2">{item.name}</p>
                  <p className="text-sm font-black text-[#27324A]">Rs. {item.price * item.qty}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-[#746E73] font-bold uppercase tracking-widest">Rs. {item.price} / unit</p>
                  <div className="flex items-center gap-3 bg-white border border-[#2E3344]/10 rounded-lg p-1">
                    <button className="h-6 w-6 rounded bg-[#f8f8f7] hover:bg-[#E8E3D1] flex items-center justify-center text-[#27324A]">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                    <button className="h-6 w-6 rounded bg-[#F7F0E6] hover:bg-[#A7653A] hover:text-white flex items-center justify-center text-[#A7653A] transition">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Checkout Footer */}
      <div className="p-5 border-t border-[#2E3344]/8 bg-[#f8f8f7]">
        {/* Customer Selection */}
        <button className="w-full flex items-center justify-between bg-white border border-[#2E3344]/10 p-3 rounded-xl mb-4 hover:border-[#A7653A]/50 transition group">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[#E8E3D1] flex items-center justify-center text-[#A7653A]">
              <User className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-[#27324A]">Walk-in Customer</span>
          </div>
          <span className="text-[10px] font-bold text-[#A7653A] group-hover:underline">Change</span>
        </button>

        {/* Totals */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm text-[#746E73] font-medium">
            <span>Subtotal</span>
            <span>Rs. {subtotal}</span>
          </div>
          <div className="flex justify-between text-sm text-[#746E73] font-medium">
            <span>Discount</span>
            <span className="text-green-600 cursor-pointer border-b border-dashed border-green-600">Add</span>
          </div>
          <div className="flex justify-between text-2xl font-black text-[#27324A] pt-2 border-t border-[#2E3344]/10">
            <span>Total</span>
            <span>Rs. {subtotal}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="grid grid-cols-3 gap-2">
          <button className="py-3 rounded-xl bg-[#27324A] text-white flex flex-col items-center gap-1 active:scale-95 transition shadow-md">
            <Banknote className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Cash</span>
          </button>
          <button className="py-3 rounded-xl bg-[#41A560]/10 text-[#41A560] border border-[#41A560]/20 flex flex-col items-center gap-1 hover:bg-[#41A560]/20 active:scale-95 transition">
            <QrCode className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">eSewa</span>
          </button>
          <button className="py-3 rounded-xl bg-[#F7F0E6] text-[#A7653A] border border-[#A7653A]/20 flex flex-col items-center gap-1 hover:bg-[#A7653A] hover:text-white active:scale-95 transition">
            <User className="h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Udhar</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500 pb-16 lg:pb-0">
      
      {/* Left: Product Search & Catalog */}
      <div className="flex-1 flex flex-col bg-white lg:rounded-[2rem] border border-[#2E3344]/8 shadow-sm overflow-hidden -mx-4 sm:-mx-6 lg:mx-0">
        {/* Top Search / Scanner Area */}
        <div className="p-4 lg:p-6 border-b border-[#2E3344]/8 bg-[#f8f8f7]">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#746E73]" />
              <Input 
                placeholder="Search products..." 
                className="pl-12 h-12 lg:h-14 rounded-xl lg:rounded-2xl bg-white border-transparent focus-visible:ring-[#A7653A]/30 text-base lg:text-lg shadow-sm"
                autoFocus
              />
            </div>
            <Button className="h-12 w-12 lg:h-14 lg:w-14 rounded-xl lg:rounded-2xl bg-[#27324A] hover:bg-[#1b2333] text-white shrink-0 shadow-lg">
              <Barcode className="h-5 w-5 lg:h-6 lg:w-6" />
            </Button>
          </div>
          <div className="flex gap-2 mt-4 overflow-x-auto hide-scrollbar">
            {["All", "Grocery", "Dairy", "Snacks", "Drinks"].map(cat => (
              <button key={cat} className="px-4 py-2 bg-white border border-[#2E3344]/5 rounded-xl text-xs font-bold text-[#27324A] hover:bg-[#F7F0E6] hover:border-[#A7653A]/30 transition whitespace-nowrap">
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#f8f8f7]/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {[
              { id: "3", name: "DDC Milk 1L", price: 120, color: "bg-blue-50" },
              { id: "4", name: "Coca Cola 2L", price: 250, color: "bg-red-50" },
              { id: "5", name: "Sugar 1kg", price: 105, color: "bg-orange-50" },
              { id: "6", name: "Aashirvaad Atta 5kg", price: 450, color: "bg-amber-50" },
              { id: "7", name: "Lays Tomato", price: 50, color: "bg-yellow-50" },
              { id: "8", name: "Wai Wai Chicken", price: 20, color: "bg-orange-50" },
            ].map(p => (
              <button key={p.id} className="text-left bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 hover:border-[#A7653A]/50 hover:shadow-md transition group flex flex-col h-28 lg:h-32 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rounded-full ${p.color} opacity-50 group-hover:scale-150 transition-transform duration-500`} />
                <span className="text-xs lg:text-sm font-black text-[#27324A] line-clamp-2 mt-auto relative z-10">{p.name}</span>
                <span className="text-[10px] lg:text-xs font-bold text-[#A7653A] mt-1 relative z-10">Rs. {p.price}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart & Checkout (Desktop) */}
      <div className="hidden lg:flex w-[400px] xl:w-[450px]">
        <CartContent />
      </div>

      {/* Bottom Cart Button (Mobile) */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-[#f8f8f7] to-transparent z-40">
        <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
          <SheetTrigger asChild>
            <Button className="w-full h-14 rounded-2xl bg-[#A7653A] hover:bg-[#8D5132] text-white shadow-xl flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="absolute -top-2 -right-2 h-4 w-4 bg-white text-[#A7653A] rounded-full text-[9px] font-black flex items-center justify-center">
                    {cart.reduce((a, b) => a + b.qty, 0)}
                  </span>
                </div>
                <span className="font-bold">View Cart</span>
              </div>
              <span className="font-black text-lg">Rs. {subtotal}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-[2rem]">
            <SheetTitle className="sr-only">Cart</SheetTitle>
            <CartContent />
          </SheetContent>
        </Sheet>
      </div>

    </div>
  );
}
