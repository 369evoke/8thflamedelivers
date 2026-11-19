import { NextResponse } from "next/server";
import { canAccessShipment, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { renderReceiptPdf } from "@/lib/labels";
import { loadSettings } from "@/lib/quote-service";

/** Receipt PDF for a paid payment. `id` is the payment id. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { data: p } = await admin.from("payments").select("*, shipments(*)").eq("id", id).maybeSingle();
  if (!p || p.status === "pending" || p.status === "failed" || !p.shipments) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getSessionUser();
  if (!(await canAccessShipment(user, p.shipment_id, new URL(req.url).searchParams.get("t")))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const s = p.shipments;
  const b = s.price_breakdown;
  const pdf = await renderReceiptPdf({
    receipt_number: p.receipt_number ?? p.id.slice(0, 8),
    paid_at: p.paid_at ?? p.created_at,
    amount_cents: p.amount_cents,
    tracking_number: s.tracking_number,
    reference: s.reference,
    customer: s.sender_name,
    lines: b.lines,
    subtotal_cents: b.subtotal_cents,
    discount_cents: b.discount_cents,
    tax_label: b.tax_label,
    tax_cents: b.tax_cents,
    company: (await loadSettings()).company,
  });
  return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="receipt-${p.receipt_number}.pdf"`, "Cache-Control": "private, no-store" } });
}
