"use client";

import { useRef, useState, useTransition } from "react";
import {
  Shield,
  Plus,
  Lock,
  X,
  Users,
  Camera,
  Loader2,
  LinkIcon,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput, EmailInput } from "@/components/ui/validated-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { addShopStaff, updateShopStaffStatus } from "@/app/actions/owner";
import { linkStaffToUser, unlinkStaffUser } from "@/app/actions/shifts";
import { createClient } from "@/lib/supabase/client";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  image_url: string | null;
  linked_user_id: string | null;
  created_at: string;
}

interface StaffListProps {
  shopId: string;
  initialStaff: StaffMember[];
}

const ROLES = [
  { id: "manager", label: "Manager" },
  { id: "cashier", label: "Cashier" },
  { id: "inventory", label: "Inventory Staff" },
  { id: "viewer", label: "Viewer" },
];

const PERMISSIONS = [
  {
    module: "Dashboard & Analytics",
    manager: true,
    cashier: false,
    inventory: false,
    viewer: true,
  },
  {
    module: "Point of Sale (POS)",
    manager: true,
    cashier: true,
    inventory: false,
    viewer: false,
  },
  {
    module: "Product Management",
    manager: true,
    cashier: false,
    inventory: true,
    viewer: false,
  },
  {
    module: "Stock Adjustments",
    manager: true,
    cashier: false,
    inventory: true,
    viewer: false,
  },
  {
    module: "Customer Udhar",
    manager: true,
    cashier: true,
    inventory: false,
    viewer: false,
  },
  {
    module: "Supplier Payments",
    manager: false,
    cashier: false,
    inventory: false,
    viewer: false,
  },
  {
    module: "Shop Settings",
    manager: false,
    cashier: false,
    inventory: false,
    viewer: false,
  },
];

