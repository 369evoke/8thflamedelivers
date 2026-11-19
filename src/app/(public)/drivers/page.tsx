import { Card, PageHeader, Section } from "@/components/ui";
import { DriverApplicationForm } from "@/components/forms/PublicForms";

export const metadata = { title: "Become a Driver" };

export default function DriversPage() {
  return (
    <>
      <PageHeader eyebrow="Careers" title="Become an 8th Flame driver" intro="Drive with a company that plans your day. Approved drivers receive assignments and routes from our dispatch team — no bidding, no competing for orders." />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div className="space-y-4">
            {[["Planned assignments", "Your pickups and deliveries are assigned by dispatch and organized into routes."], ["Simple mobile tools", "Confirm pickups, scan barcodes, update statuses and capture proof of delivery from your phone."], ["Requirements", "Valid Canadian driver's licence, suitable vehicle with appropriate insurance, smartphone, and a clean driving record. Final requirements are confirmed during review."]].map(([t, d]) => (
              <Card key={t}><h2 className="font-bold">{t}</h2><p className="mt-1 text-sm text-muted">{d}</p></Card>
            ))}
          </div>
          <Card className="p-6 md:p-8">
            <h2 className="mb-5 text-xl font-bold">Driver application</h2>
            <DriverApplicationForm />
          </Card>
        </div>
      </Section>
    </>
  );
}
