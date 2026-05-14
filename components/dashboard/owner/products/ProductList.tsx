"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  AlertTriangle,
  Package,
  Trash2,
  Pencil,
  Barcode as BarcodeIcon,
  Minus,
  ChevronUp,
  ChevronDown,
  X,
  ExternalLink,
} from "lucide-react";
import { BarcodeImage } from "@/components/ui/BarcodeImage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteProduct, adjustStock } from "@/app/actions/owner";

interface Product {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  variant: string | null;
  category: string | null;
  price: number;
  cost_price: number | null;
  stock: number;
  low_stock_threshold: number | null;
  barcode: string | null;
  status: string;
  image_url: string | null;
  images: string[] | null;
  created_at: string;
}

interface ProductListProps {
  shopId: string;
  shopSlug: string;
  initialProducts: Product[];
}

interface BarcodeModal {
  productId: string;
  barcode: string;
  productUrl: string;
}

export function ProductList({ shopId, shopSlug, initialProducts }: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState(initialProducts);
  const [isPending, startTransition] = useTransition();
  const [barcodeModal, setBarcodeModal] = useState<BarcodeModal | null>(null);
  const [stockAdjust, setStockAdjust] = useState<Record<string, number>>({});

  const filtered = products.filter((p) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand ?? "").toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q)
    );
  });

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteProduct(id, shopId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        toast.success("Product archived.");
      }
    });
  };

  const handleAdjustStock = (productId: string, delta: number) => {
    startTransition(async () => {
      const result = await adjustStock(productId, shopId, delta);
      if (result.error) {
        toast.error(result.error);
      } else {
        setProducts((prev) =>
          prev.map((p) => p.id === productId ? { ...p, stock: result.newStock! } : p)
        );
        setStockAdjust((prev) => ({ ...prev, [productId]: 0 }));
      }
    });
  };

  const handleShowBarcode = (product: Product) => {
    if (!product.barcode) return;
    const productUrl = `${window.location.origin}/s/${shopSlug}/product/${product.barcode}`;
    setBarcodeModal({ productId: product.id, barcode: product.barcode, productUrl });
  };

  const getThumbnail = (p: Product) => {
    if (p.images?.length) return p.images[0];
    return p.image_url;
  };

  return (
    <>
      {/* Barcode Modal */}
      {barcodeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setBarcodeModal(null)}>
          <div className="bg-white rounded-[2rem] p-8 space-y-5 text-center shadow-2xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-black text-[#27324A]">Product Barcode</h3>
              <button onClick={() => setBarcodeModal(null)} className="h-8 w-8 rounded-full bg-[#f8f8f7] flex items-center justify-center">
                <X className="h-4 w-4 text-[#746E73]" />
              </button>
            </div>
            <div className="flex justify-center overflow-hidden rounded-2xl border border-[#2E3344]/8 bg-white p-4">
              <BarcodeImage value={barcodeModal.barcode} height={80} width={2} fontSize={13} />
            </div>
            <a href={barcodeModal.productUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A7653A] hover:underline">
              <ExternalLink className="h-3 w-3" /> Product page
            </a>
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#27324A]">Inventory & Products</h1>
            <p className="text-sm font-medium text-[#746E73] mt-1">Manage your catalog, stock levels, and barcodes.</p>
          </div>
          <Link href="/dashboard/owner/products/add">
            <Button className="rounded-xl h-11 bg-[#A7653A] hover:bg-[#8D5132] text-white font-bold w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Add Product
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#746E73]" />
            <Input
              placeholder="Search by name, brand, or barcode..."
              className="pl-9 h-11 rounded-xl bg-[#f8f8f7] border-transparent focus-visible:ring-[#A7653A]/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Empty State */}
        {products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center bg-white rounded-[2rem] border border-[#2E3344]/8">
            <div className="h-16 w-16 rounded-2xl bg-[#F7F0E6] flex items-center justify-center">
              <Package className="h-8 w-8 text-[#A7653A]" />
            </div>
            <h3 className="text-lg font-black text-[#27324A]">No products yet</h3>
            <p className="text-sm text-[#746E73] font-medium max-w-xs">
              Add your first product to start tracking inventory and enabling online ordering.
            </p>
            <Link href="/dashboard/owner/products/add">
              <Button className="rounded-xl h-11 bg-[#A7653A] hover:bg-[#8D5132] text-white font-bold">
                <Plus className="h-4 w-4 mr-2" /> Add First Product
              </Button>
            </Link>
          </div>
        )}

        {/* Desktop Table */}
        {filtered.length > 0 && (
          <div className="hidden md:block bg-white rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#F7F0E6]/50 border-b border-[#2E3344]/8 text-[#746E73] font-bold uppercase tracking-widest text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E3344]/5">
                  {filtered.map((product) => {
                    const isLow = product.stock <= (product.low_stock_threshold ?? 5);
                    const thumb = getThumbnail(product);
                    return (
                      <tr key={product.id} className="hover:bg-[#f8f8f7]/50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-[#E8E3D1]/50 flex items-center justify-center font-bold text-[#A7653A] text-xs shrink-0 overflow-hidden">
                              {thumb ? (
                                <img src={thumb} alt={product.name} className="h-10 w-10 object-cover" />
                              ) : product.name[0]}
                            </div>
                            <div>
                              <p className="font-black text-[#27324A]">{product.name}</p>
                              <p className="text-[10px] font-bold text-[#746E73]">
                                {[product.brand, product.unit, product.variant].filter(Boolean).join(" • ")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-[#746E73]">{product.category ?? "—"}</td>
                        <td className="px-6 py-4 font-black text-[#27324A]">Rs. {product.price}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAdjustStock(product.id, -1)}
                              disabled={isPending || product.stock <= 0}
                              className="h-6 w-6 rounded-md bg-[#f8f8f7] border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:bg-red-50 hover:text-red-500 hover:border-red-200 disabled:opacity-30 transition"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 font-black text-xs border border-orange-100 min-w-[2.5rem] justify-center">
                                <AlertTriangle className="h-3 w-3" /> {product.stock}
                              </span>
                            ) : (
                              <span className="font-black text-[#27324A] text-sm min-w-[2.5rem] text-center">{product.stock}</span>
                            )}
                            <button
                              onClick={() => handleAdjustStock(product.id, 1)}
                              disabled={isPending}
                              className="h-6 w-6 rounded-md bg-[#f8f8f7] border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:bg-green-50 hover:text-green-600 hover:border-green-200 disabled:opacity-30 transition"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider border ${
                            product.status === "active"
                              ? "bg-green-50 text-green-700 border-green-100"
                              : "bg-[#f8f8f7] text-[#746E73] border-[#2E3344]/10"
                          }`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {product.barcode && (
                              <button
                                onClick={() => handleShowBarcode(product)}
                                className="h-8 w-8 rounded-lg border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:bg-[#F7F0E6] hover:text-[#A7653A] hover:border-[#A7653A]/20 transition"
                                title="Show QR"
                              >
                                <BarcodeIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <Link href={`/dashboard/owner/products/${product.id}/edit`}>
                              <button className="h-8 w-8 rounded-lg border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </Link>
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={isPending}
                              className="h-8 w-8 rounded-lg border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mobile Cards */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filtered.map((product) => {
              const isLow = product.stock <= (product.low_stock_threshold ?? 5);
              const thumb = getThumbnail(product);
              return (
                <div key={product.id} className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-[#E8E3D1]/50 flex items-center justify-center font-bold text-[#A7653A] text-lg shrink-0 overflow-hidden">
                        {thumb ? <img src={thumb} alt={product.name} className="h-12 w-12 object-cover" /> : product.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-[#27324A] truncate">{product.name}</p>
                        <p className="text-xs font-bold text-[#746E73] mt-0.5 truncate">
                          {[product.brand, product.unit, product.category].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {product.barcode && (
                        <button
                          onClick={() => handleShowBarcode(product)}
                          className="h-8 w-8 rounded-lg border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:bg-[#F7F0E6] hover:text-[#A7653A]"
                        >
                          <BarcodeIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <Link href={`/dashboard/owner/products/${product.id}/edit`}>
                        <button className="h-8 w-8 rounded-lg border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:bg-blue-50 hover:text-blue-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={isPending}
                        className="h-8 w-8 rounded-lg border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#2E3344]/5">
                    <p className="font-black text-[#27324A]">Rs. {product.price}</p>

                    {/* Stock controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAdjustStock(product.id, -1)}
                        disabled={isPending || product.stock <= 0}
                        className="h-7 w-7 rounded-lg bg-[#f8f8f7] border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-orange-700 font-black text-xs bg-orange-50">
                          <AlertTriangle className="h-3 w-3" /> {product.stock}
                        </span>
                      ) : (
                        <span className="text-sm font-black text-[#27324A] min-w-[2rem] text-center">{product.stock}</span>
                      )}
                      <button
                        onClick={() => handleAdjustStock(product.id, 1)}
                        disabled={isPending}
                        className="h-7 w-7 rounded-lg bg-[#f8f8f7] border border-[#2E3344]/10 flex items-center justify-center text-[#746E73] disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-[10px] text-[#746E73] font-medium">in stock</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {products.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16 text-[#746E73] font-medium">
            No products match &quot;{searchTerm}&quot;.
          </div>
        )}
      </div>
    </>
  );
}
