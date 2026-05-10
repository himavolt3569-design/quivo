"use client";

import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Address } from "@/lib/types";
import { LABEL_COLOR } from "./address-constants";

function makePinIcon(color: string) {
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <ellipse cx="14" cy="34" rx="6" ry="2" fill="rgba(0,0,0,0.18)"/>
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9 14 22 14 22S28 23 28 14C28 6.27 21.73 0 14 0z" fill="${color}"/>
      <circle cx="14" cy="14" r="6" fill="white"/>
      <circle cx="14" cy="14" r="3.5" fill="${color}"/>
    </svg>`,
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  });
}

export function AddressOverviewMap({ addresses }: { addresses: Address[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const pinned = addresses.filter((a) => a.lat != null && a.lng != null);
    if (pinned.length === 0) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    pinned.forEach((addr) => {
      const color = LABEL_COLOR[addr.label] ?? LABEL_COLOR.Other;
      L.marker([addr.lat!, addr.lng!], { icon: makePinIcon(color) })
        .bindPopup(
          `<div style="font-size:12px;font-weight:700;color:${color};margin-bottom:2px">${addr.label}</div>` +
            `<div style="font-size:11px;color:#27324A;line-height:1.5">${addr.address_line}${addr.landmark ? `<br/>${addr.landmark}` : ""}</div>`
        )
        .addTo(map);
    });

    if (pinned.length === 1) {
      map.setView([pinned[0].lat!, pinned[0].lng!], 15);
    } else {
      map.fitBounds(
        pinned.map((a) => [a.lat!, a.lng!] as [number, number]),
        { padding: [40, 40] }
      );
    }

    setTimeout(() => map.invalidateSize(), 150);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ height: "200px", width: "100%" }} />;
}
