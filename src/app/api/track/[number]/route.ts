import { NextResponse } from "next/server";
import { getPublicTracking } from "@/lib/tracking-server";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(_: Request, ctx: { params: Promise<{ number: string }> }) {
  if (!(await rateLimit("track", 60, 60_000)).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const { number } = await ctx.params;
  const t = await getPublicTracking(number);
  if (!t) return NextResponse.json({ error: "Tracking number not found" }, { status: 404 });
  return NextResponse.json(t, { headers: { "Cache-Control": "no-store" } });
}
