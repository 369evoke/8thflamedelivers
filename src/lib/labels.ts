import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";
import bwipjs from "bwip-js/node";
import { ARROW_PATH, FLAME_PATH } from "@/lib/brand";
import { formatCents } from "@/lib/pricing";

const charcoal = rgb(0.145, 0.145, 0.145);
const gold = rgb(0.722, 0.584, 0.333);
const ivory = rgb(0.973, 0.965, 0.941);
const grey = rgb(0.42, 0.42, 0.42);

export interface LabelShipment {
  tracking_number: string;
  reference: string;
  service_name: string;
  sender_name: string;
  sender_phone: string;
  pickup_street: string;
  pickup_unit: string | null;
  pickup_city: string;
  pickup_province: string;
  pickup_postal: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_street: string;
  delivery_unit: string | null;
  delivery_city: string;
  delivery_province: string;
  delivery_postal: string;
  delivery_instructions: string | null;
  package_count: number;
  total_weight_kg: number;
  created_at: string;
  special_handling: string[];
}

async function barcodePng(text: string) {
  return bwipjs.toBuffer({ bcid: "code128", text, scale: 3, height: 14, includetext: false, backgroundcolor: "FFFFFF" });
}

async function qrPng(text: string) {
  return bwipjs.toBuffer({ bcid: "qrcode", text, scale: 4 });
}

function drawLogo(page: PDFPage, x: number, y: number, size: number, bold: PDFFont, dark = true) {
  const s = size / 100;
  page.drawRectangle({ x, y: y - size, width: size, height: size, color: dark ? charcoal : ivory });
  page.drawSvgPath(FLAME_PATH, { x, y, scale: s, color: gold });
  page.drawSvgPath(ARROW_PATH, { x, y, scale: s, color: dark ? charcoal : ivory });
  page.drawText("8TH FLAME", { x: x + size + 6, y: y - size * 0.48, size: size * 0.36, font: bold, color: charcoal });
  page.drawText("DELIVERY", { x: x + size + 6, y: y - size * 0.9, size: size * 0.26, font: bold, color: gold });
}

function addr(s: LabelShipment, who: "from" | "to") {
  return who === "from"
    ? [s.sender_name, [s.pickup_unit, s.pickup_street].filter(Boolean).join("-"), `${s.pickup_city} ${s.pickup_province}  ${s.pickup_postal}`, s.sender_phone]
    : [s.recipient_name, [s.delivery_unit, s.delivery_street].filter(Boolean).join("-"), `${s.delivery_city} ${s.delivery_province}  ${s.delivery_postal}`, s.recipient_phone];
}

