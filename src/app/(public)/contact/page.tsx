import { Mail, Phone, MapPin } from "lucide-react";
import { Card, PageHeader, Section } from "@/components/ui";
import { ContactForm } from "@/components/forms/PublicForms";
import { getSessionUser } from "@/lib/auth";
import { integrations } from "@/lib/env";
import { loadSettings } from "@/lib/quote-service";

export const metadata = { title: "Contact Us" };

export default async function ContactPage() {
  const user = await getSessionUser();
  const company = integrations.supabase() ? (await loadSettings()).company : {};
  return (
    <>
      <PageHeader eyebrow="Contact" title="How can we help?" intro="Send us a message and we'll open a support ticket you can follow. For shipment questions, include your tracking number." />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-3">
            {company.support_email && <Card className="flex gap-3"><Mail className="text-gold" /><span>{company.support_email}</span></Card>}
            {company.phone && <Card className="flex gap-3"><Phone className="text-gold" /><span>{company.phone}</span></Card>}
            {company.address && <Card className="flex gap-3"><MapPin className="text-gold" /><span>{company.address}</span></Card>}
            {!company.support_email && !company.phone && <Card><p className="text-sm text-muted">Use the form to reach our team.</p></Card>}
          </div>
          <Card className="p-6 md:p-8"><ContactForm defaultEmail={user?.email} defaultName={user?.fullName ?? ""} /></Card>
        </div>
      </Section>
    </>
  );
}
