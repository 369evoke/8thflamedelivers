import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { Alert, ButtonLink, Card, Section } from "@/components/ui";
import { canAccessShipment, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/pricing";
import { Breakdown } from "@/components/booking/BookingWizard";
import { RefreshSoon } from "@/components/tracking/RefreshSoon";

export const metadata = { title: "Shipment Confirmation" };
export const dynamic = "force-dynamic";

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ shipment?: string; t?: string }> }) {
  const { shipment, t } = await searchParams;
  const user = await getSessionUser();
  if (!shipment || !(await canAccessShipment(user, shipment, t))) {
    return <Section><Alert tone="warning">We couldn&apos;t find that booking. If you paid, check your email for confirmation.</Alert></Section>;
  }
  const admin = createAdminClient();
  const { data: s } = await admin.from("shipments").select("*, shipping_services(name)").eq("id", shipment).single();
  const { data: pay } = await admin.from("payments").select("id, status, receipt_number").eq("shipment_id", shipment).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const confirmed = s.payment_status === "paid" || s.payment_status === "invoiced";
  const tq = t ? `?t=${encodeURIComponent(t)}` : "";

  return (
    <Section>
      <div className="mx-auto max-w-3xl">
        {confirmed ? (
          <div className="mb-8 text-center"><CheckCircle2 className="mx-auto text-success" size={52} /><h1 className="mt-3 text-3xl font-extrabold">Your shipment is booked</h1><p className="mt-2 text-muted">A confirmation email has been sent to {s.sender_email}.</p></div>
        ) : (
          <div className="mb-8 text-center"><Clock className="mx-auto text-gold" size={52} /><h1 className="mt-3 text-3xl font-extrabold">Verifying your payment…</h1><p className="mt-2 text-muted">This usually takes a few seconds. This page will refresh automatically.</p><RefreshSoon /></div>
        )}
        <Card className="p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Tracking number</dt><dd className="font-mono text-lg font-bold">{s.tracking_number}</dd></div>
            <div><dt className="text-muted">Shipment reference</dt><dd className="font-mono font-bold">{s.reference}</dd></div>
            <div><dt className="text-muted">Pickup</dt><dd>{s.pickup_street}, {s.pickup_city} {s.pickup_province} {s.pickup_postal}<br />{s.pickup_date} · {s.pickup_window}</dd></div>
            <div><dt className="text-muted">Destination</dt><dd>{s.recipient_name}<br />{s.delivery_street}, {s.delivery_city} {s.delivery_province} {s.delivery_postal}</dd></div>
            <div><dt className="text-muted">Service</dt><dd>{s.shipping_services?.name}</dd></div>
            <div><dt className="text-muted">Payment</dt><dd>{s.payment_status === "invoiced" ? "Billed to business invoice" : pay?.status === "paid" ? `Paid ${formatCents(s.total_cents)} · Receipt ${pay.receipt_number}` : "Awaiting verification"}</dd></div>
          </dl>
          <div className="mt-6 border-t border-beige pt-5"><Breakdown p={s.price_breakdown} /></div>
          {confirmed && (
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href={`/track/${s.tracking_number}`}>Track shipment</ButtonLink>
              <a className="rounded-lg border border-charcoal/25 px-4 py-2.5 text-sm font-semibold" href={`/api/labels/${s.id}${tq}`} target="_blank">Print label (4×6)</a>
              <a className="rounded-lg border border-charcoal/25 px-4 py-2.5 text-sm font-semibold" href={`/api/labels/${s.id}${tq}${tq ? "&" : "?"}format=letter`} target="_blank">Print label (letter)</a>
              {pay?.status === "paid" && <a className="rounded-lg border border-charcoal/25 px-4 py-2.5 text-sm font-semibold" href={`/api/receipts/${pay.id}${tq}`} target="_blank">Receipt (PDF)</a>}
            </div>
          )}
        </Card>
        {!user && <p className="mt-6 text-center text-sm text-muted">Bookmark this page to reprint your label. <Link href="/sign-up" className="underline">Create an account</Link> to keep all your shipments in one place.</p>}
      </div>
    </Section>
  );
}
