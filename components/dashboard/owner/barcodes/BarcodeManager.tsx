"use client";

import { useState, useRef } from "react";
import { Printer, Settings, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BarcodeImage } from "@/components/ui/BarcodeImage";

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  max_stock?: number | null;
  low_stock_threshold: number | null;
  barcode: string | null;
}

export function BarcodeManager({
  shopId,
  shopName,
  catalog,
}: {
  shopId: string;
  shopName: string;
  catalog: CatalogProduct[];
}) {
  const [selectedItems, setSelectedItems] = useState<{product: CatalogProduct, copies: number}[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCatalog = catalog.filter((p) => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const toggleProduct = (product: CatalogProduct) => {
    setSelectedItems(prev => {
      const exists = prev.find(item => item.product.id === product.id);
      if (exists) {
        return prev.filter(item => item.product.id !== product.id);
      }
      return [...prev, { product, copies: 1 }];
    });
  };

  const updateCopies = (productId: string, copies: number) => {
    setSelectedItems(prev => prev.map(item => 
      item.product.id === productId ? { ...item, copies: Math.max(1, copies) } : item
    ));
  };

  const printStickers = () => {
    if (selectedItems.length === 0) return;
    
    const missingBarcodes = selectedItems.filter(i => !i.product.barcode);
    if (missingBarcodes.length > 0) {
      toast.error(`Some products don't have barcodes (${missingBarcodes[0].product.name}). Please update them first.`);
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked! Please allow popups to print.");
      return;
    }

    // A4 sheet style or single sticker printer style. Let's make it grid layout.
    const stickers = selectedItems.flatMap((item, itemIndex) => 
      Array.from({ length: item.copies }).map((_, i) => `
        <div class="sticker">
          <div class="shop-name">${shopName}</div>
          <div class="product-name">${item.product.name}</div>
          <div class="price">Rs. ${Number(item.product.price).toFixed(2)}</div>
          <div class="stock-info">
            Stock: ${item.product.stock ?? 0} | Min: ${item.product.low_stock_threshold ?? 0} | Max: ${item.product.max_stock ?? '∞'}
          </div>
          <div class="barcode">
            <svg id="barcode-${item.product.id}-${i}"></svg>
          </div>
        </div>
      `)
    ).join("");

    // Use JsBarcode in the new window
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcodes</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 10mm;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(50mm, 1fr));
              gap: 5mm;
            }
            .sticker {
              width: 50mm;
              height: 30mm;
              border: 1px dashed #ccc;
              padding: 2mm;
              box-sizing: border-box;
              text-align: center;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
            }
            .shop-name {
              font-size: 8px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .product-name {
              font-size: 10px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .price {
              font-size: 10px;
              font-weight: bold;
            }
            .stock-info {
              font-size: 8px;
              color: #666;
            }
            .barcode svg {
              max-width: 100%;
              height: auto;
              max-height: 12mm;
            }
            @media print {
              .sticker {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${stickers}
          </div>
          <script>
            window.onload = function() {
              const selectedItems = ${JSON.stringify(selectedItems.map(i => ({ id: i.product.id, barcode: i.product.barcode, copies: i.copies })))};
              
              selectedItems.forEach(item => {
                for (let i = 0; i < item.copies; i++) {
                  JsBarcode("#barcode-" + item.id + "-" + i, item.barcode, {
                    format: "CODE128",
                    width: 1.5,
                    height: 30,
                    displayValue: true,
                    fontSize: 10,
                    margin: 0
                  });
                }
              });
              
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Print Barcodes</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Generate and print bulk barcode stickers for your products.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <Label className="font-bold text-slate-900">Select a Product</Label>
            <Input 
              placeholder="Search products by name or barcode..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl h-12"
            />
            
            <div className="max-h-96 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50">
              {filteredCatalog.map(p => {
                const isSelected = selectedItems.some(item => item.product.id === p.id);
                return (
                  <div 
                    key={p.id}
                    onClick={() => toggleProduct(p)}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-blue-100'}`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Barcode: {p.barcode || 'N/A'}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-blue-500" />}
                  </div>
                );
              })}
              {filteredCatalog.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No products found.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-3">
              Print Settings
            </h2>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {selectedItems.length > 0 ? (
                selectedItems.map(item => (
                  <div key={item.product.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold truncate max-w-[200px]">{item.product.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Copies</Label>
                      <Input 
                        type="number" 
                        min={1} 
                        max={100} 
                        value={item.copies} 
                        onChange={(e) => updateCopies(item.product.id, parseInt(e.target.value) || 1)}
                        className="h-8 w-20 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">Select products to print.</p>
              )}

              <Button 
                onClick={printStickers}
                disabled={selectedItems.length === 0}
                className="w-full h-12 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white mt-4"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Stickers
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
