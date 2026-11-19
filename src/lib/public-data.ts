import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { integrations } from "@/lib/env";

/** Only ACTIVE areas are ever shown publicly. */
export async function getActiveAreas() {
  if (!integrations.supabase()) return [];
  const { data } = await createAdminClient()
    .from("service_areas")
    .select("id, name, city, province, zone, service_codes")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}

export async function getActiveServices() {
  if (!integrations.supabase()) return [];
  const { data } = await createAdminClient()
    .from("shipping_services")
    .select("code, name, description, same_day, business_only, transit_days")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}