export function StaffList({ shopId, initialStaff }: StaffListProps) {
  const [staff, setStaff] = useState(initialStaff);
  const [isPending, startTransition] = useTransition();
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    role: "cashier",
    phone: "",
    email: "",
    notes: "",
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleAdd = () => {
    startTransition(async () => {
      let imageUrl: string | null = null;

      if (photoFile) {
        setUploading(true);
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const path = `staff/${shopId}/${Date.now()}.${ext}`;
        const { data: uploaded, error: uploadError } = await supabase.storage
          .from("shop_assets")
          .upload(path, photoFile, { upsert: true });
        setUploading(false);
        if (uploadError) {
          toast.error("Photo upload failed. Staff was not added.");
          return;
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from("shop_assets").getPublicUrl(uploaded.path);
        imageUrl = publicUrl;
      }

      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.set(k, v));
      if (imageUrl) formData.set("image_url", imageUrl);

      const result = await addShopStaff(shopId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Staff member added.");
        setShowAddModal(false);
        setForm({ name: "", role: "cashier", phone: "", email: "", notes: "" });
        setPhotoPreview(null);
        setPhotoFile(null);
        window.location.reload();
      }
    });
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    startTransition(async () => {
      const result = await updateShopStaffStatus(
        id,
        shopId,
        newStatus as "active" | "inactive",
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        setStaff((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)),
        );
        toast.success(`Staff marked as ${newStatus}.`);
      }
    });
  };

  const activeStaff = staff.filter((s) => s.status === "active");
  const inactiveStaff = staff.filter((s) => s.status !== "active");

  const handleLinkAccount = (memberId: string, defaultEmail: string | null) => {
    const email =
      typeof window !== "undefined"
        ? window.prompt(
            "Enter the Quivo email address of this staff member so they can log in and clock in:",
            defaultEmail ?? "",
          )
        : null;
    if (!email || !email.trim()) return;
    startTransition(async () => {
      const res = await linkStaffToUser(memberId, email.trim());
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setStaff((prev) =>
        prev.map((s) =>
          s.id === memberId
            ? { ...s, linked_user_id: res.userId ?? "linked" }
            : s,
        ),
      );
      toast.success("Staff account linked");
    });
  };

  const handleUnlinkAccount = (memberId: string) => {
    startTransition(async () => {
      const res = await unlinkStaffUser(memberId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setStaff((prev) =>
        prev.map((s) =>
          s.id === memberId ? { ...s, linked_user_id: null } : s,
        ),
      );
      toast.success("Account unlinked");
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#27324A]">Staff & Roles</h1>
          <p className="text-sm font-medium text-[#746E73] mt-1">
            Manage employee access and shop permissions.
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="rounded-xl h-12 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold px-6 shadow-sm w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Staff Member
        </Button>
      </div>

      {staff.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center bg-white rounded-[2rem] border border-[#2E3344]/8">
          <div className="h-16 w-16 rounded-2xl bg-[#F7F0E6] flex items-center justify-center">
            <Users className="h-8 w-8 text-[#A7653A]" />
          </div>
          <h3 className="text-lg font-black text-[#27324A]">
            No staff added yet
          </h3>
          <p className="text-sm text-[#746E73] font-medium max-w-xs">
            Add your cashiers, managers, and inventory staff to track who has
            access to what.
          </p>
          <Button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl h-11 bg-[#27324A] hover:bg-[#1b2333] text-white font-bold"
          >
            <Plus className="h-4 w-4 mr-2" /> Add First Staff Member
          </Button>
        </div>
      )}

      {staff.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Staff List */}
          <div className="lg:col-span-4 space-y-3">
            {activeStaff.map((member) => (
              <div
                key={member.id}
                className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/8 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#E8E3D1]/50 flex items-center justify-center font-black text-[#A7653A] overflow-hidden shrink-0">
                    {member.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.image_url}
                        alt={member.name}
                        className="h-10 w-10 object-cover"
                      />
                    ) : (
                      member.name[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[#27324A] text-sm">
                      {member.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-[#A7653A] bg-[#F7F0E6] px-2 py-0.5 rounded-md uppercase tracking-widest">
                        {ROLES.find((r) => r.id === member.role)?.label ??
                          member.role}
                      </span>
                      {member.phone && (
                        <span className="text-[10px] text-[#746E73] font-bold">
                          {member.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {member.linked_user_id ? (
                    <button
                      disabled={isPending}
                      onClick={() => handleUnlinkAccount(member.id)}
                      title="Unlink account"
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-[#41A560] hover:bg-red-50 hover:text-red-500 transition disabled:opacity-40"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      disabled={isPending}
                      onClick={() => handleLinkAccount(member.id, member.email)}
                      title="Link to a Quivo account so they can use the staff dashboard"
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-[#746E73] hover:bg-[#F7F0E6] hover:text-[#A7653A] transition disabled:opacity-40"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    disabled={isPending}
                    onClick={() => handleToggleStatus(member.id, member.status)}
                    className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            ))}
            {inactiveStaff.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#746E73] mb-2 ml-1">
                  Inactive
                </p>
                {inactiveStaff.map((member) => (
                  <div
                    key={member.id}
                    className="bg-white p-4 rounded-[1.5rem] border border-[#2E3344]/5 shadow-sm flex items-center justify-between opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#E8E3D1]/30 flex items-center justify-center font-black text-[#746E73] overflow-hidden shrink-0">
                        {member.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.image_url}
                            alt={member.name}
                            className="h-10 w-10 object-cover"
                          />
                        ) : (
                          member.name[0].toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-[#746E73] text-sm">
                          {member.name}
                        </p>
                        <span className="text-[10px] font-bold text-[#746E73] uppercase tracking-widest">
                          Inactive
                        </span>
                      </div>
                    </div>
                    <button
                      disabled={isPending}
                      onClick={() =>
                        handleToggleStatus(member.id, member.status)
                      }
                      className="text-xs font-bold text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg transition"
                    >
                      Reactivate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Permissions Matrix */}
          <div className="lg:col-span-8 bg-white rounded-[2rem] border border-[#2E3344]/8 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#2E3344]/8 bg-[#f8f8f7] flex items-center gap-3">
              <Shield className="h-5 w-5 text-[#27324A]" />
              <h2 className="text-lg font-black text-[#27324A]">
                Role Permissions
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white border-b border-[#2E3344]/8 text-[#746E73] font-bold uppercase tracking-widest text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Module</th>
                    <th className="px-6 py-4 text-center">Owner</th>
                    <th className="px-6 py-4 text-center">Manager</th>
                    <th className="px-6 py-4 text-center">Cashier</th>
                    <th className="px-6 py-4 text-center">Inventory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E3344]/5">
                  {PERMISSIONS.map((perm, i) => (
                    <tr key={i} className="hover:bg-[#f8f8f7]/50 transition">
                      <td className="px-6 py-4 font-bold text-[#27324A]">
                        {perm.module}
                      </td>
                      {[true, perm.manager, perm.cashier, perm.inventory].map(
                        (allowed, j) => (
                          <td key={j} className="px-6 py-4 text-center">
                            {allowed ? (
                              <div className="mx-auto h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                              </div>
                            ) : (
                              <Lock className="h-4 w-4 text-[#746E73] mx-auto opacity-30" />
                            )}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-[#f8f8f7] text-center border-t border-[#2E3344]/5">
              <p className="text-[10px] text-[#746E73] font-bold">
                Owner always has full access. Staff without a Quivo account are
                tracked for record-keeping only.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-[#27324A]">
                Add Staff Member
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setPhotoPreview(null);
                  setPhotoFile(null);
                }}
                className="text-[#746E73] hover:text-[#27324A] p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Photo upload */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-[#F7F0E6] border-2 border-dashed border-[#A7653A]/30 flex items-center justify-center overflow-hidden shrink-0">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="h-16 w-16 object-cover"
                    />
                  ) : (
                    <Camera className="h-6 w-6 text-[#A7653A]/40" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#27324A]">
                    Staff Photo
                  </p>
                  <p className="text-xs text-[#746E73] mb-2">Optional</p>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="text-xs font-bold text-[#A7653A] hover:underline"
                  >
                    {photoPreview ? "Change photo" : "Upload photo"}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>
              </div>

              <div>
                <Label className="font-bold text-[#27324A]">Full Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Staff member name"
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>
              <div>
                <Label className="font-bold text-[#27324A]">Role *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger className="w-full mt-1.5 h-12">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-bold text-[#27324A]">Phone</Label>
                  <PhoneInput
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="98XXXXXXXX"
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
                <div>
                  <Label className="font-bold text-[#27324A]">Email</Label>
                  <EmailInput
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="staff@email.com"
                    className="h-12 rounded-xl mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label className="font-bold text-[#27324A]">
                  Notes (optional)
                </Label>
                <Input
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="e.g. Morning shift only"
                  className="h-12 rounded-xl mt-1.5"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setPhotoPreview(null);
                  setPhotoFile(null);
                }}
                className="flex-1 h-12 rounded-xl border-[#2E3344]/10 font-bold"
              >
                Cancel
              </Button>
              <Button
                disabled={isPending || uploading || !form.name.trim()}
                onClick={handleAdd}
                className="flex-1 h-12 rounded-xl bg-[#27324A] hover:bg-[#1b2333] text-white font-bold"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 hidden" />
                    Uploading…
                  </>
                ) : isPending ? (
                  "Saving…"
                ) : (
                  "Add Staff"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
