import { Card, PageHeader, Section } from "@/components/ui";
import { TrackForm } from "@/components/tracking/TrackForm";

export const metadata = { title: "Track a Shipment" };

export default function TrackPage() {
  return (
    <>
      <PageHeader eyebrow="Tracking" title="Track a shipment" intro="Enter the tracking number from your confirmation email or shipping label." />
      <Section><Card className="mx-auto max-w-xl p-6"><TrackForm /></Card></Section>
    </>
  );
}
