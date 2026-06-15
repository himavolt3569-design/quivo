"use client";

import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

const KATHMANDU = { lat: 27.7108, lng: 85.324 };

interface TrackingMapProps {
  shopName: string;
  shopLat: number | null;
  shopLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function TrackingMap({
  shopName,
  shopLat,
  shopLng,
  deliveryLat,
  deliveryLng,
}: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const shopCoords =
      shopLat && shopLng ? { lat: shopLat, lng: shopLng } : KATHMANDU;
    const custCoords =
      deliveryLat && deliveryLng
        ? { lat: deliveryLat, lng: deliveryLng }
        : KATHMANDU;

    const midLat = lerp(shopCoords.lat, custCoords.lat, 0.5);
    const midLng = lerp(shopCoords.lng, custCoords.lng, 0.5);

    const map = L.map(containerRef.current, {
      center: [midLat, midLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const shopIcon = L.divIcon({
      html: `<div style="background:#27324A;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.25)">🏪</div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([shopCoords.lat, shopCoords.lng], { icon: shopIcon })
      .addTo(map)
      .bindTooltip(shopName, { permanent: false });

    const riderLat = lerp(shopCoords.lat, custCoords.lat, 0.45);
    const riderLng = lerp(shopCoords.lng, custCoords.lng, 0.45);
    const riderIcon = L.divIcon({
      html: `<div style="background:#A7653A;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 12px rgba(167,101,58,0.5);animation:pulse 2s ease-in-out infinite">🛵</div>`,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    L.marker([riderLat, riderLng], { icon: riderIcon })
      .addTo(map)
      .bindTooltip("Your rider", { permanent: false });

    const custIcon = L.divIcon({
      html: `<div style="background:#F7F0E6;border:2px solid #A7653A;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px">📍</div>`,
      className: "",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    L.marker([custCoords.lat, custCoords.lng], { icon: custIcon })
      .addTo(map)
      .bindTooltip("Your location", { permanent: false });

    L.polyline(
      [
        [shopCoords.lat, shopCoords.lng],
        [custCoords.lat, custCoords.lng],
      ],
      { color: "#A7653A", weight: 2.5, dashArray: "6 8", opacity: 0.7 },
    ).addTo(map);

    map.fitBounds(
      [
        [shopCoords.lat, shopCoords.lng],
        [custCoords.lat, custCoords.lng],
      ],
      { padding: [30, 30] },
    );

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ height: "160px", width: "100%" }}
      className="rounded-xl overflow-hidden"
    />
  );
}
