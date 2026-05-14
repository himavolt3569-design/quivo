"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Store, Clock, Type, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFontSize } from "@/components/FontProvider";
import { toast } from "sonner";
import { updateOwnerFontSize } from "@/app/actions/customer";
import { updateShopSettings, deleteShop } from "@/app/actions/owner";

const FONT_SIZES = [
  { id: "small", label: "Small" },
  { id: "standard", label: "Std" },
  { id: "large", label: "Large" },
  { id: "xlarge", label: "XL" },
] as const;

interface ShopData {
  id: string;
  name: string;
  description?: string | null;
  phone?: string | null;
  address?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  pan_number?: string | null;
  logo_url?: string | null;
}

interface ShopSettingsProps {
  shopId: string;
  initialData: ShopData;
}

export function ShopSettings({ shopId, initialData }: ShopSettingsProps) {
  const router = useRouter();
  const { ownerFontSize, setOwnerFontSize } = useFontSize();
  const [updatingFontSize, setUpdatingFontSize] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Delete shop state
  const [deleteStage, setDeleteStage] = useState<"idle" | "confirm">("idle");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState(initialData.name ?? "");
  const [description, setDescription] = useState(initialData.description ?? "");
  const [phone, setPhone] = useState(initialData.phone ?? "");
  const [openingTime, setOpeningTime] = useState(
    typeof initialData.opening_time === "string"
      ? initialData.opening_time.slice(0, 5)
      : "07:00"
  );
  const [closingTime, setClosingTime] = useState(
    typeof initialData.closing_time === "string"
      ? initialData.closing_time.slice(0, 5)
      : "21:00"
  );

  const handleUpdateFontSize = async (size: (typeof FONT_SIZES)[number]["id"]) => {
    setUpdatingFontSize(true);
    setOwnerFontSize(size);
    const result = await updateOwnerFontSize(size);
    if (result.error) toast.error(result.error);
    else toast.success(`UI scale set to ${size}`);
    setUpdatingFontSize(false);
  };

  const handleDelete = async () => {
    if (deleteConfirmName.trim() !== initialData.name.trim()) {
      toast.error("Shop name doesn't match.");
      return;
    }
    setDeleting(true);
    const result = await deleteShop(shopId);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Shop deleted.");
      router.push("/dashboard/owner");
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("phone", phone);
    formData.set("opening_time", openingTime);
    formData.set("closing_time", closingTime);

    startTransition(async () => {
      const result = await updateShopSettings(shopId, formData);
      if (result.error) toast.error(result.error);
      else toast.success("Settings saved!");
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <form onSubmit={handleSave} className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#27324A]">Shop Settings</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">Manage your basic business information and preferences.</p>
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="rounded-xl h-11 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold px-6 shadow-sm"
        >
          <Save className="h-4 w-4 mr-2" />
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="space-y-6">
        {/* General Details */}
        <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3 flex items-center gap-2">
            <Store className="h-4 w-4" /> General Details
          </h2>
          <div className="space-y-4">
            <div>
              <Label className="font-bold text-[#27324A]">Store Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 rounded-xl mt-1.5"
              />
            </div>
            <div>
              <Label className="font-bold text-[#27324A]">Description / Tagline</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 rounded-xl resize-none"
                rows={3}
                placeholder="Tell customers about your shop..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-bold text-[#27324A]">Phone Number</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-xl mt-1.5"
                  placeholder="98XXXXXXXX"
                />
              </div>
              {initialData.pan_number && (
                <div>
                  <Label className="font-bold text-[#27324A]">PAN Number</Label>
                  <Input
                    defaultValue={initialData.pan_number}
                    className="h-12 rounded-xl mt-1.5 bg-[#f8f8f7]"
                    readOnly
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Operations */}
        <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Business Hours
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-bold text-[#27324A]">Opening Time</Label>
              <Input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="h-12 rounded-xl mt-1.5"
              />
            </div>
            <div>
              <Label className="font-bold text-[#27324A]">Closing Time</Label>
              <Input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="h-12 rounded-xl mt-1.5"
              />
            </div>
          </div>
        </div>

        {/* Display Preference */}
        <div className="bg-white p-6 rounded-[2rem] border border-[#2E3344]/8 shadow-sm space-y-5">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#746E73] border-b border-[#2E3344]/5 pb-3 flex items-center gap-2">
            <Type className="h-4 w-4" /> Display Preference
          </h2>
          <div>
            <Label className="font-bold text-[#27324A] mb-3 block text-xs uppercase tracking-wider opacity-60">
              Dashboard UI Scale
            </Label>
            <div className="flex p-1 bg-[#E8E3D1]/40 rounded-2xl gap-1">
              {FONT_SIZES.map((sz) => (
                <button
                  type="button"
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
              This scale only applies to the Shop Owner dashboard.
            </p>
          </div>
        </div>
        </div>
      </form>

      {/* Danger Zone — rendered outside the save <form> so Save never triggers delete */}
      <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-[2rem] border-2 border-red-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-red-100 flex items-center gap-3">
          <Trash2 className="h-4 w-4 text-red-500" />
          <h2 className="text-sm font-black uppercase tracking-widest text-red-500">Danger Zone</h2>
        </div>

        <div className="p-6 space-y-4">
          {deleteStage === "idle" && (
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="font-bold text-[#27324A] text-sm">Delete this shop</p>
                <p className="text-xs text-[#746E73] mt-0.5">
                  Permanently removes all products, orders, and data for <strong>{initialData.name}</strong>. This cannot be undone.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteStage("confirm")}
                className="shrink-0 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete shop
              </Button>
            </div>
          )}

          {deleteStage === "confirm" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-red-50 rounded-2xl p-4 border border-red-100">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-700 text-sm">This will permanently delete your shop.</p>
                  <p className="text-xs text-red-600 mt-1">
                    All products, orders, customers, staff, transactions, and storefront data will be erased. There is no recovery.
                  </p>
                </div>
              </div>

              <div>
                <Label className="font-bold text-[#27324A] text-sm">
                  Type <span className="font-mono bg-[#f8f8f7] px-1.5 py-0.5 rounded text-red-600">{initialData.name}</span> to confirm
                </Label>
                <Input
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder={initialData.name}
                  className="h-12 rounded-xl mt-2 border-red-200 focus-visible:ring-red-300"
                  autoComplete="off"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setDeleteStage("idle"); setDeleteConfirmName(""); }}
                  className="rounded-xl font-bold flex-1"
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteConfirmName.trim() !== initialData.name.trim() || deleting}
                  className="rounded-xl font-bold flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
                >
                  {deleting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</>
                  ) : (
                    <><Trash2 className="h-4 w-4 mr-2" />Delete forever</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
