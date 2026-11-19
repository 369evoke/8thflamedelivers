import { PageHeader, Section } from "@/components/ui";

export const metadata = { title: "Terms and Conditions" };

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms and Conditions" intro="Template terms of carriage. Have them reviewed by a qualified Canadian lawyer and set your liability limits before launch." />
      <Section>
        <article className="mx-auto max-w-3xl space-y-6 leading-relaxed">
          {[
            ["Agreement", "By booking a shipment with 8th Flame Delivery you agree to these terms of carriage."],
            ["Booking and payment", "A shipment is booked when payment is verified by our payment processor, or when it is accepted under an approved business invoicing arrangement. Prices are calculated from the details you provide; if actual weight or dimensions differ, we may adjust the charge and will notify you."],
            ["Packaging", "You are responsible for packaging that protects the contents during normal handling."],
            ["Restricted items", "You must not ship prohibited or restricted items. We may refuse, hold or return any shipment we reasonably believe contains them."],
            ["Pickup and delivery", "Pickup windows and estimated delivery dates are estimates, not guarantees, unless stated otherwise. We may attempt delivery more than once and may return undeliverable shipments to the sender."],
            ["Cancellation and refunds", "You may cancel online before a driver is assigned. Eligible refunds are returned to the original payment method."],
            ["Liability", "Our liability for loss or damage is limited to the amount set out in our published liability schedule unless additional coverage was purchased. [Set this amount before launch.]"],
            ["Claims", "Claims must be submitted through customer support within the period stated in our claims policy, with supporting information."],
            ["Governing law", "These terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein."],
          ].map(([h, p]) => (
            <section key={h}><h2 className="text-xl font-bold">{h}</h2><p className="mt-2 text-muted">{p}</p></section>
          ))}
        </article>
      </Section>
    </>
  );
}
