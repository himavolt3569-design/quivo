"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Navigation,
  Store,
  PackageCheck,
  PackageX,
  BadgeCheck,
  Loader2,
  LocateFixed,
  ChevronRight,
  ScanBarcode,
} from "lucide-react";
import {
  findShopsByBarcode,
  type BarcodeShopMatch,
} from "@/app/actions/customer";

interface RadiusOption {
  label: string;
  km: number | null;
}

// 6km cap removed — customers pick anything from 1km up to "All Nepal".
const RADIUS_OPTIONS: RadiusOption[] = [
  { label: "1 km", km: 1 },
  { label: "2 km", km: 2 },
  { label: "5 km", km: 5 },
  { label: "10 km", km: 10 },
  { label: "25 km", km: 25 },
  { label: "All Nepal", km: null },
];

const DEFAULT_RADIUS_INDEX = 2; // 5 km

type LocState = "idle" | "loading" | "granted" | "denied" | "unavailable";

function fmtDist(km: number | null): string | null {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

interface Props {
  barcode: string;
  /** Server-rendered first page (no distance) for instant paint. */
  initialMatches?: BarcodeShopMatch[];
  /** Product name for the header, if known. */
  productName?: string | null;
  /** Compact styling for the scanner sheet. */
  compact?: boolean;
}

export function BarcodeShopResults({
  barcode,
  initialMatches,
  productName,
  compact = false,
}: Props) {
  const [matches, setMatches] = useState<BarcodeShopMatch[]>(
    initialMatches ?? [],
  );
  const [loading, setLoading] = useState(!initialMatches);
  const [locState, setLocState] = useState<LocState>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [radiusIndex, setRadiusIndex] = useState(DEFAULT_RADIUS_INDEX);
  const [category, setCategory] = useState<string | null>(null);

  const fetchMatches = useCallback(
    async (
      c: { lat: number; lng: number } | null,
      radiusKm: number | null,
    ) => {
      setLoading(true);
      // Radius only meaningful when we know where the customer is.
      const res = await findShopsByBarcode(
        barcode,
        c?.lat ?? null,
        c?.lng ?? null,
        c ? radiusKm : null,
      );
      setLoading(false);
      if (res.matches) setMatches(res.matches);
    },
    [barcode],
  );

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocState("unavailable");
      return;
    }
    setLocState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setLocState("granted");
        fetchMatches(c, RADIUS_OPTIONS[radiusIndex].km);
      },
      (err) => {
        setLocState(
          err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, [fetchMatches, radiusIndex]);

  // Initial load: paint server data (or fetch unscoped), then ask for location.
  // Deferred to a microtask so we don't call setState synchronously in render.
  useEffect(() => {
    queueMicrotask(() => {
      if (!initialMatches) fetchMatches(null, null);
      requestLocation();
    });
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRadiusChange = (index: number) => {
    setRadiusIndex(index);
    fetchMatches(coords, RADIUS_OPTIONS[index].km);
  };

  // Category chips from the current result set.
  const categories = Array.from(
    new Set(
      matches.map((m) => m.shopCategory).filter((c): c is string => !!c),
    ),
  );
  const visible = category
    ? matches.filter((m) => m.shopCategory === category)
    : matches;

  const radiusLabel = RADIUS_OPTIONS[radiusIndex].label;

  return (
    <div className={compact ? "" : "mx-auto max-w-2xl px-4 py-6 sm:py-10"}>
      {/* Header */}
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#27324A] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#D8C99A]">
          <ScanBarcode className="h-3 w-3" /> Scan → Match → Order
        </span>
        <h1 className="mt-3 text-2xl font-black leading-tight text-[#27324A] sm:text-3xl">
          {productName ? (
            <>Shops carrying {productName}</>
          ) : (
            <>Shops carrying this product</>
          )}
        </h1>
        <p className="mt-1 text-sm font-medium text-[#746E73]">
          Barcode <span className="font-mono font-bold">{barcode}</span> ·{" "}
          {coords
            ? `${visible.length} ${visible.length === 1 ? "shop" : "shops"} within ${radiusLabel}`
            : `${visible.length} ${visible.length === 1 ? "shop" : "shops"} found`}
        </p>
      </div>

      {/* Location bar */}
      {locState !== "granted" && (
        <button
          onClick={requestLocation}
          disabled={locState === "loading"}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-[#A7653A]/20 bg-[#F7F0E6] px-4 py-3 text-left transition hover:border-[#A7653A]/40 disabled:opacity-60"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#A7653A]/10 text-[#A7653A]">
            {locState === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[#27324A]">
              {locState === "loading"
                ? "Finding your location…"
                : locState === "denied"
                  ? "Location blocked — showing all shops"
                  : "Use my location"}
            </span>
            <span className="block text-xs text-[#746E73]">
              {locState === "denied"
                ? "Allow location to sort shops by distance"
                : "Center the search around you and sort by distance"}
            </span>
          </span>
        </button>
      )}

      {/* Radius selector — only useful once we know where the customer is */}
      {locState === "granted" && (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#8D5132]">
            Delivery radius
          </p>
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((opt, i) => (
              <button
                key={opt.label}
                onClick={() => handleRadiusChange(i)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  i === radiusIndex
                    ? "bg-[#A7653A] text-white shadow-sm"
                    : "bg-white text-[#27324A] border border-[#2E3344]/10 hover:border-[#A7653A]/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setCategory(null)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition ${
              category === null
                ? "bg-[#27324A] text-white"
                : "bg-white text-[#27324A] border border-[#2E3344]/10"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition ${
                category === c
                  ? "bg-[#27324A] text-white"
                  : "bg-white text-[#27324A] border border-[#2E3344]/10"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[#746E73]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Checking shop stock…</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-[#2E3344]/8 bg-white py-14 text-center">
          <Store className="mx-auto mb-3 h-10 w-10 text-[#746E73]/30" />
          <p className="font-bold text-[#27324A]">No shops carry this yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-[#746E73]">
            {coords && RADIUS_OPTIONS[radiusIndex].km != null
              ? "Try widening the radius or switch to All Nepal."
              : "No shop currently stocks this barcode in stock."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((m) => {
            const dist = fmtDist(m.distanceKm);
            return (
              <li key={`${m.shopId}-${m.productId}`}>
                <Link
                  href={`/s/${m.shopSlug}/product/${encodeURIComponent(m.barcode)}`}
                  className="group flex items-center gap-3 rounded-3xl border border-[#2E3344]/8 bg-white p-4 shadow-sm transition-all hover:border-[#A7653A]/25 hover:shadow-md"
                >
                  {/* Shop logo */}
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#2E3344]/5 bg-[#F7F0E6]">
                    {m.shopLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.shopLogoUrl}
                        alt={m.shopName}
                        className="h-14 w-14 object-cover"
                      />
                    ) : (
                      <span className="text-xl font-black text-[#A7653A]">
                        {m.shopName[0]}
                      </span>
                    )}
                  </div>

                  {/* Shop + product info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-sm font-black text-[#27324A] group-hover:text-[#A7653A]">
                        {m.shopName}
                      </h3>
                      {m.isVerified && (
                        <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#A7653A]" />
                      )}
                    </div>
                    {m.shopCategory && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#746E73]">
                        {m.shopCategory}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-[#746E73]">
                      {m.stock > 0 ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <PackageCheck className="h-3 w-3" /> In stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500">
                          <PackageX className="h-3 w-3" /> Out of stock
                        </span>
                      )}
                      {dist && (
                        <span className="inline-flex items-center gap-1">
                          <Navigation className="h-3 w-3" /> {dist}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price + CTA */}
                  <div className="shrink-0 text-right">
                    <p className="text-base font-black text-[#27324A]">
                      Rs. {m.price.toLocaleString()}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold text-[#A7653A]">
                      Order <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!compact && matches.some((m) => m.shopAddress) && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#746E73]">
          <MapPin className="h-3 w-3" /> Distances are straight-line estimates
          from your current location.
        </p>
      )}
    </div>
  );
}
