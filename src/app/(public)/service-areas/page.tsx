import { MapPin } from "lucide-react";
import { ButtonLink, Card, EmptyState, PageHeader, Section } from "@/components/ui";
import { getActiveAreas, getActiveServices } from "@/lib/public-data";

export const metadata = { title: "Service Areas" };
export const revalidate = 300;

export default async function ServiceAreasPage() {
  const [areas, services] = await Promise.all([getActiveAreas(), getActiveServices()]);
  const name = Object.fromEntries(services.map((s) => [s.code, s.name]));
  return (
    <>
      <PageHeader eyebrow="Coverage" title="Service areas" intro="We only list areas where service is active today. We're expanding across Canada — if your area isn't listed, contact us." />
      <Section>
        {areas.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {areas.map((a) => (
              <Card key={a.id}>
                <div className="flex items-center gap-2"><MapPin size={18} className="text-gold" /><h2 className="font-bold">{a.name}</h2></div>
                <p className="mt-1 text-sm text-muted">{a.city}, {a.province}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">Services</p>
                <p className="text-sm">{a.service_codes.map((c: string) => name[c] ?? c).join(" · ") || "—"}</p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No service areas are active yet" body="We'll list our delivery areas here as soon as service opens." action={<ButtonLink href="/contact" variant="outline">Contact us</ButtonLink>} />
        )}
        <p className="mt-8 text-sm text-muted">Exact availability is checked by postal code when you request a quote.</p>
      </Section>
    </>
  );
}
