import "server-only";
import { Resend } from "resend";
import { env, integrations } from "@/lib/env";

export interface EmailResult {
  status: "sent" | "skipped" | "failed";
  id?: string;
  error?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Branded, table-based HTML that renders in common email clients. */
export function renderEmail(heading: string, paragraphs: string[], cta?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${esc(p)}</p>`).join("");
  const button = cta
    ? `<a href="${esc(cta.url)}" style="display:inline-block;background:#252525;color:#F8F6F0;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600">${esc(cta.label)}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F8F6F0;font-family:Helvetica,Arial,sans-serif;color:#252525">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #EAE4D8;border-radius:10px">
<tr><td style="background:#252525;padding:18px 28px;border-radius:10px 10px 0 0;color:#F8F6F0;font-weight:700;letter-spacing:.08em">8TH FLAME <span style="color:#B89555">DELIVERY</span></td></tr>
<tr><td style="padding:28px"><h1 style="font-size:20px;margin:0 0 16px">${esc(heading)}</h1>${body}${button}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #EAE4D8;font-size:12px;color:#6b6b6b">You received this email because of activity on a shipment or account with 8th Flame Delivery.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!integrations.email()) {
    console.info(`[email:skipped — RESEND_API_KEY not set] to=${to} subject="${subject}"`);
    return { status: "skipped" };
  }
  try {
    const resend = new Resend(env.resendKey);
    const { data, error } = await resend.emails.send({ from: env.emailFrom, to, subject, html });
    if (error) return { status: "failed", error: error.message };
    return { status: "sent", id: data?.id };
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
}
