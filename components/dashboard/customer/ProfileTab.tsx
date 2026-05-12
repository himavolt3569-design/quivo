"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, Clock, Eye, EyeOff, KeyRound, MapPin, Package, Store, X, Bookmark, Palette, Check, Type, Bell, ChevronDown, Edit2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

import { createClient } from "@/lib/supabase/client";
import { updateProfile, updateAvatar, updateCoverColor, updateFontSize, changePassword } from "@/app/actions/customer";
import type { Address, Profile } from "@/lib/types";
import { AddressBook } from "./AddressBook";
import { useFontSize } from "@/components/FontProvider";

interface ProfileTabProps {
  user: SupabaseUser;
  profile: Profile | null;
  addresses: Address[];
  totalOrderCount: number;
  savedShopCount: number;
  savedProductCount: number;
}

const COVER_GRADIENTS = [
  "from-[#A7653A] via-[#D8C99A] to-[#B76E42]", // Default
  "from-[#27324A] via-[#4A5E82] to-[#1B2030]", // Blue/Navy
  "from-[#626A54] via-[#8F987D] to-[#464D3B]", // Green/Sage
  "from-[#8D5132] via-[#B8714B] to-[#5C331F]", // Rust/Brown
  "from-[#E8E3D1] via-[#FFFFFF] to-[#D5CDBD]", // Light
];

const FONT_SIZES = [
  { id: "small", label: "Small" },
  { id: "standard", label: "Std" },
  { id: "large", label: "Large" },
  { id: "xlarge", label: "XL" },
] as const;

// Helper to extract cropped image using Canvas API
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"));
        return;
      }
      resolve(blob);
    }, "image/jpeg", 0.9);
  });
}

