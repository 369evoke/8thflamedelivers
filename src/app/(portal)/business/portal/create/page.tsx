import { DashTitle } from "@/components/dashboard/Shell";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { requireBusinessPage } from "@/lib/auth";
import { loadSettings } from "@/lib/quote-service";
import { createUserClient } from "@/lib/supabase/server";

export default async function Create() {
  const { user, business } = await requireBusinessPage();
  const [settings, db] = await Promise.all([loadSettings(), createUserClient()]);
  const { data: saved } = await db.from("addresses").select("*").eq("business_id", business.id);
  return (
    <>
      <DashTitle title="Create shipment" sub="Your negotiated business rate is applied automatically." />
      <BookingWizard user={{ email: user.email, name: user.fullName ?? "", phone: user.phone ?? "" }} pickupWindows={settings.pickupWindows} savedAddresses={saved ?? []} businessId={business.id} />
    </>
  );
}
