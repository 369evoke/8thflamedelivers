import { NextResponse } from "next/server";
import { canAccessShipment, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { renderLabelPdf } from "@/lib/labels";
import { env } from "@/lib/env";

/** Label download. Only for paid/invoiced shipments, and only for the owner, business members, assigned driver, staff, or guest token holder. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "letter" ? "letter" : "4x6";
  const user = await getSessionUser();
  if (!(await canAccessShipment(user, id, url.searchParams.get("t")))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: s } = await admin.from("shipments").select("*, shipping_services(name), shipment_packages(special_handling)").eq("id", id).single();
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["paid", "invoiced"].includes(s.payment_status)) return NextResponse.json({ error: "Labels are available once payment is confirmed." }, { status: 409 });
  if (s.status === "cancelled") return NextResponse.json({ error: "This shipment was cancelled." }, { status: 409 });

  const handling = [...new Set((s.shipment_packages ?? []).flatMap((p: { special_handling: string[] }) => p.special_handling))] as string[];
  const pdf = await renderLabelPdf(
    { ...s, service_name: s.shipping_services?.name ?? s.service_code, special_handling: handling },
    format,
    `${env.siteUrl}/track/${s.tracking_number}`,
  );

  await admin.from("shipping_labels").insert({ shipment_id: id, format, generated_by: user?.id ?? null });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="label-${s.tracking_number}-${format}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
