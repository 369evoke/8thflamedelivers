import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/pricing";
import { loadSettings } from "@/lib/quote-service";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invoices").select("*, businesses(name, address, city, province, email)").eq("id", id).maybeSingle();
  if (!inv || !user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bizAdmin = user.businesses.some((b) => b.id === inv.business_id && ["owner", "admin"].includes(b.member_role));
  if (!bizAdmin && !hasPermission(user.role, "invoices.manage")) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: ships } = await admin.from("shipments").select("tracking_number, created_at, delivery_city, subtotal_cents, discount_cents, tax_cents, total_cents").eq("invoice_id", id).order("created_at");
  const company = (await loadSettings()).company;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  const ch = rgb(0.145, 0.145, 0.145), gold = rgb(0.722, 0.584, 0.333);
  page.drawText("8TH FLAME", { x: 54, y: 740, size: 20, font: bold, color: ch });
  page.drawText("DELIVERY", { x: 54, y: 722, size: 10, font: bold, color: gold });
  page.drawText(`INVOICE ${inv.invoice_number}`, { x: 360, y: 740, size: 14, font: bold, color: ch });
  const b = inv.businesses as { name: string; address: string; city: string; province: string; email: string };
  [`Bill to: ${b.name}`, `${b.address}, ${b.city} ${b.province}`, b.email, `Period: ${inv.period_start} to ${inv.period_end}`, `Due: ${inv.due_date ?? "—"} · Status: ${inv.status}`].forEach((t, i) => page.drawText(t, { x: 54, y: 680 - i * 15, size: 10, font, color: ch }));
  let y = 590;
  page.drawText("Tracking", { x: 54, y, size: 9, font: bold }); page.drawText("Date", { x: 200, y, size: 9, font: bold }); page.drawText("Destination", { x: 290, y, size: 9, font: bold }); page.drawText("Amount", { x: 500, y, size: 9, font: bold });
  y -= 16;
  for (const s of ships ?? []) {
    if (y < 90) { page = pdf.addPage([612, 792]); y = 740; }
    page.drawText(s.tracking_number, { x: 54, y, size: 9, font }); page.drawText(s.created_at.slice(0, 10), { x: 200, y, size: 9, font }); page.drawText(s.delivery_city.slice(0, 30), { x: 290, y, size: 9, font }); page.drawText(formatCents(s.total_cents), { x: 500, y, size: 9, font });
    y -= 14;
  }
  y -= 10;
  [["Subtotal", inv.subtotal_cents], ["Tax", inv.tax_cents], ["Total due (CAD)", inv.total_cents]].forEach(([l, v], i) => { page.drawText(String(l), { x: 380, y: y - i * 16, size: 10, font: i === 2 ? bold : font }); page.drawText(formatCents(Number(v)), { x: 500, y: y - i * 16, size: 10, font: i === 2 ? bold : font }); });
  page.drawText([company.name, company.address, company.support_email].filter(Boolean).join(" · "), { x: 54, y: 40, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  return new NextResponse(Buffer.from(await pdf.save()), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${inv.invoice_number}.pdf"`, "Cache-Control": "private, no-store" } });
}