export function ProfileTab({
  user,
  profile,
  addresses: initialAddresses,
  totalOrderCount,
  savedShopCount,
  savedProductCount,
}: ProfileTabProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.full_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url ?? null
  );
  
  // Cover Color State
  const [coverGradient, setCoverGradient] = useState<string>(
    profile?.cover_color ?? COVER_GRADIENTS[0]
  );
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [savingColor, setSavingColor] = useState(false);

  // Avatar Cropping State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const { customerFontSize, setCustomerFontSize } = useFontSize();
  const [updatingFontSize, setUpdatingFontSize] = useState(false);

  // Layout Toggles
  const [showAddresses, setShowAddresses] = useState(false);

  // Password change
  const isGoogleUser = (user.identities ?? []).every((id) => id.provider !== "email");
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [changingPw, setChangingPw] = useState(false);

  const displayName = profile?.full_name ?? user.email?.split("@")[0] ?? "User";
  const initial = displayName[0].toUpperCase();

  const handleSaveName = async () => {
    if (!nameInput.trim() || nameInput.trim() === profile?.full_name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const fd = new FormData();
    fd.set("full_name", nameInput.trim());
    const result = await updateProfile(fd);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Name updated");
      setEditingName(false);
      router.refresh();
    }
    setSavingName(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPw(true);
    const fd = new FormData();
    fd.set("current_password", pwForm.current);
    fd.set("new_password", pwForm.next);
    fd.set("confirm_password", pwForm.confirm);
    const result = await changePassword(fd);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(isGoogleUser ? "Password set — you can now sign in with email too" : "Password updated");
      setPwForm({ current: "", next: "", confirm: "" });
    }
    setChangingPw(false);
  };

  const handleUpdateFontSize = async (size: (typeof FONT_SIZES)[number]["id"]) => {
    setUpdatingFontSize(true);
    setCustomerFontSize(size); // Optimistic UI update
    
    const result = await updateFontSize(size);
    if (result.error) {
      toast.error(result.error);
      setCustomerFontSize(profile?.font_size ?? "standard"); // Revert on error
    } else {
      toast.success(`Customer UI scale set to ${size}`);
    }
    setUpdatingFontSize(false);
  };

  const handleSaveCoverColor = async (color: string) => {
    setSavingColor(true);
    setCoverGradient(color); // Optimistic UI update
    
    const result = await updateCoverColor(color);
    if (result.error) {
      toast.error(result.error);
      setCoverGradient(profile?.cover_color ?? COVER_GRADIENTS[0]); // Revert on error
    } else {
      toast.success("Cover color updated");
      router.refresh();
    }
    
    setSavingColor(false);
    setShowColorPicker(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5 MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Please choose an image file");
        return;
      }
      
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setCropImage(reader.result?.toString() || null);
      });
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleUploadAvatar = async () => {
    if (!cropImage || !croppedAreaPixels) return;

    setUploadingAvatar(true);
    try {
      // 1. Get cropped image blob
      const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
      
      // 2. Convert blob to file for Supabase
      const ext = cropImage.substring(cropImage.indexOf("/") + 1, cropImage.indexOf(";")) === "png" ? "png" : "jpg";
      const file = new File([croppedBlob], `avatar.${ext}`, { type: `image/${ext}` });

      // 3. Upload to Supabase
      const supabase = createClient();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      // 4. Update Profile record
      const result = await updateAvatar(publicUrl);
      if (result.error) {
        toast.error(result.error);
      } else {
        setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
        toast.success("Profile photo updated");
        setCropImage(null); // Close cropper modal
      }
    } catch (err) {
      toast.error("Upload failed — please try again");
      console.error(err);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const memberSince = new Date(
    profile?.created_at ?? user.created_at
  ).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  return (
    <div className="space-y-6 max-w-4xl mx-auto relative">
      {/* ── Avatar Cropping Modal Overlay ──────────────────────────── */}
      {cropImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#f8f8f7] rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col border border-[#2E3344]/10">
            <div className="p-6 border-b border-[#2E3344]/8 flex items-center justify-between bg-white">
              <h3 className="font-bold text-[#27324A] text-lg">Adjust Profile Photo</h3>
              <button 
                onClick={() => setCropImage(null)}
                className="p-2 rounded-full hover:bg-[#F7F0E6] text-[#746E73] transition"
                disabled={uploadingAvatar}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="relative h-64 sm:h-80 w-full bg-black/5">
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            
            <div className="p-8 bg-white space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73] mb-4 text-center">Zoom Level</p>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#F7F0E6] rounded-lg appearance-none cursor-pointer accent-[#A7653A]"
                  disabled={uploadingAvatar}
                />
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setCropImage(null)}
                  disabled={uploadingAvatar}
                  className="flex-1 py-4 px-4 rounded-full border border-[#2E3344]/12 font-bold text-xs uppercase tracking-widest text-[#746E73] hover:bg-[#F7F0E6] transition active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUploadAvatar}
                  disabled={uploadingAvatar}
                  className="flex-1 py-4 px-4 rounded-full bg-[#A7653A] font-black text-xs uppercase tracking-widest text-white shadow-lg shadow-[#A7653A]/20 hover:bg-[#8E5432] transition active:scale-95 flex items-center justify-center"
                >
                  {uploadingAvatar ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    "Save Photo"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Super Minimal Profile Header ───────────────────────────── */}
      <div className="relative rounded-[2.5rem] overflow-hidden bg-white border border-[#2E3344]/8 shadow-sm">
        {/* Slim Cover Banner */}
        <div className={`h-24 sm:h-32 w-full bg-gradient-to-r ${coverGradient} relative transition-all duration-700`}>
          {/* Animated Glow Orbs for Depth */}
          <div className="absolute top-[-20%] left-[-10%] h-40 w-40 rounded-full bg-white/20 blur-3xl animate-pulse" />
          <div className="absolute bottom-[-10%] right-[15%] h-32 w-32 rounded-full bg-black/10 blur-2xl animate-bounce duration-[8s]" />
          
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
          
          {/* Glass-morphic Member Badge */}
          <div className="absolute bottom-3 right-4 z-10 hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-sm transition-transform hover:scale-105">
             <ShieldCheck className="h-3 w-3 text-[#D8C99A]" />
             <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white">Verified Quivo Member</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="absolute top-4 right-4 z-20 rounded-full bg-black/10 hover:bg-black/20 backdrop-blur-sm p-2 text-white transition active:scale-95 border border-white/5"
            aria-label="Change cover color"
          >
            <Palette className="h-3.5 w-3.5" />
          </button>

          {/* Color Picker Dropdown */}
          {showColorPicker && (
            <div className="absolute top-14 right-4 z-30 bg-white rounded-2xl shadow-xl p-2 border border-[#2E3344]/10 animate-in fade-in zoom-in duration-200">
              <div className="flex flex-col gap-1.5">
                {COVER_GRADIENTS.map((gradient, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSaveCoverColor(gradient)}
                    className={`h-8 w-24 rounded-lg bg-gradient-to-r ${gradient} relative shadow-inner overflow-hidden border-2 transition ${
                      coverGradient === gradient ? "border-[#27324A]" : "border-transparent hover:scale-105"
                    }`}
                  >
                    {coverGradient === gradient && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Minimal User Info Strip */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Minimal Avatar */}
            <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-white p-1 shadow-md border border-[#2E3344]/5 flex-shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="group relative h-full w-full block rounded-xl overflow-hidden bg-[#27324A]"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white text-xl font-black">
                    {initial}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </div>

            <div className="min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    className="w-40 sm:w-56 rounded-xl border border-[#A7653A]/30 bg-[#F7F0E6]/30 px-3 py-1.5 text-sm font-bold text-[#27324A] outline-none focus:ring-2 focus:ring-[#A7653A]/20 shadow-sm"
                  />
                  <button onClick={handleSaveName} className="text-[10px] font-black uppercase text-[#A7653A] hover:underline">Save</button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black tracking-tight text-[#27324A] truncate">
                      {profile?.full_name ?? "User"}
                    </h2>
                    <button onClick={() => setEditingName(true)} className="text-[#746E73] hover:text-[#A7653A] transition">
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs font-bold text-[#746E73]/70 truncate">{user.email}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
             <div className="flex items-center gap-2 bg-[#F7F0E6] px-3 py-1.5 rounded-full border border-[#2E3344]/5">
                <Clock className="h-3 w-3 text-[#A7653A]" />
                <p className="text-[10px] font-black text-[#A7653A] uppercase tracking-widest">
                  Joined: {memberSince}
                </p>
             </div>
             <p className="text-[10px] font-black text-[#746E73] bg-white border border-[#2E3344]/8 px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
               ID: {user.id.slice(0, 8)}
             </p>
          </div>
        </div>
      </div>

      {/* ── Main Layout Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* Left Column: Settings & Community */}
        <div className="space-y-6">
          {/* Your Community Bento */}
          <div 
            onClick={() => router.push("/dashboard/saved")}
            className="rounded-[2.5rem] border border-[#2E3344]/8 bg-white p-7 shadow-sm group cursor-pointer hover:border-[#A7653A]/20 transition-all active:scale-[0.98]"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F7F0E6] text-[#A7653A]">
                    <Store className="h-5 w-5" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#8D5132]">Local Network</h3>
                </div>
                <ChevronDown className="h-4 w-4 -rotate-90 text-[#746E73] group-hover:text-[#A7653A] transition-colors" />
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-3xl font-black text-[#27324A]">{savedShopCount}</p>
                  <p className="text-sm font-bold text-[#746E73] mt-0.5">Favorite Shops</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#A7653A] bg-[#F7F0E6] px-3 py-1.5 rounded-full">
                  View Saved
                </span>
              </div>
            </div>
          </div>

          {/* Display Settings Bento */}
          <div className="rounded-[2.5rem] border border-[#2E3344]/8 bg-white p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3 px-1">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F7F0E6] text-[#A7653A]">
                <Type className="h-5 w-5" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-[#8D5132]">
                UI Text Scale
              </h3>
            </div>
            
            <div className="space-y-4 px-1">
              <div className="flex p-1 bg-[#E8E3D1]/40 rounded-2xl gap-1">
                {FONT_SIZES.map((sz) => (
                  <button
                    key={sz.id}
                    disabled={updatingFontSize}
                    onClick={() => handleUpdateFontSize(sz.id)}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition ${
                      customerFontSize === sz.id
                        ? "bg-white text-[#27324A] shadow-sm"
                        : "text-[#746E73] hover:text-[#27324A]"
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#746E73] font-medium leading-relaxed italic">
                Pro-tip: Increase scale for easier reading on small mobile screens.
              </p>
            </div>
          </div>

          {/* Collapsible Address Section */}
          <div className={`rounded-[2.5rem] border transition-all duration-300 ${showAddresses ? "border-[#A7653A]/20 bg-white shadow-md" : "border-[#2E3344]/8 bg-[#F7F0E6]/30 hover:bg-[#F7F0E6]/50"}`}>
            <button 
              onClick={() => setShowAddresses(!showAddresses)}
              className="w-full flex items-center justify-between p-7"
            >
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors ${showAddresses ? "bg-[#A7653A] text-white" : "bg-white text-[#A7653A] shadow-sm"}`}>
                  <MapPin className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black text-[#27324A] uppercase tracking-wider">Saved Addresses</h3>
                  <p className="text-xs font-bold text-[#746E73]">{addresses.length} total locations</p>
                </div>
              </div>
              <div className={`h-10 w-10 rounded-full border border-[#2E3344]/8 flex items-center justify-center transition-transform duration-500 ${showAddresses ? "rotate-180 bg-[#27324A] text-white border-transparent" : "bg-white text-[#746E73]"}`}>
                 <ChevronDown className="h-5 w-5" />
              </div>
            </button>
            
            {showAddresses && (
              <div className="px-7 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="h-px bg-[#2E3344]/8 mb-6" />
                <AddressBook addresses={addresses} onChange={setAddresses} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Content */}
        <div className="space-y-6">
          
          {/* Notifications Card - Professional Placeholder */}
          <div className="rounded-[2.5rem] bg-[#27324A] p-7 text-white shadow-xl shadow-[#27324A]/10 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-6 opacity-[0.05] group-hover:rotate-12 transition-transform">
                <Bell className="h-20 w-20" />
             </div>
             <div className="relative z-10">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#D8C99A]">Communication</h3>
                <p className="text-xl font-black mt-3">Notification Settings</p>
                <div className="mt-5 space-y-3">
                   {[
                     { label: "Order Status Updates", active: true },
                     { label: "Promotions & Coins", active: false }
                   ].map((item) => (
                     <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <span className="text-xs font-bold text-white/80">{item.label}</span>
                        <div className={`h-5 w-9 rounded-full transition-colors relative ${item.active ? "bg-[#A7653A]" : "bg-white/10"}`}>
                           <div className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${item.active ? "left-5" : "left-1"}`} />
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>

          {/* Security Bento */}
          <div className="rounded-[2.5rem] border border-[#2E3344]/8 bg-white p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3 px-1">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F7F0E6] text-[#A7653A]">
                <KeyRound className="h-5 w-5" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-[#8D5132]">
                Security Settings
              </h3>
            </div>
            
            <div className="px-1">
               {isGoogleUser && (
                <div className="bg-[#F7F0E6]/40 p-4 rounded-2xl border border-[#2E3344]/5 mb-6">
                  <p className="text-xs font-bold text-[#27324A]">Google Connected</p>
                  <p className="text-[10px] text-[#746E73] mt-1 font-medium leading-relaxed">
                    Set a password below to enable standard email sign-in for your account.
                  </p>
                </div>
               )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-3">
                  {!isGoogleUser && (
                    <div className="relative">
                      <input
                        type={showPw.current ? "text" : "password"}
                        placeholder="Current Password"
                        required
                        className="w-full px-5 py-3 rounded-2xl bg-[#F7F0E6]/30 border border-[#2E3344]/8 text-sm font-bold text-[#27324A] outline-none focus:ring-2 focus:ring-[#A7653A]/20"
                        value={pwForm.current}
                        onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                      />
                      <button type="button" onClick={() => setShowPw({...showPw, current: !showPw.current})} className="absolute right-4 top-3.5 text-[#746E73]">
                        {showPw.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type={showPw.next ? "text" : "password"}
                      placeholder="New Password"
                      required
                      className="w-full px-5 py-3 rounded-2xl bg-[#F7F0E6]/30 border border-[#2E3344]/8 text-sm font-bold text-[#27324A] outline-none focus:ring-2 focus:ring-[#A7653A]/20"
                      value={pwForm.next}
                      onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                    />
                    <button type="button" onClick={() => setShowPw({...showPw, next: !showPw.current})} className="absolute right-4 top-3.5 text-[#746E73]">
                      {showPw.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPw.confirm ? "text" : "password"}
                      placeholder="Confirm New Password"
                      required
                      className="w-full px-5 py-3 rounded-2xl bg-[#F7F0E6]/30 border border-[#2E3344]/8 text-sm font-bold text-[#27324A] outline-none focus:ring-2 focus:ring-[#A7653A]/20"
                      value={pwForm.confirm}
                      onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={changingPw}
                  className="w-full h-12 rounded-full bg-[#27324A] text-white text-xs font-black uppercase tracking-widest hover:bg-[#1a2233] transition disabled:opacity-50"
                >
                  {changingPw ? "Updating..." : (isGoogleUser ? "Setup Password" : "Change Password")}
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}