import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { connection } from "next/server";
import { createAdminClient, createUserClient } from "@/lib/supabase/server";
import { hasPermission, isStaff, type Permission, type Role } from "@/lib/permissions";
import { integrations } from "@/lib/env";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: Role;
  driverId: string | null;
  businesses: { id: string; name: string; member_role: string; status: string }[];
}

export class AuthError extends Error {
  constructor(message: string, public status = 403) {
    super(message);
  }
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  await connection(); // always per-request: never prerender session-dependent output
  if (!integrations.supabase()) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, { data: driver }, { data: members }] = await Promise.all([
    admin.from("profiles").select("full_name, phone, role, is_active, email").eq("id", data.user.id).single(),
    admin.from("drivers").select("id, status").eq("profile_id", data.user.id).maybeSingle(),
    admin.from("business_members").select("member_role, businesses(id, name, status)").eq("profile_id", data.user.id),
  ]);
  if (!profile || !profile.is_active) return null;

  return {
    id: data.user.id,
    email: profile.email ?? data.user.email ?? "",
    fullName: profile.full_name,
    phone: profile.phone,
    role: profile.role as Role,
    driverId: driver && driver.status === "approved" ? driver.id : null,
    businesses: (members ?? []).flatMap((m) => {
      const b = m.businesses as unknown as { id: string; name: string; status: string } | null;
      return b ? [{ id: b.id, name: b.name, status: b.status, member_role: m.member_role }] : [];
    }),
  };
});

/** For pages: redirect when not signed in / not allowed. */
export async function requireUser(next = "/account") {
  const u = await getSessionUser();
  if (!u) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return u;
}

export async function requireStaffPage(perm?: Permission) {
  const u = await requireUser("/admin");
  if (!isStaff(u.role) || (perm && !hasPermission(u.role, perm))) redirect("/account?denied=1");
  return u;
}

export async function requireDriverPage() {
  const u = await requireUser("/driver");
  if (!u.driverId) redirect("/account?denied=driver");
  return u;
}

export async function requireBusinessPage(businessId?: string) {
  const u = await requireUser("/business/portal");
  const approved = u.businesses.filter((b) => b.status === "approved");
  const biz = businessId ? approved.find((b) => b.id === businessId) : approved[0];
  if (!biz) redirect("/business/apply");
  return { user: u, business: biz };
}

/** For server actions / route handlers: throw instead of redirect. */
export async function assertPermission(perm: Permission) {
  const u = await getSessionUser();
  if (!u) throw new AuthError("Please sign in.", 401);
  if (!hasPermission(u.role, perm)) throw new AuthError("You do not have permission to do that.");
  return u;
}

export async function assertDriver() {
  const u = await getSessionUser();
  if (!u?.driverId) throw new AuthError("Driver access only.");
  return u as SessionUser & { driverId: string };
}

/** Can this user see this shipment? Mirrors public.can_view_shipment() in SQL. */
export async function canAccessShipment(user: SessionUser | null, shipmentId: string, guestToken?: string | null) {
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("shipments")
    .select("id, customer_profile_id, business_id, guest_access_token")
    .eq("id", shipmentId)
    .maybeSingle();
  if (!s) return false;
  if (guestToken && s.guest_access_token && (await import("@/lib/tokens")).verifyToken(guestToken, s.guest_access_token)) return true;
  if (!user) return false;
  if (isStaff(user.role)) return true;
  if (s.customer_profile_id === user.id) return true;
  if (s.business_id && user.businesses.some((b) => b.id === s.business_id && b.status === "approved")) return true;
  if (user.driverId) {
    const { count } = await admin
      .from("shipment_assignments")
      .select("id", { count: "exact", head: true })
      .eq("shipment_id", shipmentId)
      .eq("driver_id", user.driverId)
      .eq("is_active", true);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}
