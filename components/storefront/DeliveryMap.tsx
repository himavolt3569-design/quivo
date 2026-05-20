"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  shopLat?: number | null;
  shopLng?: number | null;
  shopName?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: string | null;
  className?: string;
}

/**
 * Order-tracking map. Renders the shop pin, the delivery pin and a dashed
 * line between them. Leaflet is loaded lazily inside useEffect so the module
 * is server-safe even when the parent is a server component.
 */
export function DeliveryMap({
  shopLat,
  shopLng,
  shopName,
  deliveryLat,
  deliveryLng,
  deliveryAddress,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    let cleanup: (() => void) | null = null;

    (async () => {
      const leaflet = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      const L = leaflet;

      const SHOP_ICON = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
          <ellipse cx="16" cy="38" rx="7" ry="2" fill="rgba(0,0,0,0.18)"/>
          <path d="M16 0C7.16 0 0 7.16 0 16c0 10.5 16 24 16 24S32 26.5 32 16C32 7.16 24.84 0 16 0z" fill="#27324A"/>
          <circle cx="16" cy="16" r="7" fill="white"/>
          <text x="16" y="20" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#27324A">S</text>
        </svg>`,
        className: "",
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      });
      const DELIVERY_ICON = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
          <ellipse cx="18" cy="42" rx="7" ry="2.5" fill="rgba(0,0,0,0.18)"/>
          <path d="M18 0C8.06 0 0 8.06 0 18c0 11.5 18 26 18 26S36 29.5 36 18C36 8.06 27.94 0 18 0z" fill="#A7653A"/>
          <circle cx="18" cy="18" r="8" fill="white"/>
          <circle cx="18" cy="18" r="4.5" fill="#A7653A"/>
        </svg>`,
        className: "",
        iconSize: [36, 44],
        iconAnchor: [18, 44],
      });

      const center =
        deliveryLat != null && deliveryLng != null
          ? { lat: deliveryLat, lng: deliveryLng }
          : shopLat != null && shopLng != null
            ? { lat: shopLat, lng: shopLng }
            : { lat: 27.7108, lng: 85.324 };

      map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: deliveryLat != null && deliveryLng != null ? 15 : 13,
        zoomControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        detectRetina: true,
      }).addTo(map);

      if (shopLat != null && shopLng != null) {
        const m = L.marker([shopLat, shopLng], { icon: SHOP_ICON }).addTo(map);
        if (shopName) m.bindPopup(escapeHtml(shopName));
      }
      if (deliveryLat != null && deliveryLng != null) {
        const m = L.marker([deliveryLat, deliveryLng], { icon: DELIVERY_ICON }).addTo(map);
        if (deliveryAddress) m.bindPopup(escapeHtml(deliveryAddress));
      }
      if (shopLat != null && shopLng != null && deliveryLat != null && deliveryLng != null) {
        L.polyline(
          [[shopLat, shopLng], [deliveryLat, deliveryLng]],
          { color: "#A7653A", weight: 3, opacity: 0.7, dashArray: "6 6" }
        ).addTo(map);
        const bounds = L.latLngBounds([
          [shopLat, shopLng],
          [deliveryLat, deliveryLng],
        ]).pad(0.4);
        map.fitBounds(bounds, { animate: false });
      }

      setTimeout(() => map?.invalidateSize(), 200);
      setReady(true);

      cleanup = () => {
        map?.remove();
        map = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [shopLat, shopLng, deliveryLat, deliveryLng, shopName, deliveryAddress]);

  const hasAnyPin =
    (shopLat != null && shopLng != null) || (deliveryLat != null && deliveryLng != null);

  return (
    <div className={`relative ${className ?? "w-full h-[320px]"}`}>
      <div ref={containerRef} className="absolute inset-0 rounded-2xl overflow-hidden" />
      {!ready && hasAnyPin && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse rounded-2xl pointer-events-none" />
      )}
      {!hasAnyPin && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-500 bg-gray-50 rounded-2xl">
          No location pinned for this order.
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
