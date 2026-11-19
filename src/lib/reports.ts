import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

export async function dailySeries(days: number) {
  const to = new Date();
  const from = new Date(Date.now() - (days - 1) * 864e5);
  const { data } = await createAdminClient().rpc("report_daily", { p_from: from.toISOString().slice(0, 10), p_to: to.toISOString().slice(0, 10) });
  return (data ?? []) as { day: string; shipments: number; delivered: number; revenue_cents: number }[];
}

export function groupBy<T>(rows: T[], key: (r: T) => string, val: (r: T) => number) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + val(r)));
  return [...m.entries()].map(([label, value]) => ({ label, value }));
}

/** ISO week label like 2026-W47 */
export function isoWeek(d: string) {
  const dt = new Date(d + "T12:00:00Z");
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const wk = 1 + Math.round(((dt.getTime() - first.getTime()) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${dt.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}
