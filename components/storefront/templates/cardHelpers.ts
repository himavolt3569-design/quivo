import type { StoreProduct } from "./types";

export function productHref(slug: string, p: StoreProduct): string | null {
  return p.barcode
    ? `/s/${slug}/product/${encodeURIComponent(p.barcode)}`
    : null;
}

export function stopCardClick(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}
