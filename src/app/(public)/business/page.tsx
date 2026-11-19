import { Boxes, FileSpreadsheet, Receipt, Tag, Users, Printer } from "lucide-react";
import { ButtonLink, Card, PageHeader, Section } from "@/components/ui";

export const metadata = { title: "Business Shipping" };

const F = [
  [Tag, "Negotiated pricing", "Account-level discounts applied automatically to every quote."],
  [FileSpreadsheet, "Bulk CSV booking", "Upload a spreadsheet to create many shipments at once."],
  [Printer, "Labels on demand", "Print 4×6 thermal or letter-size labels for every package."],
  [Receipt, "Invoicing", "Approved accounts can be billed monthly instead of paying per shipment."],
  [Users, "Team members", "Give your staff their own logins under one business account."],
  [Boxes, "Shipment history", "Search every shipment and see your shipping spend."],
] as const;

export default function BusinessPage() {
  return (
    <>
      <PageHeader eyebrow="Business solutions" title="Shipping for retailers, online stores and corporate teams" intro="Apply for an approved 8th Flame business account. Our team reviews each application and sets your rates and billing terms." />
      <Section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {F.map(([I, t, d]) => (
            <Card key={t}><I className="text-gold" /><h2 className="mt-3 font-bold">{t}</h2><p className="mt-1 text-sm text-muted">{d}</p></Card>
          ))}
        </div>
        <Card className="mt-10 flex flex-col items-start justify-between gap-4 bg-charcoal p-8 text-ivory md:flex-row md:items-center">
          <div><h2 className="text-2xl font-extrabold">Ready to open an account?</h2><p className="mt-1 text-ivory/70">You&apos;ll need an 8th Flame login first — it takes a minute.</p></div>
          <div className="flex gap-3"><ButtonLink href="/business/apply" variant="gold">Apply now</ButtonLink><ButtonLink href="/business/portal" variant="outline" className="border-ivory/40 bg-transparent text-ivory">Business sign-in</ButtonLink></div>
        </Card>
        <p className="mt-6 text-sm text-muted">E-commerce platform integrations (such as Shopify) are planned and not yet available.</p>
      </Section>
    </>
  );
}
