"use client";
import { useEffect, useRef, useState } from "react";

export interface MapPoint { id: string; lat: number; lng: number; kind: "pickup" | "delivery"; label: string; href: string }

declare global {
  interface Window { google?: any; __efdMapsLoading?: Promise<void> } // eslint-disable-line @typescript-eslint/no-explicit-any
}

function loadMaps(key: string) {
  if (window.google?.maps) return Promise.resolve();
  window.__efdMapsLoading ??= new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    s.async = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Google Maps failed to load"));
    document.head.appendChild(s);
  });
  return window.__efdMapsLoading;
}

/** Plots pickup (gold) and delivery (charcoal) points. Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (browser key, HTTP-referrer restricted). */
export function OpsMap({ points, height = 480 }: { points: MapPoint[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!key || !ref.current || !points.length) return;
    loadMaps(key)
      .then(() => {
        const g = window.google;
        const map = new g.maps.Map(ref.current, { mapTypeControl: false, streetViewControl: false });
        const bounds = new g.maps.LatLngBounds();
        points.forEach((p) => {
          const m = new g.maps.Marker({
            map,
            position: { lat: p.lat, lng: p.lng },
            title: p.label,
            icon: { path: g.maps.SymbolPath.CIRCLE, scale: 8, fillColor: p.kind === "pickup" ? "#B89555" : "#252525", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
          });
          m.addListener("click", () => (window.location.href = p.href));
          bounds.extend(m.getPosition());
        });
        map.fitBounds(bounds);
        if (points.length === 1) map.setZoom(13);
      })
      .catch((e) => setErr(e.message));
  }, [key, points]);

  if (!key) return <div className="rounded-xl border border-dashed border-beige bg-white p-6 text-sm text-muted">Map view needs <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>. Locations are listed below in the meantime.</div>;
  if (!points.length) return <div className="rounded-xl border border-dashed border-beige bg-white p-6 text-sm text-muted">No locations to show.</div>;
  return (
    <div>
      {err && <p className="mb-2 text-sm text-danger">{err}</p>}
      <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-xl border border-beige" />
      <p className="mt-2 flex gap-4 text-xs text-muted"><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-gold" />Pickup</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-charcoal" />Delivery</span></p>
    </div>
  );
}
