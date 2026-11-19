import "server-only";
import { headers } from "next/headers";

/**
 * Fixed-window in-memory limiter. Good for a single instance and local dev.
 * On Vercel (many instances) swap the store for Upstash Redis or Vercel KV — the
 * function signature stays the same. See README › Security.
 */
const buckets = new Map<string, { count: number; reset: number }>();

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function rateLimit(name: string, limit: number, windowMs: number) {
  const key = `${name}:${await clientIp()}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  b.count++;
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count) };
}
