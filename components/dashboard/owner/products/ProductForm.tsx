"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Barcode, UploadCloud, X, Loader2, Plus, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { BarcodeImage } from "@/components/ui/BarcodeImage";
import { toast } from "sonner";
import { addProduct } from "@/app/actions/owner";
import { createClient } from "@/lib/supabase/client";

// ─── Types & helpers ──────────────────────────────────────────────────────────

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  variant: string | null;
  price: number;
  image_url: string | null;
  images: string[] | null;
}

function splitUnit(unit: string | null): { size: string; type: string } {
  if (!unit) return { size: "", type: "g" };
  const parts = unit.split(" ");
  return parts.length >= 2 ? { size: parts[0], type: parts[1] } : { size: "", type: unit };
}

function findSimilarProducts(query: string, catalog: CatalogProduct[], limit = 5): CatalogProduct[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 0);

  const queryTokens = tokenize(q);

  return catalog
    .map((p) => {
      const haystack = [p.name, p.brand ?? "", p.category ?? "", p.variant ?? ""].join(" ").toLowerCase();
      let score = 0;
      if (haystack.includes(q.toLowerCase())) score += 100;
      const haystackTokens = tokenize(haystack);
      for (const qt of queryTokens)
        for (const ht of haystackTokens)
          score += ht === qt ? 30 : ht.startsWith(qt) ? 15 : ht.includes(qt) ? 8 : 0;
      return { p, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p }) => p);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["Grocery", "Dairy", "Beverages", "Snacks", "Personal Care", "Household", "Electronics", "Other"];
const UNIT_TYPES = ["g", "kg", "ml", "L", "pcs", "packet", "sack", "box", "dozen"];
const MAX_IMAGES = 5;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProductFormProps {
  shopId: string;
  shopSlug: string;
  catalog: CatalogProduct[];
}

interface ImageSlot {
  file?: File;
  preview: string;
  url?: string;
}

