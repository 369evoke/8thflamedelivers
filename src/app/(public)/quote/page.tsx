import { PageHeader, Section, NotConfigured } from "@/components/ui";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { integrations } from "@/lib/env";

export const metadata = { title: "Get a Quote" };

export default function QuotePage() {
  return (
    <>
      <PageHeader eyebrow="Get a quote" title="See your price in seconds" intro="Enter postal codes and package details. Only services available on your route are shown." />
      <Section className="!pt-10">
        {integrations.supabase() ? <BookingWizard mode="quote" user={null} pickupWindows={[]} /> : <NotConfigured what="Quoting" env="NEXT_PUBLIC_SUPABASE_URL" />}
      </Section>
    </>
  );
}
