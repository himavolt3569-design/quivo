"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Briefcase,
  Edit2,
  Home,
  MapPin,
  Navigation,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "@/app/actions/customer";
import type { Address } from "@/lib/types";
import type { PinCoords } from "./AddressPinPicker";
import { LABEL_COLOR } from "./address-constants";
import { PhoneInput } from "@/components/ui/validated-input";

const AddressPinPicker = dynamic(
  () => import("./AddressPinPicker").then((m) => m.AddressPinPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] hidden rounded-xl bg-[#F7F0E6]" />
    ),
  },
);

const AddressOverviewMap = dynamic(
  () => import("./AddressOverviewMap").then((m) => m.AddressOverviewMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] hidden rounded-t-2xl bg-[#F7F0E6]" />
    ),
  },
);

const LABELS = ["Home", "Work", "Other"] as const;
type LabelType = (typeof LABELS)[number];

const LABEL_ICON: Record<LabelType, React.ElementType> = {
  Home,
  Work: Briefcase,
  Other: MapPin,
};

interface FormState {
  label: LabelType;
  address_line: string;
  landmark: string;
  phone: string;
  is_default: boolean;
  pin: PinCoords | null;
  showMap: boolean;
  geocoding: boolean;
}

const BLANK: FormState = {
  label: "Home",
  address_line: "",
  landmark: "",
  phone: "",
  is_default: false,
  pin: null,
  showMap: false,
  geocoding: false,
};

interface AddressBookProps {
  addresses: Address[];
  onChange: (updated: Address[]) => void;
}

