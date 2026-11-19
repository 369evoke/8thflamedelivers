import { Card, PageHeader, Section, ButtonLink } from "@/components/ui";

export const metadata = { title: "About Us" };

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="About us" title="A delivery company that owns the whole journey" intro="8th Flame Delivery is a courier and parcel company. We don't run a marketplace — every shipment is booked with us, dispatched by our operations team and delivered by drivers we approve and manage." />
      <Section>
        <div className="grid gap-10 md:grid-cols-2">
          <div className="space-y-4 text-lg leading-relaxed text-muted">
            <p>We started 8th Flame Delivery to give individuals and businesses a dependable, professional alternative for local and regional shipping — with clear pricing and real tracking.</p>
            <p>When you book with us, your shipment is reviewed by a dispatcher, scheduled for pickup and assigned to a vetted driver. Each status you see on the tracking page is a real event recorded by our team.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[["Professional", "Trained, approved drivers and a dedicated dispatch team."], ["Dependable", "Planned routes and accountable hand-offs."], ["Transparent", "Itemized prices and recorded tracking events."], ["Customer-focused", "Support tickets you can follow online."]].map(([t, d]) => (
              <Card key={t}><h3 className="font-bold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></Card>
            ))}
          </div>
        </div>
        <div className="mt-12 flex gap-3"><ButtonLink href="/ship">Ship with us</ButtonLink><ButtonLink href="/contact" variant="outline">Contact us</ButtonLink></div>
      </Section>
    </>
  );
}
