import { DashTitle } from "@/components/dashboard/Shell";
import { Card } from "@/components/ui";
import { BulkUpload } from "@/components/forms/BulkUpload";
import { requireBusinessPage } from "@/lib/auth";
import { loadSettings } from "@/lib/quote-service";
import { createUserClient } from "@/lib/supabase/server";

export default async function Bulk() {
  const { business } = await requireBusinessPage();
  const [settings, db] = await Promise.all([loadSettings(), createUserClient()]);
  const { data: addrs } = await db.from("addresses").select("id, label, contact_name, street, city").eq("business_id", business.id);
  return (
    <>
      <DashTitle title="Bulk shipping" sub="Upload a CSV to create up to 200 shipments at once. Each row is validated and priced individually on the server." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6"><BulkUpload businessId={business.id} addresses={addrs ?? []} windows={settings.pickupWindows} defaultDate={new Date(new Date().getTime() + 864e5).toISOString().slice(0, 10)} /></Card>
        <Card className="p-6 text-sm">
          <h2 className="mb-2 font-bold">CSV format</h2>
          <p className="text-muted">One row per shipment. Required: recipient_name, recipient_phone, street, city, province, postal_code, description, weight_kg, length_cm, width_cm, height_cm. Optional: unit, recipient_email, instructions, package_type, quantity, service_code (default <code>business</code>), special_handling (separate with <code>;</code>), pickup_date, pickup_window.</p>
          <a href="/templates/bulk-shipments.csv" download className="mt-3 inline-block font-semibold text-gold-dark underline">Download template CSV</a>
          <p className="mt-4 text-xs text-muted">Bulk shipments are billed to your business invoice. Direct e-commerce integrations (e.g. Shopify) are planned.</p>
        </Card>
      </div>
    </>
  );
}
