import { MapPin, Package, CalendarDays } from "lucide-react";
import { Alert, Card, Section, StatusBadge } from "@/components/ui";
import { TrackForm } from "@/components/tracking/TrackForm";
import { Timeline } from "@/components/tracking/Timeline";
import { getPublicTracking } from "@/lib/tracking-server";
import { STATUS_LABELS } from "@/lib/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shipment Tracking", robots: { index: false } };

export default async function TrackResult({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const t = await getPublicTracking(number);
  return (
    <Section className="!pt-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card><TrackForm initial={decodeURIComponent(number)} /></Card>
        {!t ? (
          <Alert tone="warning">We couldn&apos;t find a shipment with that tracking number. Check the number and try again — new bookings appear once payment is confirmed.</Alert>
        ) : (
          <>
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs uppercase tracking-wider text-muted">Tracking number</p><p className="font-mono text-2xl font-bold">{t.tracking_number}</p></div>
                <StatusBadge status={t.status} />
              </div>
              <p className="mt-4 font-display text-3xl font-extrabold">{STATUS_LABELS[t.status]}</p>
              <div className="mt-6 grid gap-4 text-sm sm:grid-cols-4">
                <div className="flex gap-2"><MapPin size={18} className="text-gold" /><div><p className="text-muted">From</p><p className="font-semibold">{t.origin}</p></div></div>
                <div className="flex gap-2"><MapPin size={18} className="text-gold" /><div><p className="text-muted">To</p><p className="font-semibold">{t.destination}</p></div></div>
                <div className="flex gap-2"><CalendarDays size={18} className="text-gold" /><div><p className="text-muted">{t.delivered_at ? "Delivered" : "Estimated delivery"}</p><p className="font-semibold">{t.delivered_at ? new Date(t.delivered_at).toLocaleDateString("en-CA") : t.estimated_delivery_date ?? "Not yet available"}</p></div></div>
                <div className="flex gap-2"><Package size={18} className="text-gold" /><div><p className="text-muted">Created</p><p className="font-semibold">{new Date(t.created_at).toLocaleDateString("en-CA")} · {t.package_count} pkg</p></div></div>
              </div>
            </Card>
            <Card className="p-6"><h2 className="mb-5 font-bold">Shipment history</h2><Timeline events={t.events} /></Card>
          </>
        )}
      </div>
    </Section>
  );
}
