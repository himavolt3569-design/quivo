"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Barcode, CheckCircle2, Crosshair, MapPin, ShoppingBag, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Eyebrow } from "@/components/Eyebrow";
import { MapViewDynamic as MapView } from "@/components/MapDynamic";
import {
  barcodeSteps,
  customerDealItems,
  orderFilters,
  nearbyShops,
  popularProducts,
  customerFallbackLocation
} from "@/lib/data";

type LocationPermissionState =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported";

interface ScanToOrderSectionProps {
  basketItems: string[];
  addProductToBasket: (id: string) => void;
  removeProductFromBasket: (id: string) => void;
  scrollToSection: (id: string) => void;
}

export function ScanToOrderSection({
  basketItems,
  addProductToBasket,
  removeProductFromBasket,
  scrollToSection
}: ScanToOrderSectionProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [submittedOrder, setSubmittedOrder] = useState<{
    id: string;
    shop: string;
    total: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] =
    useState<LocationPermissionState>("idle");
  const [customerLocation, setCustomerLocation] = useState(
    customerFallbackLocation
  );
  const [activeOrderFilter, setActiveOrderFilter] = useState("All");
  const [activeShopName, setActiveShopName] = useState(nearbyShops[0].name);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discoveryMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopMarkersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const radiusCircleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerMarkerRef = useRef<any>(null);

  const shopsInsideRadius = nearbyShops.filter(shop => shop.distance <= 6);
  const filteredNearbyShops = shopsInsideRadius.filter(
    shop => activeOrderFilter === "All" || shop.category === activeOrderFilter
  );
  const selectedOrderShop =
    filteredNearbyShops.find(shop => shop.name === activeShopName) ??
    filteredNearbyShops[0] ??
    shopsInsideRadius[0];
  const basketProducts = popularProducts.filter(product =>
    basketItems.includes(product.id)
  );
  const basketTotal = basketProducts.reduce(
    (total, product) => total + product.priceNumber,
    0
  );

  const permissionCopy = {
    idle: "Use location to center the 6km radius around the customer.",
    requesting: "Requesting browser permission for nearby shop discovery...",
    granted:
      "Location is ready. Shops are filtered inside the 6km customer radius.",
    denied:
      "Location was blocked. Customers can still browse with a saved neighborhood fallback.",
    unsupported:
      "This device does not support geolocation. Quivo keeps fallback browsing available.",
  }[locationPermission];

  function requestCustomerLocation() {
    if (!("geolocation" in navigator)) {
      setLocationPermission("unsupported");
      return;
    }

    setLocationPermission("requesting");
    navigator.geolocation.getCurrentPosition(
      position => {
        setCustomerLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationPermission("granted");
      },
      () => setLocationPermission("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 }
    );
  }

  function submitCustomerOrder() {
    if (!basketProducts.length) {
      toast.error("Add at least one barcode item before sending the order.");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Please add customer name and phone for the shop.");
      return;
    }

    const orderId = `QUIVO-${Math.floor(1000 + Math.random() * 9000)}`;
    const savedOrder = {
      id: orderId,
      shop: selectedOrderShop.name,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryNote: deliveryNote.trim(),
      items: basketProducts.map(product => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.priceNumber,
      })),
      total: basketTotal,
      createdAt: new Date().toISOString(),
    };
    const previousOrders = JSON.parse(
      window.localStorage.getItem("quivo-submitted-orders") ?? "[]"
    ) as (typeof savedOrder)[];
    window.localStorage.setItem(
      "quivo-submitted-orders",
      JSON.stringify([savedOrder, ...previousOrders].slice(0, 20))
    );
    setSubmittedOrder({
      id: orderId,
      shop: selectedOrderShop.name,
      total: basketTotal,
    });
    toast.success("Order request sent", {
      description: `${orderId} saved and sent to ${selectedOrderShop.name}`,
    });
  }

  useEffect(() => {
    const map = discoveryMapRef.current;
    if (!map) return;

    import("leaflet").then(Leaflet => {
      if (!map.getContainer()) return;

      shopMarkersRef.current.forEach((marker: any) => marker.remove());
      shopMarkersRef.current = [];

      if (radiusCircleRef.current) radiusCircleRef.current.remove();
      if (customerMarkerRef.current) customerMarkerRef.current.remove();

      map.setView(
        [customerLocation.lat, customerLocation.lng],
        map.getZoom() || 13
      );

      radiusCircleRef.current = Leaflet.circle(
        [customerLocation.lat, customerLocation.lng],
        {
          radius: 6000,
          color: "#A7653A",
          opacity: 0.9,
          weight: 2,
          fillColor: "#A7653A",
          fillOpacity: 0.08,
        }
      ).addTo(map);

      customerMarkerRef.current = Leaflet.marker(
        [customerLocation.lat, customerLocation.lng],
        {
          title:
            locationPermission === "granted"
              ? "Customer location"
              : "Fallback customer area",
        }
      ).addTo(map);

      const boundsPoints: [number, number][] = [
        [customerLocation.lat, customerLocation.lng],
      ];
      filteredNearbyShops.forEach(shop => {
        const marker = Leaflet.marker([shop.position.lat, shop.position.lng], {
          title: `${shop.name} \u00b7 ${shop.distance}km`,
        }).addTo(map);
        marker.on("click", () => setActiveShopName(shop.name));
        shopMarkersRef.current.push(marker);
        boundsPoints.push([shop.position.lat, shop.position.lng]);
      });

      map.fitBounds(Leaflet.latLngBounds(boundsPoints), { padding: [72, 72] });
    });
  }, [customerLocation, filteredNearbyShops, locationPermission]);

  return (
    <section
      id="orders"
      className="reveal-section relative overflow-hidden bg-[#F7F0E6] py-14 sm:py-20 lg:py-24"
    >
      <div
        className="absolute -right-24 top-20 h-72 w-72 rounded-full bg-[#A7653A]/12 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute left-[-6rem] bottom-10 h-72 w-72 rounded-full bg-[#626A54]/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="container relative">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <div className="reveal-item">
            <Eyebrow icon={Barcode}>Scan-to-order experience</Eyebrow>
            <h2 className="mt-5 text-[clamp(2.35rem,4.7vw,4.8rem)] font-bold leading-[1.03] tracking-[-0.04em] text-[#27324A]">
              Barcode is the shortcut from shelf to nearby shop.
            </h2>
          </div>
          <div className="reveal-item max-w-3xl">
            <p className="text-lg leading-8 text-[#5F5A61]">
              Customers scan the product they already know, Quivo checks
              quick inventory around them, and the basket goes straight to
              the selected shop.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {barcodeSteps.map(step => {
                const StepIcon = step.icon;
                return (
                  <div
                    key={step.label}
                    className="magnetic-card rounded-2xl bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8E3D1] text-[#626A54]">
                        <StepIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-bold text-[#27324A]">
                          {step.label}
                        </p>
                        <p className="text-xs font-medium text-[#746E73]">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:mt-12 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="reveal-item space-y-5">
            <div className="overflow-hidden rounded-[2.25rem] border border-[#2E3344]/8 bg-white shadow-2xl shadow-[#27324A]/12">
              <div className="bg-[#27324A] p-4 text-white sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D8C99A]">
                      Barcode basket builder
                    </p>
                    <h3 className="mt-2 text-3xl font-bold tracking-[-0.03em]">
                      Scan, match, add.
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={requestCustomerLocation}
                    disabled={locationPermission === "requesting"}
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#27324A] transition hover:-translate-y-0.5 hover:bg-[#F3E1CB] disabled:cursor-wait disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-4 focus:ring-offset-[#27324A]"
                  >
                    <Crosshair
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                    />
                    {locationPermission === "granted"
                      ? "Location ready"
                      : locationPermission === "requesting"
                        ? "Checking..."
                        : "Find shops near me"}
                  </button>
                </div>

                <div
                  className={`mt-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${
                    locationPermission === "denied" ||
                    locationPermission === "unsupported"
                      ? "bg-[#F3E1CB] text-[#27324A]"
                      : "bg-white/10 text-white/76"
                  }`}
                >
                  {locationPermission === "granted" ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#D8C99A]"
                      aria-hidden="true"
                    />
                  ) : locationPermission === "denied" ||
                    locationPermission === "unsupported" ? (
                    <XCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#8D5132]"
                      aria-hidden="true"
                    />
                  ) : (
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>{permissionCopy}</span>
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-5">
                {customerDealItems.map(deal => (
                  <article
                    key={deal.name}
                    className="product-card magnetic-card overflow-hidden rounded-[1.35rem] bg-[#F7F0E6] shadow-inner shadow-[#27324A]/5"
                  >
                    <img
                      src={deal.image}
                      alt={`${deal.name} product`}
                      className="h-24 w-full object-cover sm:h-28"
                    />
                    <div className="p-4">
                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] ${deal.accent}`}
                      >
                        {deal.tag}
                      </div>
                      <h4 className="mt-3 text-base font-bold tracking-[-0.02em] text-[#27324A]">
                        {deal.name}
                      </h4>
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#746E73]">
                        <Barcode className="h-3.5 w-3.5" /> {deal.barcode}
                      </p>
                      <button
                        type="button"
                        onClick={() => addProductToBasket(deal.id)}
                        className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-[#27324A] shadow-sm transition hover:bg-[#27324A] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2"
                      >
                        Add to basket
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <form
              className="rounded-[1.5rem] border border-[#2E3344]/8 bg-white p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5"
              onSubmit={event => {
                event.preventDefault();
                submitCustomerOrder();
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
                    Checkout preview
                  </p>
                  <h4 className="mt-2 text-xl font-bold leading-tight text-[#27324A] sm:text-2xl">
                    {basketProducts.length} barcode items · Rs.{" "}
                    {basketTotal.toLocaleString()}
                  </h4>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#E8E3D1] text-[#626A54]">
                  <ShoppingBag className="h-6 w-6" aria-hidden="true" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {basketProducts.length ? (
                  basketProducts.map(item => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-2xl bg-[#F7F0E6] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <span className="font-semibold text-[#27324A]">
                          {item.name}
                        </span>
                        <p className="mt-1 text-xs font-medium text-[#746E73]">
                          {item.barcode} · {item.shop}
                        </p>
                      </div>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-semibold text-[#A7653A]">
                          {item.price}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeProductFromBasket(item.id)}
                          className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#8D5132] transition hover:bg-[#F3E1CB] focus:outline-none focus:ring-2 focus:ring-[#A7653A]"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-[#F7F0E6] px-4 py-5 text-sm font-semibold text-[#746E73]">
                    Scan or add a popular product to begin the basket.
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-[#27324A]">
                  Customer name
                  <input
                    value={customerName}
                    onChange={event => setCustomerName(event.target.value)}
                    placeholder="e.g. Anita Tamang"
                    className="min-h-12 rounded-2xl border border-[#2E3344]/10 bg-[#FFFBF4] px-4 text-sm outline-none transition focus:border-[#A7653A] focus:ring-2 focus:ring-[#A7653A]/20"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[#27324A]">
                  Phone number
                  <input
                    value={customerPhone}
                    onChange={event => setCustomerPhone(event.target.value)}
                    placeholder="98XXXXXXXX"
                    className="min-h-12 rounded-2xl border border-[#2E3344]/10 bg-[#FFFBF4] px-4 text-sm outline-none transition focus:border-[#A7653A] focus:ring-2 focus:ring-[#A7653A]/20"
                  />
                </label>
              </div>
              <label className="mt-3 grid gap-2 text-sm font-semibold text-[#27324A]">
                Delivery note
                <textarea
                  value={deliveryNote}
                  onChange={event => setDeliveryNote(event.target.value)}
                  placeholder="Gate color, substitution preference, pickup time..."
                  rows={3}
                  className="rounded-2xl border border-[#2E3344]/10 bg-[#FFFBF4] px-4 py-3 text-sm outline-none transition focus:border-[#A7653A] focus:ring-2 focus:ring-[#A7653A]/20"
                />
              </label>
              <button
                type="submit"
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#A7653A] px-5 text-sm font-semibold text-white shadow-lg shadow-[#A7653A]/18 transition hover:-translate-y-0.5 hover:bg-[#8E5432] focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-4"
              >
                Send order to {selectedOrderShop.name}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </button>

              {submittedOrder ? (
                <div className="mt-4 rounded-2xl border border-[#626A54]/20 bg-[#E8E3D1] px-4 py-3 text-sm font-semibold text-[#27324A]">
                  Order {submittedOrder.id} sent to {submittedOrder.shop}.
                  Estimated total: Rs.{" "}
                  {submittedOrder.total.toLocaleString()}.
                </div>
              ) : null}
            </form>
          </div>

          <div className="reveal-item min-w-0 rounded-[1.5rem] border border-[#2E3344]/8 bg-[#FFFBF4] p-3 shadow-2xl shadow-[#27324A]/12 sm:rounded-[2.25rem] sm:p-6">
            <div className="flex flex-col gap-4 rounded-[1.75rem] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
                  Stores with matching barcode stock
                </p>
                <h3 className="mt-1 text-2xl font-bold tracking-[-0.025em] text-[#27324A]">
                  Choose a shop inside 6km
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {orderFilters.map(filter => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveOrderFilter(filter)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-2 ${
                      activeOrderFilter === filter
                        ? "bg-[#A7653A] text-white"
                        : "bg-[#F7F0E6] text-[#746E73] hover:bg-[#F3E1CB]"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[#2E3344]/8 bg-white shadow-sm">
              <div className="relative">
                <MapView
                  initialCenter={customerFallbackLocation}
                  initialZoom={13}
                  className="h-[240px] w-full sm:h-[300px] lg:h-[340px]"
                  onMapReady={map => {
                    discoveryMapRef.current = map;
                  }}
                />
                <div className="absolute left-3 top-3 rounded-2xl bg-white/92 px-3 py-2 shadow-lg shadow-[#27324A]/12 backdrop-blur sm:left-4 sm:top-4 sm:px-4 sm:py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
                    Discovery radius
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#27324A]">
                    6km around customer
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredNearbyShops.map(shop => (
                <button
                  key={shop.name}
                  type="button"
                  onClick={() => setActiveShopName(shop.name)}
                  className={`overflow-hidden rounded-[1.35rem] border text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#A7653A] focus:ring-offset-3 ${
                    selectedOrderShop.name === shop.name
                      ? "border-[#A7653A]/45 bg-[#FFF6EA]"
                      : "border-[#2E3344]/8 bg-white"
                  }`}
                >
                  <img
                    src={shop.image}
                    alt={`${shop.name} storefront`}
                    className="h-28 w-full object-cover sm:h-24"
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-[#8D5132]">
                          {shop.category}
                        </p>
                        <h4 className="mt-1 truncate text-base font-bold tracking-[-0.015em] text-[#27324A]">
                          {shop.name}
                        </h4>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#E8E3D1] px-2.5 py-1 text-[0.68rem] font-semibold text-[#626A54]">
                        {shop.distance} km
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-5 text-[#746E73]">
                      {shop.note}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] font-semibold text-[#746E73]">
                      <span className="rounded-full bg-[#F7F0E6] px-3 py-1">
                        {shop.eta}
                      </span>
                      <span className="rounded-full bg-[#F3E1CB] px-3 py-1 text-[#8D5132]">
                        {shop.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <aside className="mt-4 rounded-[1.35rem] border border-[#2E3344]/8 bg-[#27324A] p-4 text-white shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#D8C99A]">
                    Selected barcode-ready shop
                  </p>
                  <h4 className="mt-2 text-xl font-bold tracking-[-0.025em] sm:text-2xl">
                    {selectedOrderShop.name}
                  </h4>
                  <p className="mt-2 text-sm text-white/65">
                    {selectedOrderShop.distance} km away ·{" "}
                    {selectedOrderShop.eta} · {selectedOrderShop.queue}{" "}
                    orders in queue
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    addProductToBasket(
                      popularProducts.find(
                        product => product.shop === selectedOrderShop.name
                      )?.id ?? popularProducts[0].id
                    )
                  }
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#27324A] transition hover:-translate-y-0.5 hover:bg-[#F3E1CB] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-4 focus:ring-offset-[#27324A] sm:w-auto"
                >
                  Add shop match
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
