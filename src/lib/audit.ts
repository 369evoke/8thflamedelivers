import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { clientIp } from "@/lib/rate-limit";
import type { SessionUser } from "@/lib/auth";

export async function audit(
  actor: SessionUser | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  try {
    await createAdminClient().from("audit_logs").insert({
      actor_profile_id: actor?.id ?? null,
      actor_role: actor?.role ?? "system",
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: await clientIp().catch(() => null),
    });
  } catch (e) {
    console.error("[audit] failed", e);
  }
}
