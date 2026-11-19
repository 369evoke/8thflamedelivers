import { PageHeader, Section } from "@/components/ui";

export const metadata = { title: "FAQ" };

const FAQ = [
  ["How is my price calculated?", "Prices are calculated on our server from the service you choose, the driving distance, the billable weight (the greater of actual and dimensional weight), any special handling and applicable taxes. You see a full breakdown before you pay."],
  ["When is my shipment confirmed?", "After your payment is verified by our payment processor, your shipment moves to Awaiting Confirmation. Our operations team then confirms it and schedules the pickup."],
  ["Can I cancel?", "Yes, from your account while the shipment has not yet been assigned to a driver. After that, contact support and we'll do our best to help. Eligible refunds are processed to the original payment method."],
  ["What can't I ship?", "Weapons, ammunition, explosives, fireworks, flammable or corrosive materials, loose lithium batteries, cannabis, alcohol, cash, live animals and other hazardous or illegal items. Bookings containing restricted items are blocked."],
  ["What are the size and weight limits?", "Limits are shown during booking and are set by our operations team. Larger items may require a custom quote."],
  ["How do I track my package?", "Enter your tracking number (it starts with 8F) on the Track page. You'll see every status event recorded by our drivers and staff."],
  ["Do I need an account?", "No — you can book as a guest. An account lets you save addresses, see your shipment history and download receipts and labels any time."],
  ["Do you offer business rates?", "Yes. Apply for a business account to access negotiated pricing, bulk CSV booking, team members and invoicing."],
];

export default function FaqPage() {
  return (
    <>
      <PageHeader eyebrow="Help" title="Frequently asked questions" />
      <Section>
        <div className="mx-auto max-w-3xl divide-y divide-beige rounded-xl border border-beige bg-white">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{q}<span className="text-gold transition group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
