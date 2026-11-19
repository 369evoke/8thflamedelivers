import { PageHeader, Section } from "@/components/ui";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy Policy" intro="Template drafted with PIPEDA principles in mind. Have it reviewed by a qualified Canadian lawyer before launch." />
      <Section>
        <article className="prose mx-auto max-w-3xl space-y-6 text-[0.98rem] leading-relaxed">
          {[
            ["Accountability", "8th Flame Delivery is responsible for personal information under its control and has designated a Privacy Officer, reachable through our Contact page."],
            ["What we collect", "Names, phone numbers, email addresses and pickup/delivery addresses needed to move a shipment; package details; payment status (card details are handled by Stripe and never stored by us); account details; driver and business application information including documents you upload; and proof-of-delivery records such as recipient name, photo and signature."],
            ["Why we collect it", "To quote, book, pick up, deliver and track shipments; to process payments and refunds; to review driver and business applications; to provide customer support; to meet legal, tax and safety obligations; and to improve our service."],
            ["Consent", "We collect, use and disclose personal information with your consent, which you give by booking, creating an account or submitting an application. You may withdraw consent subject to legal and contractual limits, although we may then be unable to provide the service."],
            ["Limiting use and disclosure", "We share information only with service providers who help us operate (hosting, payments, email, mapping) under contractual safeguards, with the recipient/sender of a shipment as needed for delivery, or where required by law. Public tracking shows only status, dates and city — never names, addresses or phone numbers."],
            ["Retention", "We keep shipment and payment records for as long as required for tax, accounting and claims purposes, then delete or anonymize them. Unsuccessful application documents are deleted after a defined period."],
            ["Safeguards", "Data is encrypted in transit, access is limited by role and enforced in the database, uploaded documents are stored privately, and administrative actions are recorded in an audit log."],
            ["Access and correction", "You may request access to, or correction of, your personal information by contacting us. We will respond within 30 days."],
            ["Provincial laws", "Where provincial privacy legislation applies (for example Québec's Law 25, Alberta PIPA or British Columbia PIPA), we follow its requirements."],
            ["Contact", "Questions or complaints can be sent through our Contact page. You may also contact the Office of the Privacy Commissioner of Canada."],
          ].map(([h, p]) => (
            <section key={h}><h2 className="text-xl font-bold">{h}</h2><p className="mt-2 text-muted">{p}</p></section>
          ))}
        </article>
      </Section>
    </>
  );
}
