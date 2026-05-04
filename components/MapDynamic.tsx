"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "@/components/Map";

const MapView = dynamic(() => import("@/components/Map").then(m => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex w-full items-center justify-center bg-gray-100 text-sm text-gray-400 h-[500px]">
      Loading map…
    </div>
  ),
});

export function MapViewDynamic(props: MapViewProps) {
  return <MapView {...props} />;
}
