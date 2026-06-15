"use client";

import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, X } from "lucide-react";

const KATHMANDU = { lat: 27.7108, lng: 85.324 };

// Custom SVG pin — avoids the Leaflet default-icon PNG bundler breakage entirely
const PIN_ICON = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <ellipse cx="18" cy="42" rx="7" ry="2.5" fill="rgba(0,0,0,0.18)"/>
    <path d="M18 0C8.06 0 0 8.06 0 18c0 11.5 18 26 18 26S36 29.5 36 18C36 8.06 27.94 0 18 0z" fill="#A7653A"/>
    <circle cx="18" cy="18" r="8" fill="white"/>
    <circle cx="18" cy="18" r="4.5" fill="#A7653A"/>
  </svg>`,
  className: "",
  iconSize: [36, 44],
  iconAnchor: [18, 44],
  popupAnchor: [0, -46],
});

export interface PinCoords {
  lat: number;
  lng: number;
}

interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface AddressPinPickerProps {
  value: PinCoords | null;
  onChange: (coords: PinCoords) => void;
  onAddressFound?: (address: string, landmark?: string) => void;
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ address: string; landmark?: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      { headers: { "User-Agent": "QuivoApp/1.0" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};

    const road = a.road || a.pedestrian || a.path || a.footway || "";
    const area =
      a.neighbourhood || a.suburb || a.quarter || a.village || a.town || "";
    const city = a.city || a.county || a.state_district || "";

    const addressParts = [road, area, city].filter(Boolean);
    const address =
      addressParts.length > 0
        ? addressParts.join(", ")
        : (data.display_name ?? "").split(",").slice(0, 3).join(",").trim();

    const landmark =
      a.amenity || a.building || a.shop || a.tourism || a.leisure || undefined;

    return { address, landmark };
  } catch {
    return null;
  }
}

async function searchPlaces(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=en&countrycodes=np`,
      { headers: { "User-Agent": "QuivoApp/1.0" } },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export function AddressPinPicker({
  value,
  onChange,
  onAddressFound,
}: AddressPinPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const onAddressFoundRef = useRef(onAddressFound);
  // Skip-sync flag: set when the map itself triggered the change so we
  // don't double-move the marker in the sync effect.
  const internalMoveRef = useRef(false);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    onAddressFoundRef.current = onAddressFound;
  });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // Debounced place search
  useEffect(() => {
    if (query.trim().length < 3) {
      startTransition(() => {
        setResults([]);
        setShowResults(false);
      });
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchPlaces(query);
      setResults(found);
      setShowResults(found.length > 0);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync map marker when value prop changes externally (parent sets coords)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !value) return;
    if (internalMoveRef.current) {
      // This change originated from within the map — skip re-syncing to avoid jitter
      internalMoveRef.current = false;
      return;
    }
    markerRef.current.setLatLng([value.lat, value.lng]);
    mapRef.current.setView([value.lat, value.lng], mapRef.current.getZoom(), {
      animate: true,
    });
  }, [value]);

  // Stable ref-based position handler — safe to use inside Leaflet event closures
  const handleNewPositionRef = useRef(async (lat: number, lng: number) => {
    internalMoveRef.current = true;
    onChangeRef.current({ lat, lng });
    if (!onAddressFoundRef.current) return;
    const result = await reverseGeocode(lat, lng);
    onAddressFoundRef.current(result?.address ?? "", result?.landmark);
  });

  const handleSelectResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const shortName = result.display_name.split(",")[0].trim();
    setQuery(shortName);
    setShowResults(false);
    setResults([]);

    if (mapRef.current && markerRef.current) {
      mapRef.current.setView([lat, lng], 17, { animate: true });
      markerRef.current.setLatLng([lat, lng]);
    }
    handleNewPositionRef.current(lat, lng);
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = value ?? KATHMANDU;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 17,
      zoomControl: true,
      scrollWheelZoom: "center", // Better for small embedded maps
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([center.lat, center.lng], {
      draggable: true,
      icon: PIN_ICON,
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup("Drag or tap map to move pin")
      .openPopup();

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      handleNewPositionRef.current(pos.lat, pos.lng);
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      handleNewPositionRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Delayed invalidateSize handles cases where the container animates in
    // (e.g. step transitions in onboarding) and Leaflet inits before final size.
    const sizeTimer = setTimeout(() => map.invalidateSize(), 150);

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(sizeTimer);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl ring-2 ring-[#A7653A]/25">
      {/* Search bar */}
      <div
        ref={searchWrapRef}
        className="relative rounded-t-xl border-b border-[#A7653A]/15 bg-white"
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          {searching ? (
            <span className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-[#A7653A] border-t-transparent" />
          ) : (
            <Search className="h-4 w-4 flex-shrink-0 text-[#746E73]" />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Search for a place or area…"
            className="flex-1 bg-transparent text-sm text-[#27324A] outline-none placeholder:text-[#746E73]/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setShowResults(false);
              }}
              className="flex-shrink-0 rounded-full p-0.5 text-[#746E73] transition hover:bg-[#F7F0E6]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Results dropdown */}
        {showResults && (
          <ul className="absolute left-0 right-0 top-full z-[1000] max-h-52 overflow-y-auto rounded-b-xl border border-t-0 border-[#A7653A]/20 bg-white shadow-lg">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectResult(r);
                  }}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-[#F7F0E6]"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#A7653A]" />
                  <span className="line-clamp-2 text-xs text-[#27324A]">
                    {r.display_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div className="overflow-hidden rounded-b-xl">
        <div ref={containerRef} style={{ height: "210px", width: "100%" }} />
      </div>
    </div>
  );
}
