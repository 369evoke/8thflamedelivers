import "server-only";
import { env, integrations } from "@/lib/env";
import { estimateRoadKm } from "@/lib/pricing";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Google Geocoding. Returns null when not configured or not found. */
export async function geocode(address: string): Promise<LatLng | null> {
  if (!integrations.maps()) return null;
  try {
    const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    u.searchParams.set("address", address);
    u.searchParams.set("region", "ca");
    u.searchParams.set("key", env.googleMapsServerKey);
    const r = await fetch(u, { cache: "no-store" });
    const j = await r.json();
    const loc = j.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

/**
 * Driving distance. Uses Google Distance Matrix when GOOGLE_MAPS_SERVER_KEY is set;
 * otherwise an estimate from service-area centroids (clearly flagged as "estimate").
 */
export async function drivingDistanceKm(
  origin: string,
  destination: string,
  fallback: { a: LatLng | null; b: LatLng | null },
): Promise<{ km: number; source: "google" | "estimate" } | null> {
  if (integrations.maps()) {
    try {
      const u = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      u.searchParams.set("origins", origin);
      u.searchParams.set("destinations", destination);
      u.searchParams.set("units", "metric");
      u.searchParams.set("region", "ca");
      u.searchParams.set("key", env.googleMapsServerKey);
      const r = await fetch(u, { cache: "no-store" });
      const j = await r.json();
      const el = j.rows?.[0]?.elements?.[0];
      if (el?.status === "OK") return { km: Math.round(el.distance.value / 10) / 100, source: "google" };
    } catch {
      /* fall through to estimate */
    }
  }
  if (fallback.a && fallback.b) return { km: estimateRoadKm(fallback.a, fallback.b), source: "estimate" };
  return null;
}
