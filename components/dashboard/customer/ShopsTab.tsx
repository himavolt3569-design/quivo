"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Store,
  Clock,
  Navigation,
  AlertCircle,
  ChevronRight,
  Search,
} from "lucide-react";

export interface DiscoverShop {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  opening_time: string | null;
  closing_time: string | null;
}

interface ShopWithDistance extends DiscoverShop {
  distanceKm: number | null;
}

type LocState = "loading" | "granted" | "denied" | "unavailable";

const NEARBY_KM = 6;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

function isOpen(opening: string | null, closing: string | null): boolean | null {
  if (!opening || !closing) return null;
  const now = new Date();
  const [oh, om] = opening.split(":").map(Number);
  const [ch, cm] = closing.split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const open = oh * 60 + om;
  const close = ch * 60 + cm;
  return cur >= open && cur <= close;
}

function ShopCard({ shop }: { shop: ShopWithDistance }) {
  const status = isOpen(shop.opening_time, shop.closing_time);

  return (
    <Link
      href={`/s/${shop.slug}`}
      className="group flex flex-col rounded-[1.75rem] border border-[#2E3344]/8 bg-white p-5 shadow-sm hover:shadow-md hover:border-[#A7653A]/20 transition-all duration-200"
    >
      <div className="flex items-start gap-3 mb-3">
        {/* Logo */}
        <div className="h-14 w-14 rounded-2xl bg-[#F7F0E6] overflow-hidden shrink-0 flex items-center justify-center border border-[#2E3344]/5">
          {shop.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.image_url}
              alt={shop.name}
              className="h-14 w-14 object-cover"
            />
          ) : (
            <span className="text-xl font-black text-[#A7653A]">
              {shop.name[0]}
            </span>
          )}
        </div>

        {/* Name + category */}
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-[#27324A] text-sm leading-tight truncate group-hover:text-[#A7653A] transition-colors">
            {shop.name}
          </h3>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#746E73] mt-0.5">
            {shop.category ?? "Shop"}
          </p>
          {status !== null && (
            <span
              className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold ${
                status ? "text-green-600" : "text-red-500"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status ? "bg-green-500" : "bg-red-400"
                }`}
              />
              {status ? "Open now" : "Closed"}
            </span>
          )}
        </div>

        {/* Distance badge */}
        {shop.distanceKm !== null && (
          <div className="shrink-0 flex items-center gap-1 rounded-full bg-[#F7F0E6] px-2.5 py-1 text-[10px] font-bold text-[#A7653A]">
            <Navigation className="h-2.5 w-2.5" />
            {fmtDist(shop.distanceKm)}
          </div>
        )}
      </div>

      {/* Description */}
      {shop.description && (
        <p className="text-xs text-[#746E73] font-medium line-clamp-2 mb-2 leading-relaxed">
          {shop.description}
        </p>
      )}

      {/* Address + CTA */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-[#2E3344]/5">
        {shop.address ? (
          <p className="flex items-center gap-1 text-[10px] text-[#746E73] font-medium truncate max-w-[70%]">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            {shop.address}
          </p>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#A7653A] shrink-0">
          Browse <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 mb-4 px-1 ${className}`}>
      <div className="h-7 w-7 rounded-lg bg-[#F7F0E6] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <h2 className="text-sm font-black uppercase tracking-[0.1em] text-[#27324A]">
        {title}
      </h2>
      <span className="ml-auto rounded-full bg-[#27324A]/8 px-2.5 py-0.5 text-xs font-bold text-[#27324A]">
        {count}
      </span>
    </div>
  );
}

interface ShopsTabProps {
  shops: DiscoverShop[];
}

export function ShopsTab({ shops }: ShopsTabProps) {
  const [locState, setLocState] = useState<LocState>("loading");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocState("unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocState("granted");
      },
      () => {
        setLocState("denied");
      },
      { timeout: 8000 }
    );
  }, []);

  // Compute distances
  const shopsWithDist: ShopWithDistance[] = shops.map((s) => {
    if (locState === "granted" && userLat !== null && userLng !== null && s.lat !== null && s.lng !== null) {
      return { ...s, distanceKm: haversineKm(userLat, userLng, s.lat, s.lng) };
    }
    return { ...s, distanceKm: null };
  });

  // Filter by search
  const filtered = search.trim().length >= 1
    ? shopsWithDist.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (s.description ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : shopsWithDist;

  // Split into nearby / far when location is known
  const locKnown = locState === "granted" && userLat !== null;

  let nearbyShops: ShopWithDistance[] = [];
  let farShops: ShopWithDistance[] = [];
  let unknownShops: ShopWithDistance[] = [];

  if (locKnown) {
    filtered.forEach((s) => {
      if (s.distanceKm === null) unknownShops.push(s);
      else if (s.distanceKm <= NEARBY_KM) nearbyShops.push(s);
      else farShops.push(s);
    });
    // Sort nearby by ascending distance
    nearbyShops.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    farShops.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  } else {
    unknownShops = filtered;
  }

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="rounded-[2.5rem] bg-white border border-[#2E3344]/8 p-8 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
          <Store className="h-32 w-32 -rotate-12" />
        </div>
        <h1 className="text-3xl font-bold tracking-[-0.03em] text-[#27324A]">
          Discover Shops
        </h1>
        <p className="mt-2 text-sm font-medium text-[#746E73] max-w-sm">
          Find verified local shops near you. Shops within {NEARBY_KM} km shown first.
        </p>

        {/* Search */}
        <div className="mt-6 relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#746E73]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, category…"
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#f8f8f7] border border-[#2E3344]/8 text-sm font-medium text-[#27324A] placeholder:text-[#746E73]/60 focus:outline-none focus:ring-2 focus:ring-[#A7653A]/30 transition"
          />
        </div>
      </div>

      {/* ── Location Banner ──────────────────────────────────────── */}
      {locState === "loading" && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#2E3344]/10 bg-[#f8f8f7] px-5 py-4">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#A7653A] border-t-transparent shrink-0" />
          <p className="text-sm font-medium text-[#746E73]">Getting your location…</p>
        </div>
      )}

      {locState === "denied" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Location access denied</p>
            <p className="text-xs text-amber-700 mt-0.5 font-medium">
              Enable location permission in your browser to see shops sorted by distance from you. All shops are shown below.
            </p>
          </div>
        </div>
      )}

      {locState === "unavailable" && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#2E3344]/10 bg-[#f8f8f7] px-5 py-4">
          <AlertCircle className="h-5 w-5 text-[#746E73] shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-[#746E73]">
            Location not available on this device. All shops are shown below.
          </p>
        </div>
      )}

      {locState === "granted" && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <Navigation className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm font-bold text-green-800">
            Showing shops sorted by your distance · {NEARBY_KM} km radius is &quot;Nearby&quot;
          </p>
        </div>
      )}

      {/* ── Nearby Section ───────────────────────────────────────── */}
      {locKnown && (
        <section>
          <SectionHeader
            icon={<Navigation className="h-3.5 w-3.5 text-[#A7653A]" />}
            title="Shops Near You"
            count={nearbyShops.length}
          />
          {nearbyShops.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-[#2E3344]/15 bg-white/50 p-12 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-[#F7F0E6] flex items-center justify-center">
                <Store className="h-7 w-7 text-[#A7653A]" />
              </div>
              <p className="text-sm font-bold text-[#27324A]">No shops within {NEARBY_KM} km</p>
              <p className="mt-1 text-xs text-[#746E73]">Check the &quot;Far Away&quot; section below for more options.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nearbyShops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Far Section ──────────────────────────────────────────── */}
      {locKnown && farShops.length > 0 && (
        <section>
          <SectionHeader
            icon={<MapPin className="h-3.5 w-3.5 text-[#746E73]" />}
            title="Far from Your Location"
            count={farShops.length}
          />
          <div className="rounded-2xl border border-[#2E3344]/8 bg-[#f8f8f7]/60 p-4 mb-4">
            <p className="text-xs font-medium text-[#746E73]">
              These shops are more than {NEARBY_KM} km away. Delivery may take longer or may not be available.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {farShops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        </section>
      )}

      {/* ── Shops without coordinates / location not known ───────── */}
      {unknownShops.length > 0 && (
        <section>
          {locKnown && (
            <SectionHeader
              icon={<Clock className="h-3.5 w-3.5 text-[#746E73]" />}
              title="Other Shops"
              count={unknownShops.length}
            />
          )}
          {!locKnown && (
            <SectionHeader
              icon={<Store className="h-3.5 w-3.5 text-[#A7653A]" />}
              title="All Verified Shops"
              count={unknownShops.length}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unknownShops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state (no shops at all) ───────────────────────── */}
      {shops.length === 0 && (
        <div className="rounded-[2rem] border border-dashed border-[#2E3344]/15 bg-white/50 p-16 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-[#F7F0E6] flex items-center justify-center">
            <Store className="h-8 w-8 text-[#A7653A]" />
          </div>
          <p className="text-base font-bold text-[#27324A]">No verified shops yet</p>
          <p className="mt-1 text-sm text-[#746E73]">
            Shops will appear here once they complete verification.
          </p>
        </div>
      )}

      {/* ── No search results ────────────────────────────────────── */}
      {shops.length > 0 && filtered.length === 0 && search.length > 0 && (
        <div className="rounded-[2rem] border border-dashed border-[#2E3344]/15 bg-white/50 p-12 text-center">
          <p className="text-sm font-bold text-[#27324A]">No shops match &quot;{search}&quot;</p>
          <p className="mt-1 text-xs text-[#746E73]">Try a different name or category.</p>
        </div>
      )}
    </div>
  );
}
