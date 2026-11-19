import { Card, StatusBadge, Badge } from "@/components/ui";
import { Timeline } from "@/components/tracking/Timeline";
import { Breakdown } from "@/components/booking/BookingWizard";
import { createAdminClient } from "@/lib/supabase/server";
import type { ShipmentStatus } from "@/lib/status";

/** Loads a shipment with children. Caller MUST have already authorized access. */
export async function loadShipment(id: string) {
  const admin = createAdminClient();
  const [{ data: s }, { data: pkgs }, { data: events }, { data: payments }, { data: assignment }, { data: schedule }] = await Promise.all([
    admin.from("shipments").select("*, shipping_services(name), businesses(name)").eq("id", id).maybeSingle(),
    admin.from("shipment_packages").select("*").eq("shipment_id", id),
    admin.from("shipment_events").select("*").eq("shipment_id", id).order("created_at"),
    admin.from("payments").select("*").eq("shipment_id", id).order("created_at", { ascending: false }),
    admin.from("shipment_assignments").select("id, driver_id, assignment_type, route_id, drivers(id, profiles(full_name, phone))").eq("shipment_id", id).eq("is_active", true),
    admin.from("pickup_schedules").select("*").eq("shipment_id", id).maybeSingle(),
  ]);
  return { s, pkgs: pkgs ?? [], events: events ?? [], payments: payments ?? [], assignment: assignment ?? [], schedule };
}

export async function signedPodUrls(events: { pod_photo_path: string | null; pod_signature_path: string | null }[]) {
  const admin = createAdminClient();
  const out: { photo?: string; signature?: string } = {};
  for (const e of events) {
    if (e.pod_photo_path) out.photo = (await admin.storage.from("proof-of-delivery").createSignedUrl(e.pod_photo_path, 600)).data?.signedUrl;
    if (e.pod_signature_path) out.signature = (await admin.storage.from("proof-of-delivery").createSignedUrl(e.pod_signature_path, 600)).data?.signedUrl;
  }
  return out;
}

type Loaded = Awaited<ReturnType<typeof loadShipment>>;

export async function ShipmentDetail({ data, staff = false, actions }: { data: Loaded; staff?: boolean; actions?: React.ReactNode }) {
  const { s, pkgs, events, payments, assignment, schedule } = data;
  if (!s) return null;
  const pod = await signedPodUrls(events.filter((e) => e.status === "delivered"));
  const paid = payments.find((p) => p.status === "paid" || p.status === "refunded" || p.status === "partially_refunded");
  const labelsOk = ["paid", "invoiced"].includes(s.payment_status) && s.status !== "cancelled";
  const driverName = assignment.map((a) => (a.drivers as unknown as { profiles: { full_name: string } } | null)?.profiles?.full_name).filter(Boolean).join(", ");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xl font-bold">{s.tracking_number}</p>
              <p className="text-sm text-muted">Ref {s.reference} · {s.shipping_services?.name} · booked {new Date(s.created_at).toLocaleString("en-CA")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={s.status as ShipmentStatus} />
              <Badge tone={s.payment_status === "paid" || s.payment_status === "invoiced" ? "success" : s.payment_status === "failed" ? "danger" : "warning"}>{s.payment_status}</Badge>
            </div>
          </div>
          <div className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-1">Pickup</p>
              <p className="font-semibold">{s.sender_name}</p>
              <p>{s.pickup_unit && `${s.pickup_unit}-`}{s.pickup_street}<br />{s.pickup_city} {s.pickup_province} {s.pickup_postal}</p>
              <p className="text-muted">{s.sender_phone} · {s.sender_email}</p>
              <p className="mt-1">Requested: {s.pickup_date} · {s.pickup_window}</p>
              {schedule && <p className="text-success">Scheduled: {schedule.scheduled_date} {schedule.window_start.slice(0, 5)}–{schedule.window_end.slice(0, 5)}</p>}
              {s.pickup_instructions && <p className="mt-1 text-muted">“{s.pickup_instructions}”</p>}
            </div>
            <div>
              <p className="eyebrow mb-1">Delivery</p>
              <p className="font-semibold">{s.recipient_name}</p>
              <p>{s.delivery_unit && `${s.delivery_unit}-`}{s.delivery_street}<br />{s.delivery_city} {s.delivery_province} {s.delivery_postal}</p>
              <p className="text-muted">{s.recipient_phone}{s.recipient_email && ` · ${s.recipient_email}`}</p>
              {s.estimated_delivery_date && <p className="mt-1">Est. delivery: {s.estimated_delivery_date}</p>}
              {s.delivery_instructions && <p className="mt-1 text-muted">“{s.delivery_instructions}”</p>}
            </div>
          </div>
          {(driverName || s.businesses?.name) && (
            <p className="mt-4 text-sm">{s.businesses?.name && <>Business: <strong>{s.businesses.name}</strong>. </>}{driverName && <>Driver: <strong>{driverName}</strong></>}</p>
          )}
          {labelsOk && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-beige pt-4 text-sm">
              <a href={`/api/labels/${s.id}`} target="_blank" className="rounded-md border border-charcoal/20 px-3 py-1.5 font-semibold hover:border-charcoal">Label 4×6</a>
              <a href={`/api/labels/${s.id}?format=letter`} target="_blank" className="rounded-md border border-charcoal/20 px-3 py-1.5 font-semibold hover:border-charcoal">Label letter</a>
              {paid && <a href={`/api/receipts/${paid.id}`} target="_blank" className="rounded-md border border-charcoal/20 px-3 py-1.5 font-semibold hover:border-charcoal">Receipt</a>}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-bold">Packages</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Type</th><th>Contents</th><th>Qty</th><th>Weight</th><th>Dimensions</th><th>Handling</th></tr></thead>
              <tbody>
                {pkgs.map((p) => (
                  <tr key={p.id}><td>{p.package_type}</td><td>{p.description}</td><td>{p.quantity}</td><td>{p.weight_kg} kg</td><td className="whitespace-nowrap">{p.length_cm}×{p.width_cm}×{p.height_cm} cm</td><td>{p.special_handling.join(", ").replace(/_/g, " ") || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-5 font-bold">Shipment history</h2>
          <Timeline
            showActor={staff}
            events={events.filter((e) => staff || e.is_public).map((e) => ({ status: e.status, at: e.created_at, location: e.location, notes: e.notes, actor: e.actor_label, internal: staff ? e.internal_notes : null, signed_by: e.pod_recipient_name }))}
          />
          {(pod.photo || pod.signature) && (
            <div className="mt-6 border-t border-beige pt-4">
              <p className="eyebrow mb-3">Proof of delivery</p>
              <div className="flex flex-wrap gap-4">
                {pod.photo && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={pod.photo} alt="Delivery photo" className="h-40 rounded-lg border border-beige object-cover" />)}
                {pod.signature && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={pod.signature} alt="Recipient signature" className="h-40 rounded-lg border border-beige bg-white object-contain p-2" />)}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        {actions}
        <Card className="p-6">
          <h2 className="mb-4 font-bold">Price</h2>
          <Breakdown p={s.price_breakdown} />
          <p className="mt-3 text-xs text-muted">Distance {s.distance_km} km ({s.distance_source}) · billable weight {s.billable_weight_kg} kg</p>
        </Card>
        {staff && s.internal_notes && <Card className="p-6"><h2 className="mb-2 font-bold">Internal notes</h2><p className="whitespace-pre-wrap text-sm">{s.internal_notes}</p></Card>}
      </div>
    </div>
  );
}
