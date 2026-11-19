import { Badge, ButtonLink, Card, EmptyState, PageHeader, Section } from "@/components/ui";
import { getActiveServices } from "@/lib/public-data";

export const metadata = { title: "Our Services" };
export const revalidate = 300;

const EXTRA = [
  ["Local Courier Services", "Documents, keys and small items moved across town by our own couriers. Book as Same-Day or Scheduled."],
  ["Bulk Shipments", "Approved business accounts can upload a CSV file to create many shipments at once, with labels for each package."],
];

export default async function ServicesPage() {
  const services = await getActiveServices();
  return (
    <>
      <PageHeader eyebrow="Our services" title="Shipping services" intro="Availability depends on your pickup and delivery postal codes — the quote tool only shows services offered on your route." />
      <Section>
        {services.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {services.map((s) => (
              <Card key={s.code} className="p-7">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{s.name}</h2>
                  {s.same_day && <Badge tone="gold">Same day</Badge>}
                  {s.business_only && <Badge>Business accounts</Badge>}
                </div>
                <p className="mt-2 text-muted">{s.description}</p>
                <p className="mt-3 text-sm text-muted">Typical transit: {s.same_day ? "same business day" : `${s.transit_days} business day${s.transit_days === 1 ? "" : "s"}`}</p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Services are being configured" body="Please check back soon or contact us for help with a shipment." />
        )}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {EXTRA.map(([t, d]) => (
            <Card key={t} className="bg-beige/30"><h2 className="font-bold">{t}</h2><p className="mt-1 text-sm text-muted">{d}</p></Card>
          ))}
        </div>
        <div className="mt-10 flex gap-3"><ButtonLink href="/quote">Get a quote</ButtonLink><ButtonLink href="/ship" variant="outline">Ship now</ButtonLink></div>
      </Section>
    </>
  );
}
