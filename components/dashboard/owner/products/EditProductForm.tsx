"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Barcode, UploadCloud, X, Loader2, ExternalLink } from "lucide-react";
import { BarcodeImage } from "@/components/ui/BarcodeImage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { updateProduct } from "@/app/actions/owner";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = ["Grocery", "Dairy", "Beverages", "Snacks", "Personal Care", "Household", "Electronics", "Other"];
const UNIT_TYPES = ["g", "kg", "ml", "L", "pcs", "packet", "sack", "box", "dozen"];
const MAX_IMAGES = 5;

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  variant: string | null;
  description: string | null;
  price: number;
  cost_price: number | null;
  stock: number;
  low_stock_threshold: number | null;
  barcode: string | null;
  status: string;
  image_url: string | null;
  images: string[] | null;
}

interface EditProductFormProps {
  shopId: string;
  shopSlug: string;
  product: ProductRow;
}

interface ImageSlot {
  file?: File;
  preview: string;
  url?: string;
}

export function EditProductForm({ shopId, shopSlug, product }: EditProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);

  const existingImages = product.images?.length ? product.images : (product.image_url ? [product.image_url] : []);
  const [images, setImages] = useState<ImageSlot[]>(
    existingImages.map((url) => ({ preview: url, url }))
  );

  // Parse unit into size + type for display
  const unitParts = product.unit?.split(" ") ?? [];
  const initUnitSize = unitParts.length >= 2 ? unitParts[0] : "";
  const initUnitType = unitParts.length >= 2 ? unitParts[1] : (product.unit ?? "");

  useEffect(() => {
    return () => images.filter((i) => i.file).forEach((i) => URL.revokeObjectURL(i.preview));
  }, []);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - images.length;
    const toAdd = files.slice(0, remaining);
    for (const file of toAdd) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB`); return; }
    }
    setImages((prev) => [...prev, ...toAdd.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))]);
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => {
      if (prev[index].file) URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function uploadImages(): Promise<string[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const urls: string[] = [];
    for (const img of images) {
      if (img.url && !img.file) { urls.push(img.url); continue; }
      if (!img.file) continue;
      const ext = img.file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/products/${shopId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: uploaded, error } = await supabase.storage
        .from("shop_assets")
        .upload(path, img.file, { upsert: true });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      const { data: { publicUrl } } = supabase.storage.from("shop_assets").getPublicUrl(uploaded.path);
      urls.push(publicUrl);
    }
    return urls;
  }


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setUploading(true);
    let imageUrls: string[] = [];
    try {
      imageUrls = await uploadImages();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Image upload failed");
      setUploading(false);
      return;
    }
    setUploading(false);

    formData.set("images", JSON.stringify(imageUrls));

    startTransition(async () => {
      const result = await updateProduct(product.id, shopId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Product updated!");
        router.push("/dashboard/owner/products");
      }
    });
  };

  const busy = uploading || isPending;
  const productUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/s/${shopSlug}/product/${product.barcode}`;

  return (
    <>
      {showBarcode && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowBarcode(false)}
        >
          <div
            className="bg-white rounded-[2rem] p-8 space-y-5 text-center shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-black text-[#27324A]">Product Barcode</h3>
            <div className="flex justify-center overflow-hidden rounded-2xl border border-[#2E3344]/8 p-4">
              <BarcodeImage value={product.barcode ?? ""} height={80} width={2} fontSize={13} />
            </div>
            <a href={productUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A7653A] hover:underline">
              <ExternalLink className="h-3 w-3" /> Product page
            </a>
            <Button variant="outline" className="w-full rounded-xl font-bold" onClick={() => setShowBarcode(false)}>Close</Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/owner/products">
              <Button type="button" variant="ghost" className="h-10 w-10 p-0 rounded-full hover:bg-white">
                <ArrowLeft className="h-5 w-5 text-[#27324A]" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-black text-[#27324A]">Edit Product</h1>
              <p className="text-xs font-medium text-[#746E73] mt-0.5">{product.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {product.barcode && (
              <Button type="button" variant="outline" onClick={() => setShowBarcode(true)} className="rounded-xl h-11 font-bold border-[#2E3344]/10">
                <Barcode className="h-4 w-4 mr-2" /> Barcode
              </Button>
            )}
            <Button
              type="submit"
              disabled={busy}
              className="rounded-xl h-11 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold px-6"
            >
              {busy ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{uploading ? "Uploading…" : "Saving…"}</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />Save Changes</>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">Basic Information</h2>

              <div className="space-y-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Product Name <span className="text-red-500">*</span></Label>
                  <Input name="name" defaultValue={product.name} className="h-12 rounded-xl mt-1.5" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-bold text-[#27324A]">Brand / Manufacturer</Label>
                    <Input name="brand" defaultValue={product.brand ?? ""} className="h-12 rounded-xl mt-1.5" />
                  </div>
                  <div>
                    <Label className="font-bold text-[#27324A]">Category <span className="text-red-500">*</span></Label>
                    <select name="category" defaultValue={product.category ?? "Grocery"} required className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring mt-1.5">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="font-bold text-[#27324A]">Unit Size</Label>
                    <Input name="unit_size" defaultValue={initUnitSize} placeholder="e.g. 75" className="h-12 rounded-xl mt-1.5" />
                  </div>
                  <div>
                    <Label className="font-bold text-[#27324A]">Unit Type</Label>
                    <select name="unit_type" defaultValue={initUnitType} className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm mt-1.5 outline-none focus:ring-1">
                      {UNIT_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="font-bold text-[#27324A]">Variant / Flavor</Label>
                    <Input name="variant" defaultValue={product.variant ?? ""} className="h-12 rounded-xl mt-1.5" />
                  </div>
                </div>

                <div>
                  <Label className="font-bold text-[#27324A]">Description</Label>
                  <Textarea name="description" defaultValue={product.description ?? ""} className="mt-1.5 rounded-xl resize-none min-h-[100px]" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">Pricing & Inventory</h2>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="font-bold text-[#27324A]">Cost Price (Rs.)</Label>
                    <Input name="cost_price" type="number" min="0" step="0.01" defaultValue={product.cost_price ?? ""} className="h-12 rounded-xl mt-1.5 bg-[#f8f8f7]" />
                  </div>
                  <div>
                    <Label className="font-bold text-[#27324A]">Selling Price (Rs.) <span className="text-red-500">*</span></Label>
                    <Input name="price" type="number" min="0" step="0.01" defaultValue={product.price} className="h-12 rounded-xl mt-1.5" required />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="font-bold text-[#27324A]">Current Stock</Label>
                    <Input name="stock" type="number" min="0" defaultValue={product.stock} className="h-12 rounded-xl mt-1.5" />
                  </div>
                  <div>
                    <Label className="font-bold text-[#27324A]">Low Stock Alert At</Label>
                    <Input name="low_stock_threshold" type="number" min="0" defaultValue={product.low_stock_threshold ?? 5} className="h-12 rounded-xl mt-1.5" />
                  </div>
                </div>
              </div>

              <div>
                <Label className="font-bold text-[#27324A]">Status</Label>
                <select name="status" defaultValue={product.status} className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm mt-1.5 outline-none focus:ring-1">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Product Images */}
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">
                Product Images <span className="text-[#A7653A]">{images.length}/{MAX_IMAGES}</span>
              </h2>

              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative aspect-square">
                      <img src={img.preview} alt="" className="w-full h-full object-cover rounded-xl border border-[#2E3344]/10" />
                      {i === 0 && (
                        <span className="absolute top-1 left-1 text-[8px] font-black bg-[#A7653A] text-white px-1.5 py-0.5 rounded-md uppercase tracking-wide">Main</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-[#2E3344]/10 rounded-2xl h-28 flex flex-col items-center justify-center gap-2 hover:bg-[#F7F0E6]/30 hover:border-[#A7653A]/30 transition group"
                >
                  <UploadCloud className="h-5 w-5 text-[#746E73] group-hover:text-[#A7653A] transition" />
                  <span className="text-xs font-bold text-[#27324A]">Add images</span>
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                onChange={handleImageSelect}
              />
            </div>

            {/* Barcode */}
            <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">Barcode</h2>
              <div>
                <Label className="font-bold text-[#27324A]">Barcode Value</Label>
                <div className="flex mt-1.5">
                  <Input
                    name="barcode"
                    defaultValue={product.barcode ?? ""}
                    className="h-12 rounded-r-none rounded-l-xl font-mono"
                    readOnly
                  />
                  <div className="h-12 rounded-l-none rounded-r-xl bg-[#F7F0E6] text-[#A7653A] border border-l-0 border-[#2E3344]/10 px-4 flex items-center">
                    <Barcode className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-[10px] text-[#746E73] mt-1.5 font-medium">
                  Barcode is fixed after creation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
