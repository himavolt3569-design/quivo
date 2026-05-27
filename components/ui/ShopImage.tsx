"use client";

import Image, { type ImageProps } from "next/image";
import { useMemo } from "react";

/**
 * Storage-aware image wrapper.
 *
 * When the source is a Supabase Storage public URL (…/storage/v1/object/public/…)
 * we rewrite it to the `/storage/v1/render/image/public/…` endpoint with
 * width/quality params so the browser fetches a pre-sized variant. This
 * cuts bandwidth dramatically vs serving the full 4 MB original.
 *
 * Any non-Supabase URL falls through to plain `next/image`.
 */

type Props = Omit<ImageProps, "src"> & {
  src: string | null | undefined;
  /** Default 512; clamp to 16..2400. */
  renderWidth?: number;
  /** Default 75. */
  renderQuality?: number;
  /** Tile resize mode; default "cover". */
  resize?: "cover" | "contain" | "fill";
  /** Fallback to render when src is empty. */
  fallback?: React.ReactNode;
};

const RENDER_PATH = "/storage/v1/render/image/public/";
const OBJECT_PATH = "/storage/v1/object/public/";

function transformSupabaseUrl(
  src: string,
  width: number,
  quality: number,
  resize: "cover" | "contain" | "fill"
): string {
  if (!src.includes(OBJECT_PATH)) return src;
  const url = new URL(src);
  url.pathname = url.pathname.replace(OBJECT_PATH, RENDER_PATH);
  url.searchParams.set("width", String(Math.max(16, Math.min(2400, Math.round(width)))));
  url.searchParams.set("quality", String(Math.max(20, Math.min(100, Math.round(quality)))));
  url.searchParams.set("resize", resize);
  return url.toString();
}

export function ShopImage({
  src,
  alt,
  renderWidth = 512,
  renderQuality = 75,
  resize = "cover",
  fallback,
  ...rest
}: Props) {
  const finalSrc = useMemo(() => {
    if (!src) return null;
    try {
      return transformSupabaseUrl(src, renderWidth, renderQuality, resize);
    } catch {
      return src;
    }
  }, [src, renderWidth, renderQuality, resize]);

  if (!finalSrc) return <>{fallback ?? null}</>;

  return <Image src={finalSrc} alt={alt ?? ""} {...rest} />;
}
