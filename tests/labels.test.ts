import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderLabelPdf, renderReceiptPdf } from "@/lib/labels";
import { renderEmail } from "@/lib/email";

const s = { tracking_number: "8F482019573611", reference: "EFD-2026-ABC123", service_name: "Standard Delivery", sender_name: "Sender Co", sender_phone: "416-555-0100", pickup_street: "1 King St W", pickup_unit: null, pickup_city: "Toronto", pickup_province: "ON", pickup_postal: "M5H 1A1", recipient_name: "Jane Recipient", recipient_phone: "905-555-0101", delivery_street: "50 Main St E", delivery_unit: "4", delivery_city: "Hamilton", delivery_province: "ON", delivery_postal: "L8N 1E8", delivery_instructions: "Side door", package_count: 3, total_weight_kg: 7.5, created_at: "2026-11-19T12:00:00Z", special_handling: ["fragile"] };

describe("documents", () => {
  it("renders one 4x6 label page per package with a barcode", async () => {
    const bytes = await renderLabelPdf(s, "4x6", "https://example.com/track/8F482019573611");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getSize()).toEqual({ width: 288, height: 432 });
  });
  it("renders letter-size labels", async () => {
    const doc = await PDFDocument.load(await renderLabelPdf({ ...s, package_count: 1 }, "letter", "https://x"));
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  });
  it("renders a receipt", async () => {
    const bytes = await renderReceiptPdf({ receipt_number: "RCT-1", paid_at: s.created_at, amount_cents: 2260, tracking_number: s.tracking_number, reference: s.reference, customer: "Sender Co", lines: [{ label: "Base", amount_cents: 2000 }], subtotal_cents: 2000, discount_cents: 0, tax_label: "HST (ON)", tax_cents: 260, company: { name: "8th Flame Delivery" } });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
  it("escapes HTML in emails", () => {
    const html = renderEmail("<script>", ["a & b"]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("a &amp; b");
  });
});
