import { Alert, ButtonLink, Section } from "@/components/ui";

export const metadata = { title: "Payment Cancelled" };

export default function CancelledPage() {
  return (
    <Section>
      <div className="mx-auto max-w-xl space-y-5 text-center">
        <h1 className="text-3xl font-extrabold">Payment not completed</h1>
        <Alert tone="warning">Your card was not charged and the shipment has not been booked.</Alert>
        <ButtonLink href="/ship">Start again</ButtonLink>
      </div>
    </Section>
  );
}
