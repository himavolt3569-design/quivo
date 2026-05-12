"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Barcode, 
  Edit, 
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  Download
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Mock Data
const products = [
  { id: "1", name: "Jeera Masino Rice", brand: "Aarati", unit: "25kg", category: "Grocery", price: 2450, stock: 12, lowStock: false, status: "Active" },
  { id: "2", name: "Fresh Dairy Milk", brand: "DDC", unit: "1L", category: "Dairy", price: 120, stock: 4, lowStock: true, status: "Active" },
  { id: "3", name: "Mustard Oil", brand: "Dhara", unit: "1L", category: "Grocery", price: 380, stock: 24, lowStock: false, status: "Active" },
  { id: "4", name: "Wai Wai Noodles", brand: "CG", unit: "75g", category: "Snacks", price: 20, stock: 150, lowStock: false, status: "Active" },
  { id: "5", name: "Amul Butter", brand: "Amul", unit: "500g", category: "Dairy", price: 650, stock: 2, lowStock: true, status: "Active" },
];

export function ProductList() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#27324A]">Inventory & Products</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">Manage your catalog, stock levels, and barcodes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl h-11 border-[#2E3344]/10 text-[#27324A] font-bold hidden sm:flex">
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Link href="/dashboard/owner/products/add">
            <Button className="rounded-xl h-11 bg-[#A7653A] hover:bg-[#8D5132] text-white font-bold w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#746E73]" />
          <Input 
            placeholder="Search by name, brand, or barcode..." 
            className="pl-9 h-11 rounded-xl bg-[#f8f8f7] border-transparent focus-visible:ring-[#A7653A]/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="outline" className="rounded-xl h-11 border-[#2E3344]/10 text-[#27324A] font-bold flex-1 sm:flex-none">
            <Filter className="h-4 w-4 mr-2" /> Category
          </Button>
          <Button variant="outline" className="rounded-xl h-11 border-[#2E3344]/10 text-[#27324A] font-bold flex-1 sm:flex-none">
            <ArrowUpDown className="h-4 w-4 mr-2" /> Sort
          </Button>
        </div>
      </div>

      {/* Product Table (Desktop) */}
      <div className="hidden md:block bg-white rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#F7F0E6]/50 border-b border-[#2E3344]/8 text-[#746E73] font-bold uppercase tracking-widest text-[10px]">
              <tr>
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2E3344]/5">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-[#f8f8f7]/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[#E8E3D1]/50 flex items-center justify-center font-bold text-[#A7653A] text-xs">
                        {product.name[0]}
                      </div>
                      <div>
                        <p className="font-black text-[#27324A]">{product.name}</p>
                        <p className="text-[10px] font-bold text-[#746E73]">{product.brand} • {product.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-[#746E73]">{product.category}</td>
                  <td className="px-6 py-4 font-black text-[#27324A]">Rs. {product.price}</td>
                  <td className="px-6 py-4">
                    {product.lowStock ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 font-bold text-xs border border-orange-100">
                        <AlertTriangle className="h-3 w-3" /> {product.stock}
                      </span>
                    ) : (
                      <span className="font-bold text-[#27324A]">{product.stock}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2.5 py-1 rounded-md bg-green-50 text-green-700 font-bold text-[10px] uppercase tracking-wider border border-green-100">
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="h-8 w-8 rounded-lg border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:bg-[#F7F0E6] hover:text-[#A7653A] transition">
                        <Barcode className="h-4 w-4" />
                      </button>
                      <button className="h-8 w-8 rounded-lg border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:bg-[#f8f8f7] transition">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Cards (Mobile) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {products.map((product) => (
          <div key={product.id} className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-[#E8E3D1]/50 flex items-center justify-center font-bold text-[#A7653A]">
                  {product.name[0]}
                </div>
                <div>
                  <p className="font-black text-[#27324A]">{product.name}</p>
                  <p className="text-xs font-bold text-[#746E73] mt-0.5">{product.brand} • {product.unit}</p>
                </div>
              </div>
              <button className="text-[#746E73]"><MoreVertical className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 pt-4 border-t border-[#2E3344]/5 flex items-center justify-between">
              <p className="font-black text-[#27324A]">Rs. {product.price}</p>
              {product.lowStock ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-orange-700 font-bold text-[10px] bg-orange-50">
                  <AlertTriangle className="h-3 w-3" /> {product.stock} Left
                </span>
              ) : (
                <span className="text-xs font-bold text-[#746E73]">Stock: {product.stock}</span>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