/** One label page per package (n of N). 4×6 thermal or US Letter / A4-safe plain paper. */
export async function renderLabelPdf(s: LabelShipment, format: "4x6" | "letter", trackUrl: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`8th Flame Delivery label ${s.tracking_number}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bar = await pdf.embedPng(await barcodePng(s.tracking_number));
  const qr = await pdf.embedPng(await qrPng(trackUrl));

  const W = 288, H = 432; // 4×6 in points
  for (let i = 1; i <= s.package_count; i++) {
    const page = format === "4x6" ? pdf.addPage([W, H]) : pdf.addPage([612, 792]);
    const ox = format === "4x6" ? 0 : (612 - W) / 2;
    const oy = format === "4x6" ? 0 : 792 - H - 54;
    if (format === "letter") {
      page.drawRectangle({ x: ox - 1, y: oy - 1, width: W + 2, height: H + 2, borderColor: grey, borderWidth: 0.6, borderDashArray: [4, 3] });
      page.drawText("Cut along the dashed line and attach securely to the package.", { x: ox, y: oy - 18, size: 8, font, color: grey });
    }
    const X = (v: number) => ox + v;
    const Y = (v: number) => oy + v;

    // header
    drawLogo(page, X(12), Y(H - 10), 34, bold);
    page.drawText(s.service_name.toUpperCase(), { x: X(W - 12 - bold.widthOfTextAtSize(s.service_name.toUpperCase(), 9)), y: Y(H - 22), size: 9, font: bold, color: charcoal });
    page.drawText(`PKG ${i} OF ${s.package_count}`, { x: X(W - 12 - bold.widthOfTextAtSize(`PKG ${i} OF ${s.package_count}`, 12)), y: Y(H - 40), size: 12, font: bold, color: charcoal });
    page.drawLine({ start: { x: X(10), y: Y(H - 52) }, end: { x: X(W - 10), y: Y(H - 52) }, thickness: 1.2, color: charcoal });

    // from
    page.drawText("FROM", { x: X(12), y: Y(H - 66), size: 7, font: bold, color: gold });
    addr(s, "from").forEach((line, k) => page.drawText(line.slice(0, 48), { x: X(12), y: Y(H - 77 - k * 10), size: 8, font, color: charcoal }));
    page.drawLine({ start: { x: X(10), y: Y(H - 122) }, end: { x: X(W - 10), y: Y(H - 122) }, thickness: 0.6, color: grey });

    // to
    page.drawText("SHIP TO", { x: X(12), y: Y(H - 138), size: 8, font: bold, color: gold });
    const to = addr(s, "to");
    page.drawText(to[0].slice(0, 30), { x: X(12), y: Y(H - 156), size: 14, font: bold, color: charcoal });
    page.drawText(to[1].slice(0, 36), { x: X(12), y: Y(H - 174), size: 12, font, color: charcoal });
    page.drawText(to[2], { x: X(12), y: Y(H - 192), size: 14, font: bold, color: charcoal });
    page.drawText(to[3], { x: X(12), y: Y(H - 208), size: 9, font, color: charcoal });
    if (s.delivery_instructions) page.drawText(`Note: ${s.delivery_instructions}`.slice(0, 60), { x: X(12), y: Y(H - 222), size: 7, font, color: grey });

    // postal sort block
    page.drawRectangle({ x: X(W - 78), y: Y(H - 214), width: 66, height: 48, color: charcoal });
    page.drawText(s.delivery_postal.slice(0, 3), { x: X(W - 70), y: Y(H - 196), size: 22, font: bold, color: ivory });
    page.drawText(s.delivery_province, { x: X(W - 70), y: Y(H - 210), size: 9, font: bold, color: gold });

    page.drawLine({ start: { x: X(10), y: Y(H - 232) }, end: { x: X(W - 10), y: Y(H - 232) }, thickness: 1.2, color: charcoal });

    // barcode
    page.drawText("TRACKING #", { x: X(12), y: Y(H - 246), size: 7, font: bold, color: gold });
    page.drawImage(bar, { x: X(12), y: Y(H - 316), width: W - 24, height: 62 });
    const tn = s.tracking_number.replace(/(.{2})(.{4})(.{4})(.*)/, "$1 $2 $3 $4");
    page.drawText(tn, { x: X((W - bold.widthOfTextAtSize(tn, 14)) / 2), y: Y(H - 334), size: 14, font: bold, color: charcoal });

    // footer details
    page.drawLine({ start: { x: X(10), y: Y(86) }, end: { x: X(W - 10), y: Y(86) }, thickness: 0.6, color: grey });
    const details = [
      `Ref: ${s.reference}`,
      `Weight: ${Number(s.total_weight_kg).toFixed(1)} kg total`,
      `Packages: ${s.package_count}`,
      `Shipped: ${new Date(s.created_at).toLocaleDateString("en-CA")}`,
    ];
    details.forEach((d, k) => page.drawText(d, { x: X(12), y: Y(72 - k * 11), size: 8, font, color: charcoal }));
    if (s.special_handling.length) {
      page.drawText(s.special_handling.map((h) => h.replace(/_/g, " ").toUpperCase()).join(" · ").slice(0, 40), { x: X(12), y: Y(20), size: 8, font: bold, color: charcoal });
    }
    page.drawImage(qr, { x: X(W - 74), y: Y(12), width: 62, height: 62 });
  }
  return pdf.save();
}

export interface ReceiptData {
  receipt_number: string;
  paid_at: string;
  amount_cents: number;
  tracking_number: string;
  reference: string;
  customer: string;
  lines: { label: string; amount_cents: number }[];
  subtotal_cents: number;
  discount_cents: number;
  tax_label: string;
  tax_cents: number;
  company: { name?: string; address?: string; support_email?: string };
}

export async function renderReceiptPdf(r: ReceiptData) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  drawLogo(page, 54, 740, 44, bold);
  page.drawText("RECEIPT", { x: 470, y: 716, size: 20, font: bold, color: charcoal });
  let y = 660;
  const row = (l: string, v: string, b = false) => {
    page.drawText(l, { x: 54, y, size: 10, font: b ? bold : font, color: charcoal });
    page.drawText(v, { x: 558 - (b ? bold : font).widthOfTextAtSize(v, 10), y, size: 10, font: b ? bold : font, color: charcoal });
    y -= 18;
  };
  row("Receipt number", r.receipt_number);
  row("Date paid", new Date(r.paid_at).toLocaleString("en-CA"));
  row("Billed to", r.customer);
  row("Tracking number", r.tracking_number);
  row("Shipment reference", r.reference);
  y -= 10;
  page.drawLine({ start: { x: 54, y }, end: { x: 558, y }, thickness: 1, color: gold });
  y -= 22;
  r.lines.forEach((l) => row(l.label, formatCents(l.amount_cents)));
  row("Subtotal", formatCents(r.subtotal_cents), true);
  if (r.discount_cents) row("Discounts", "-" + formatCents(r.discount_cents));
  row(r.tax_label, formatCents(r.tax_cents));
  y -= 4;
  page.drawLine({ start: { x: 54, y: y + 10 }, end: { x: 558, y: y + 10 }, thickness: 1, color: charcoal });
  row("Total paid (CAD)", formatCents(r.amount_cents), true);
  y -= 30;
  [r.company.name, r.company.address, r.company.support_email].filter(Boolean).forEach((t) => {
    page.drawText(String(t), { x: 54, y, size: 9, font, color: grey });
    y -= 13;
  });
  return pdf.save();
}
