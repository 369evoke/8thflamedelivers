import { notFound } from "next/navigation";
import { Navigation, Phone } from "lucide-react";
import { Card, StatusBadge } from "@/components/ui";
import { DeliveryForm, StatusUpdater } from "@/components/driver/DriverTools";
import { Timeline } from "@/components/tracking/Timeline";
import { requireDriverPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { mapsLink } from "@/lib/driver-data";
import { DRIVER_SETTABLE, TRANSITIONS, type ShipmentStatus } from "@/lib/status";

export default async function DriverShipment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireDriverPage();
  const admin = createAdminClient();
  const { data: a } = await admin.from("shipment_assignments").select("id").eq("shipment_id", id).eq("driver_id", u.driverId!).eq("is_active", true).maybeSingle();
  if (!a) notFound(); // only the assigned driver may view

  const [{ data: s }, { data: pkgs }, { data: events }] = await Promise.all([
    admin.from("shipments").select("*").eq("id", id).single(),
    admin.from("shipment_packages").select("*").eq("shipment_id", id),
    admin.from("shipment_events").select("status, created_at, location, notes").eq("shipment_id", id).order("created_at"),
  ]);
  const status = s.status as ShipmentStatus;
  const options = TRANSITIONS[status].filter((t) => DRIVER_SETTABLE.includes(t) && t !== "delivered");
  const canDeliver = TRANSITIONS[status].includes("delivered");
  const pickupAddr = `${s.pickup_street}, ${s.pickup_city}, ${s.pickup_province} ${s.pickup_postal}`;
  const dropAddr = `${s.delivery_street}, ${s.delivery_city}, ${s.delivery_province} ${s.delivery_postal}`;
  const sigReq = (pkgs ?? []).some((p) => p.special_handling.includes("signature_required"));

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between"><p className="font-mono text-lg font-bold">{s.tracking_number}</p><StatusBadge status={status} /></div>
      <Card>
        <p className="eyebrow">Pickup</p>
        <p className="mt-1 font-semibold">{s.sender_name}</p>
        <p className="text-sm">{s.pickup_unit && `${s.pickup_unit}-`}{pickupAddr}</p>
        <p className="text-xs text-muted">{s.pickup_date} · {s.pickup_window}</p>
        {s.pickup_instructions && <p className="mt-1 rounded bg-beige/50 px-2 py-1 text-sm">{s.pickup_instructions}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={mapsLink(pickupAddr)} target="_blank" className="flex items-center justify-center gap-2 rounded-lg bg-charcoal py-2.5 text-sm font-semibold text-ivory"><Navigation size={16} /> Navigate</a>
          <a href={`tel:${s.sender_phone}`} className="flex items-center justify-center gap-2 rounded-lg border border-beige py-2.5 text-sm font-semibold"><Phone size={16} /> Call</a>
        </div>
      </Card>
      <Card>
        <p className="eyebrow">Deliver to</p>
        <p className="mt-1 font-semibold">{s.recipient_name}</p>
        <p className="text-sm">{s.delivery_unit && `${s.delivery_unit}-`}{dropAddr}</p>
        {s.delivery_instructions && <p className="mt-1 rounded bg-beige/50 px-2 py-1 text-sm">{s.delivery_instructions}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={mapsLink(dropAddr)} target="_blank" className="flex items-center justify-center gap-2 rounded-lg bg-charcoal py-2.5 text-sm font-semibold text-ivory"><Navigation size={16} /> Navigate</a>
          <a href={`tel:${s.recipient_phone}`} className="flex items-center justify-center gap-2 rounded-lg border border-beige py-2.5 text-sm font-semibold"><Phone size={16} /> Call</a>
        </div>
      </Card>
      <Card>
        <p className="eyebrow mb-2">Packages ({s.package_count})</p>
        <ul className="space-y-1 text-sm">{(pkgs ?? []).map((p) => <li key={p.id}>{p.quantity} × {p.package_type} — {p.weight_kg} kg {p.special_handling.length > 0 && <strong className="text-warning">· {p.special_handling.join(", ").replace(/_/g, " ")}</strong>}</li>)}</ul>
      </Card>
      {canDeliver && <Card><h2 className="mb-3 font-bold">Complete delivery</h2><DeliveryForm shipmentId={id} signatureRequired={sigReq} /></Card>}
      <Card><h2 className="mb-3 font-bold">Update status</h2><StatusUpdater shipmentId={id} options={options} requireScan /></Card>
      <Card><h2 className="mb-3 font-bold">History</h2><Timeline events={(events ?? []).map((e) => ({ status: e.status, at: e.created_at, location: e.location, notes: e.notes }))} /></Card>
    </div>
  );
}