export function AddressBook({ addresses, onChange }: AddressBookProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openAdd = () => {
    setForm(BLANK);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (addr: Address) => {
    setForm({
      label: (LABELS.includes(addr.label as LabelType)
        ? addr.label
        : "Other") as LabelType,
      address_line: addr.address_line,
      landmark: addr.landmark ?? "",
      phone: addr.phone ?? "",
      is_default: addr.is_default,
      pin: addr.lat && addr.lng ? { lat: addr.lat, lng: addr.lng } : null,
      showMap: !!(addr.lat && addr.lng),
      geocoding: false,
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address_line.trim()) {
      toast.error("Address line is required");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Contact number is required");
      return;
    }
    setSubmitting(true);

    const fd = new FormData();
    fd.set("label", form.label);
    fd.set("address_line", form.address_line.trim());
    fd.set("landmark", form.landmark.trim());
    fd.set("phone", form.phone.trim());
    fd.set("is_default", String(form.is_default));
    if (form.pin) {
      fd.set("lat", String(form.pin.lat));
      fd.set("lng", String(form.pin.lng));
    }

    try {
      const result = editingId
        ? await updateAddress(editingId, fd)
        : await addAddress(fd);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(editingId ? "Address updated" : "Address saved");
      setShowForm(false);

      if (editingId) {
        onChange(
          addresses.map((a) =>
            a.id === editingId
              ? {
                  ...a,
                  ...form,
                  is_default: form.is_default,
                  landmark: form.landmark || null,
                  phone: form.phone || null,
                  lat: form.pin?.lat ?? null,
                  lng: form.pin?.lng ?? null,
                }
              : form.is_default
                ? { ...a, is_default: false }
                : a,
          ),
        );
      } else {
        const fresh: Address = {
          id: crypto.randomUUID(),
          customer_id: "",
          label: form.label,
          address_line: form.address_line.trim(),
          landmark: form.landmark || null,
          phone: form.phone || null,
          is_default: form.is_default,
          lat: form.pin?.lat ?? null,
          lng: form.pin?.lng ?? null,
          created_at: new Date().toISOString(),
        };
        onChange([
          ...addresses.map((a) =>
            form.is_default ? { ...a, is_default: false } : a,
          ),
          fresh,
        ]);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const result = await deleteAddress(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Address removed");
        onChange(addresses.filter((a) => a.id !== id));
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    const result = await setDefaultAddress(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      onChange(addresses.map((a) => ({ ...a, is_default: a.id === id })));
      toast.success("Default address updated");
    }
  };

  const LabelIcon = LABEL_ICON[form.label] ?? MapPin;
  const pinnedAddresses = addresses.filter(
    (a) => a.lat != null && a.lng != null,
  );
  const overviewKey = pinnedAddresses
    .map((a) => `${a.id}:${a.lat}:${a.lng}`)
    .join(",");

  return (
    <div className="space-y-4">
      {/* Overview map — shown when 1+ addresses are pinned and no form is open */}
      {pinnedAddresses.length > 0 && !showForm && (
        <div className="overflow-hidden rounded-2xl border border-[#2E3344]/8 bg-white shadow-sm">
          <AddressOverviewMap key={overviewKey} addresses={addresses} />
          <div className="flex flex-wrap items-center gap-4 border-t border-[#2E3344]/6 px-4 py-2.5">
            {pinnedAddresses.map((a) => (
              <span
                key={a.id}
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: LABEL_COLOR[a.label] ?? LABEL_COLOR.Other }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: LABEL_COLOR[a.label] ?? LABEL_COLOR.Other,
                  }}
                />
                {a.label}
              </span>
            ))}
            <span className="ml-auto text-[10px] text-[#746E73]">
              Tap a pin to see address
            </span>
          </div>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-[#2E3344]/15 bg-white p-10 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-[#2E3344]/20" />
          <p className="text-sm font-semibold text-[#27324A]">
            No saved addresses
          </p>
          <p className="mt-1 mb-4 text-xs text-[#746E73]">
            Add a home or work address for faster checkout.
          </p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-full bg-[#A7653A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8E5432]"
          >
            <Plus className="h-4 w-4" />
            Add address
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => {
            const Icon =
              LABEL_ICON[(addr.label as LabelType) ?? "Other"] ?? MapPin;
            return (
              <div
                key={addr.id}
                className={`rounded-2xl border bg-white p-4 transition ${
                  addr.is_default
                    ? "border-[#A7653A]/30 shadow-sm shadow-[#A7653A]/10"
                    : "border-[#2E3344]/8"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[#E8E3D1] text-[#626A54]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#27324A]">
                        {addr.label}
                      </span>
                      {addr.is_default && (
                        <span className="rounded-full bg-[#A7653A]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#A7653A]">
                          Default
                        </span>
                      )}
                      {addr.lat && addr.lng && (
                        <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-600">
                          <Navigation className="h-2.5 w-2.5" />
                          Pinned
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#746E73]">
                      {addr.address_line}
                      {addr.landmark ? `, ${addr.landmark}` : ""}
                    </p>
                    {addr.phone && (
                      <p className="mt-0.5 text-xs text-[#746E73]">
                        {addr.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-[#2E3344]/6 pt-3">
                  {!addr.is_default && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="flex items-center gap-1.5 rounded-full border border-[#2E3344]/10 px-3 py-1.5 text-xs font-semibold text-[#746E73] transition hover:bg-[#F7F0E6]"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(addr)}
                    className="flex items-center gap-1.5 rounded-full border border-[#2E3344]/10 px-3 py-1.5 text-xs font-semibold text-[#746E73] transition hover:bg-[#F7F0E6]"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    disabled={deletingId === addr.id}
                    className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingId === addr.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}

          {!showForm && (
            <button
              onClick={openAdd}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#2E3344]/15 bg-white py-4 text-sm font-semibold text-[#A7653A] transition hover:border-[#A7653A]/30 hover:bg-[#F7F0E6]"
            >
              <Plus className="h-4 w-4" />
              Add another address
            </button>
          )}
        </div>
      )}

      {/* Inline address form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-[#A7653A]/25 bg-white p-5 shadow-sm"
        >
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#27324A]">
              {editingId ? "Edit address" : "New address"}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full p-1.5 text-[#746E73] transition hover:bg-[#F7F0E6]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Label */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-[#27324A]">
              Label
            </label>
            <div className="flex gap-2">
              {LABELS.map((l) => {
                const LIcon = LABEL_ICON[l];
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, label: l }))}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      form.label === l
                        ? "border-[#A7653A] bg-[#A7653A] text-white"
                        : "border-[#2E3344]/12 text-[#746E73] hover:border-[#A7653A]/40"
                    }`}
                  >
                    <LIcon className="h-3.5 w-3.5" />
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Address line */}
          <div>
            <label
              htmlFor="address_line"
              className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#27324A]"
            >
              Address *
              {form.geocoding && (
                <span className="flex items-center gap-1 font-normal text-[#A7653A]">
                  <span className="inline-block h-3 w-3 hidden rounded-full border-2 border-[#A7653A] border-t-transparent" />
                  Fetching address…
                </span>
              )}
            </label>
            <input
              id="address_line"
              type="text"
              required
              value={form.address_line}
              onChange={(e) =>
                setForm((f) => ({ ...f, address_line: e.target.value }))
              }
              placeholder="Street, locality, district"
              className="w-full rounded-xl border border-[#2E3344]/12 bg-[#F7F0E6]/40 px-4 py-2.5 text-sm text-[#27324A] outline-none transition placeholder-[#746E73]/60 focus:border-[#A7653A] focus:ring-2 focus:ring-[#A7653A]/15"
            />
          </div>

          {/* Landmark */}
          <div>
            <label
              htmlFor="landmark"
              className="mb-1.5 block text-xs font-semibold text-[#27324A]"
            >
              Landmark{" "}
              <span className="font-normal text-[#746E73]">(optional)</span>
            </label>
            <input
              id="landmark"
              type="text"
              value={form.landmark}
              onChange={(e) =>
                setForm((f) => ({ ...f, landmark: e.target.value }))
              }
              placeholder="Near main gate, beside school…"
              className="w-full rounded-xl border border-[#2E3344]/12 bg-[#F7F0E6]/40 px-4 py-2.5 text-sm text-[#27324A] outline-none transition placeholder-[#746E73]/60 focus:border-[#A7653A] focus:ring-2 focus:ring-[#A7653A]/15"
            />
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-xs font-semibold text-[#27324A]"
            >
              Contact number *
            </label>
            <PhoneInput
              id="phone"
              name="phone"
              required
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              placeholder="98XXXXXXXX"
              className="rounded-xl border border-[#2E3344]/12 bg-[#F7F0E6]/40 px-4 py-2.5 text-sm text-[#27324A] placeholder-[#746E73]/60"
            />
          </div>

          {/* Default toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={form.is_default}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_default: e.target.checked }))
                }
              />
              <div
                className={`h-5 w-9 rounded-full transition-colors duration-200 ${
                  form.is_default ? "bg-[#A7653A]" : "bg-[#2E3344]/20"
                }`}
              />
              <div
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  form.is_default ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
            <span className="text-sm font-medium text-[#27324A]">
              Set as default delivery address
            </span>
          </label>

          {/* Map pin toggle */}
          <div className="rounded-xl border border-[#2E3344]/8 bg-[#F7F0E6]/30 p-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, showMap: !f.showMap }))}
              className="flex w-full items-center justify-between text-sm font-semibold text-[#27324A]"
            >
              <span className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-[#A7653A]" />
                Pin exact location on map
                {form.pin && (
                  <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-600">
                    Pinned ✓
                  </span>
                )}
              </span>
              <span className="text-[#746E73]">{form.showMap ? "▲" : "▼"}</span>
            </button>

            {form.showMap && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-[#746E73]">
                  Click on the map or drag the pin to set your exact delivery
                  point.
                </p>
                <AddressPinPicker
                  key={editingId ?? "new"}
                  value={form.pin}
                  onChange={(coords) =>
                    setForm((f) => ({ ...f, pin: coords, geocoding: true }))
                  }
                  onAddressFound={(address, landmark) =>
                    setForm((f) => ({
                      ...f,
                      geocoding: false,
                      // Always update address from geocode — user moved the pin intentionally
                      address_line: address || f.address_line,
                      // Only fill landmark if user hasn't typed one
                      landmark: f.landmark.trim()
                        ? f.landmark
                        : (landmark ?? f.landmark),
                    }))
                  }
                />
                {form.pin && (
                  <p className="mt-1.5 text-center text-[10px] font-semibold text-green-600">
                    📍 {form.pin.lat.toFixed(5)}, {form.pin.lng.toFixed(5)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-full border border-[#2E3344]/12 py-2.5 text-sm font-semibold text-[#746E73] transition hover:bg-[#F7F0E6]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-full bg-[#A7653A] py-2.5 text-sm font-semibold text-white transition hover:bg-[#8E5432] disabled:opacity-50 active:scale-95"
            >
              {submitting ? "Saving…" : editingId ? "Update" : "Save address"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