interface CreatedProduct {
  id: string;
  barcode: string;
  productUrl: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductForm({ shopId, shopSlug, catalog }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Image state
  const [images, setImages] = useState<ImageSlot[]>([]);
  const [uploading, setUploading] = useState(false);

  // Post-creation success state
  const [created, setCreated] = useState<CreatedProduct | null>(null);

  // Suggestion state
  const [nameQuery, setNameQuery] = useState("");
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Pre-fill state — incrementing key forces remount of field sections
  const [prefillKey, setPrefillKey] = useState(0);
  const [prefill, setPrefill] = useState<CatalogProduct | null>(null);

  // Derived
  const suggestions = findSimilarProducts(nameQuery, catalog);
  const isOpen = suggestionOpen && !suggestionDismissed && suggestions.length > 0;

  useEffect(() => {
    return () => images.filter((i) => i.file).forEach((i) => URL.revokeObjectURL(i.preview));
  }, []);

  // ─── Image handlers ────────────────────────────────────────────────────────

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const toAdd = files.slice(0, MAX_IMAGES - images.length);
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

  // ─── Suggestion handlers ───────────────────────────────────────────────────

  function handleSuggestionSelect(product: CatalogProduct) {
    setPrefill(product);
    setPrefillKey((k) => k + 1);
    setNameQuery(product.name);
    setSuggestionOpen(false);
    setSuggestionDismissed(true);
    // Pre-fill images from existing product
    const imgs = product.images?.length
      ? product.images
      : product.image_url
      ? [product.image_url]
      : [];
    if (imgs.length) setImages(imgs.map((url) => ({ preview: url, url })));
    toast.success(`Pre-filled from "${product.name}" — adjust as needed.`);
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

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
      const result = await addProduct(shopId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        const productUrl = `${window.location.origin}/s/${shopSlug}/product/${result.barcode}`;
        setCreated({ id: result.id!, barcode: result.barcode!, productUrl });
        toast.success("Product added!");
      }
    });
  };

  const busy = uploading || isPending;
  const prefillUnit = splitUnit(prefill?.unit ?? null);

  // ─── Success screen ────────────────────────────────────────────────────────

  if (created) {
    return (
      <div className="max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 pb-12">
        <div className="bg-white rounded-[2rem] border border-[#2E3344]/8 shadow-sm p-8 text-center space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
            <Barcode className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#27324A]">Product Created!</h2>
            <p className="text-sm text-[#746E73] mt-1">Print or scan this barcode at your POS counter.</p>
          </div>

          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-2xl border border-[#2E3344]/8 inline-block overflow-hidden">
              <BarcodeImage value={created.barcode} height={80} width={2} fontSize={13} />
            </div>
          </div>

          <a
            href={created.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#A7653A] hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> Preview product page
          </a>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl font-bold"
              onClick={() => {
                setCreated(null);
                setImages([]);
                setPrefill(null);
                setPrefillKey(0);
                setSuggestionDismissed(false);
                setNameQuery("");
                formRef.current?.reset();
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Another
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold"
              onClick={() => router.push("/dashboard/owner/products")}
            >
              Back to Products
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main form ─────────────────────────────────────────────────────────────

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/owner/products">
            <Button type="button" variant="ghost" className="h-10 w-10 p-0 rounded-full hover:bg-white">
              <ArrowLeft className="h-5 w-5 text-[#27324A]" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-[#27324A]">Add Product</h1>
            <p className="text-xs font-medium text-[#746E73] mt-0.5">Create a new item in your catalog</p>
          </div>
        </div>
        <Button
          type="submit"
          disabled={busy}
          className="rounded-xl h-11 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold px-6"
        >
          {busy ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{uploading ? "Uploading…" : "Saving…"}</>
          ) : (
            <><Save className="h-4 w-4 mr-2" />Save Product</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">Basic Information</h2>

            {/* Prefill notice */}
            {prefill && (
              <div className="flex items-center gap-2 bg-[#F7F0E6]/60 border border-[#A7653A]/20 rounded-xl px-4 py-2.5">
                <div className="h-6 w-6 rounded-md bg-[#A7653A]/10 flex items-center justify-center shrink-0">
                  {prefill.images?.[0] ?? prefill.image_url ? (
                    <img src={prefill.images?.[0] ?? prefill.image_url!} alt="" className="h-6 w-6 rounded-md object-cover" />
                  ) : (
                    <span className="text-[10px] font-black text-[#A7653A]">{prefill.name[0]}</span>
                  )}
                </div>
                <p className="text-xs font-bold text-[#A7653A] flex-1 min-w-0 truncate">
                  Pre-filled from <span className="font-black">&quot;{prefill.name}&quot;</span> — edit any field to create a new product
                </p>
                <button
                  type="button"
                  onClick={() => { setPrefill(null); setPrefillKey((k) => k + 1); setNameQuery(""); setImages([]); }}
                  className="text-[#746E73] hover:text-[#27324A] shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* key forces remount → defaultValues apply when prefill changes */}
            <div key={prefillKey} className="space-y-4">
              {/* Product Name with suggestion popover */}
              <div>
                <Popover
                  open={isOpen}
                  onOpenChange={(open) => { if (!open) setSuggestionOpen(false); }}
                >
                  <PopoverAnchor asChild>
                    <div>
                      <Label className="font-bold text-[#27324A]">
                        Product Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        name="name"
                        value={nameQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNameQuery(val);
                          setSuggestionDismissed(false);
                          setSuggestionOpen(val.length >= 2);
                        }}
                        onFocus={() => {
                          if (nameQuery.length >= 2 && !suggestionDismissed) setSuggestionOpen(true);
                        }}
                        placeholder="e.g. Current Noodles"
                        className="h-12 rounded-xl mt-1.5"
                        required
                        autoComplete="off"
                      />
                    </div>
                  </PopoverAnchor>

                  <PopoverContent
                    align="start"
                    sideOffset={4}
                    className="w-[--radix-popover-trigger-width] p-0 rounded-2xl border border-[#2E3344]/10 shadow-xl overflow-hidden"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <Command shouldFilter={false}>
                      <CommandList>
                        <CommandGroup heading="Similar products in your catalog">
                          {suggestions.map((p) => {
                            const thumb = p.images?.[0] ?? p.image_url;
                            return (
                              <CommandItem
                                key={p.id}
                                value={p.id}
                                onSelect={() => handleSuggestionSelect(p)}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer aria-selected:bg-[#F7F0E6]"
                              >
                                <div className="h-9 w-9 rounded-lg bg-[#E8E3D1]/60 flex items-center justify-center shrink-0 overflow-hidden">
                                  {thumb ? (
                                    <img src={thumb} alt="" className="h-9 w-9 object-cover" />
                                  ) : (
                                    <span className="text-sm font-black text-[#A7653A]">{p.name[0]}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-black text-[#27324A] text-sm truncate">{p.name}</p>
                                  <p className="text-[10px] font-bold text-[#746E73] truncate">
                                    {[p.brand, p.category, p.unit].filter(Boolean).join(" • ")}
                                  </p>
                                </div>
                                <span className="text-xs font-black text-[#A7653A] shrink-0 bg-[#F7F0E6] px-2 py-0.5 rounded-md">
                                  Rs. {p.price}
                                </span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>

                        <CommandSeparator />

                        <CommandGroup>
                          <CommandItem
                            value="__new__"
                            onSelect={() => { setSuggestionOpen(false); setSuggestionDismissed(true); }}
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer aria-selected:bg-[#f8f8f7]"
                          >
                            <div className="h-9 w-9 rounded-lg bg-[#f8f8f7] flex items-center justify-center shrink-0">
                              <Plus className="h-4 w-4 text-[#746E73]" />
                            </div>
                            <div>
                              <p className="font-bold text-[#27324A] text-sm">
                                Create &quot;{nameQuery}&quot; as new product
                              </p>
                              <p className="text-[10px] text-[#746E73]">None of the above match</p>
                            </div>
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Brand / Manufacturer</Label>
                  <Input
                    name="brand"
                    defaultValue={prefill?.brand ?? ""}
                    placeholder="e.g. CG Foods"
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <select
                    name="category"
                    defaultValue={prefill?.category ?? "Grocery"}
                    required
                    className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring mt-1.5"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Unit Size</Label>
                  <Input
                    name="unit_size"
                    defaultValue={prefillUnit.size}
                    placeholder="e.g. 75"
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">Unit Type</Label>
                  <select
                    name="unit_type"
                    defaultValue={prefillUnit.type}
                    className="flex h-12 w-full items-center justify-between rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm mt-1.5 outline-none focus:ring-1"
                  >
                    {UNIT_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">Variant / Flavor</Label>
                  <Input
                    name="variant"
                    defaultValue={prefill?.variant ?? ""}
                    placeholder="e.g. Hot & Spicy"
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label className="font-bold text-[#27324A]">Description</Label>
                <Textarea
                  name="description"
                  placeholder="Optional details..."
                  className="mt-1.5 rounded-xl resize-none min-h-[100px]"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Inventory — also keyed for price prefill */}
          <div key={`pricing-${prefillKey}`} className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">Pricing & Inventory</h2>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Cost Price (Rs.)</Label>
                  <Input
                    name="cost_price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="h-12 rounded-xl mt-1.5 bg-[#f8f8f7]"
                  />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">
                    Selling Price (Rs.) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={prefill?.price ?? ""}
                    placeholder="0.00"
                    className="h-12 rounded-xl mt-1.5"
                    required
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="font-bold text-[#27324A]">Current Stock</Label>
                  <Input name="stock" type="number" min="0" defaultValue="0" className="h-12 rounded-xl mt-1.5" />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">Low Stock Alert At</Label>
                  <Input name="low_stock_threshold" type="number" min="0" defaultValue="5" className="h-12 rounded-xl mt-1.5" />
                </div>
              </div>
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
                className="w-full border-2 border-dashed border-[#2E3344]/10 rounded-2xl h-32 flex flex-col items-center justify-center gap-2 hover:bg-[#F7F0E6]/30 hover:border-[#A7653A]/30 transition group"
              >
                <div className="h-9 w-9 rounded-full bg-[#f8f8f7] group-hover:bg-[#F7F0E6] flex items-center justify-center transition">
                  <UploadCloud className="h-4 w-4 text-[#746E73] group-hover:text-[#A7653A] transition" />
                </div>
                <span className="text-xs font-bold text-[#27324A]">
                  {images.length === 0 ? "Upload images" : "Add more"}
                </span>
                <span className="text-[10px] text-[#746E73]">PNG, JPG, WebP · max 5 MB each</span>
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

            {images.length > 0 && (
              <p className="text-[10px] text-[#746E73] text-center">First image is the main thumbnail.</p>
            )}
          </div>

          {/* Barcode */}
          <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3">Barcode (SKU)</h2>
            <div>
              <Label className="font-bold text-[#27324A]">Scan or Enter Barcode</Label>
              <div className="flex mt-1.5">
                <Input
                  name="barcode"
                  placeholder="Leave blank to auto-generate"
                  className="h-12 rounded-r-none rounded-l-xl font-mono"
                />
                <div className="h-12 rounded-l-none rounded-r-xl bg-[#F7F0E6] text-[#A7653A] border border-l-0 border-[#2E3344]/10 px-4 flex items-center">
                  <Barcode className="h-5 w-5" />
                </div>
              </div>
              <p className="text-[10px] text-[#746E73] mt-1.5 font-medium">
                A unique scannable barcode will be generated automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
