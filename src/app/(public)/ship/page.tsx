import { PageHeader, Section, NotConfigured } from "@/components/ui";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { getSessionUser } from "@/lib/auth";
import { integrations } from "@/lib/env";
import { loadSettings } from "@/lib/quote-service";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata = { title: "Ship a Package" };

export default async function ShipPage() {
  if (!integrations.supabase()) return <Section><NotConfigured what="Booking" env="NEXT_PUBLIC_SUPABASE_URL" /></Section>;
  const [user, settings] = await Promise.all([getSessionUser(), loadSettings()]);
  const saved = user ? (await createAdminClient().from("addresses").select("*").eq("profile_id", user.id).order("created_at", { ascending: false })).data ?? [] : [];
  return (
    <>
      <PageHeader eyebrow="Ship a package" title="Book your shipment" intro="Takes about three minutes. You'll see the full price before you pay." />
      <Section className="!pt-10">
        {!integrations.stripe() && <div className="mb-6"><NotConfigured what="Online payment" env="STRIPE_SECRET_KEY" /></div>}
        <BookingWizard user={user ? { email: user.email, name: user.fullName ?? "", phone: user.phone ?? "" } : null} pickupWindows={settings.pickupWindows} savedAddresses={saved} />
      </Section>
    </>
  );
}
