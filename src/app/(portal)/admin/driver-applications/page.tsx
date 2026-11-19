import { DashTitle } from "@/components/dashboard/Shell";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { requireStaffPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { reviewDriverApplicationAction } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function DriverApps({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaffPage("drivers.applications");
  const { status = "open" } = await searchParams;
  const a = createAdminClient();
  let q = a.from("driver_applications").select("*").order("created_at", { ascending: false }).limit(100);
  q = status === "open" ? q.in("status", ["submitted", "under_review"]) : q.eq("status", status);
  const [{ data }, { data: areas }] = await Promise.all([q, a.from("service_areas").select("id, name")]);
  // short-lived signed links for private documents
  const docs = new Map<string, { name: string; url: string }[]>();
  for (const app of data ?? []) {
    const links = await Promise.all(app.document_paths.map(async (p: string, i: number) => ({ name: `Document ${i + 1}`, url: (await a.storage.from("driver-documents").createSignedUrl(p, 600)).data?.signedUrl ?? "#" })));
    docs.set(app.id, links);
  }
  return (
    <>
      <DashTitle title="Driver applications" actions={<div className="flex gap-1 text-sm">{["open", "approved", "rejected"].map((s) => <a key={s} href={`?status=${s}`} className={`rounded-md px-3 py-1.5 font-semibold ${s === status ? "bg-charcoal text-ivory" : "bg-white"}`}>{s}</a>)}</div>} />
      {!data?.length ? <EmptyState title="No applications" /> : (
        <div className="space-y-4">
          {data.map((app) => (
            <Card key={app.id} className="grid gap-5 p-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="text-sm">
                <div className="flex items-center gap-2"><h2 className="text-lg font-bold">{app.full_name}</h2><Badge tone={app.status === "approved" ? "success" : app.status === "rejected" ? "danger" : "gold"}>{app.status.replace("_", " ")}</Badge></div>
                <p className="text-muted">{app.email} · {app.phone}</p>
                <p className="mt-2">{app.address}, {app.city} {app.province}</p>
                <p><strong>Vehicle:</strong> {app.vehicle_type} {app.vehicle_info}</p>
                <p><strong>Experience:</strong> {app.experience_years} yrs · <strong>Availability:</strong> {app.availability}</p>
                {app.qualifications && <p><strong>Qualifications:</strong> {app.qualifications}</p>}
                <p className="mt-2"><strong>Documents:</strong> {docs.get(app.id)?.map((d) => <a key={d.url} href={d.url} target="_blank" className="mr-2 underline">{d.name}</a>)}</p>
                <p className="mt-1 text-xs text-muted">Submitted {new Date(app.created_at).toLocaleString("en-CA")}{app.reviewed_at && ` · reviewed ${new Date(app.reviewed_at).toLocaleDateString("en-CA")}`}</p>
              </div>
              <ActionForm action={reviewDriverApplicationAction} submit="Save decision" confirm="Save this decision? Approving creates a driver account and emails the applicant.">
                <input type="hidden" name="id" value={app.id} />
                <select name="decision" defaultValue={app.status === "submitted" ? "under_review" : app.status} className="field"><option value="under_review">Under review</option><option value="approved">Approve</option><option value="rejected">Reject</option></select>
                <select name="home_area_id" className="field" defaultValue=""><option value="">Home area (optional)</option>{areas?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                <textarea name="notes" rows={3} defaultValue={app.reviewer_notes ?? ""} placeholder="Internal review notes (background check, insurance verified…)" className="field" />
              </ActionForm>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
