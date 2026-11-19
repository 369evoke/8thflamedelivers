import { DashTitle } from "@/components/dashboard/Shell";
import { Card, EmptyState, Button } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createUserClient } from "@/lib/supabase/server";
import { markNotificationsReadAction } from "@/app/actions/customer";

export default async function Notifications() {
  const u = await requireUser();
  const db = await createUserClient();
  const { data } = await db.from("notifications").select("id, subject, body, created_at, read_at").eq("profile_id", u.id).order("created_at", { ascending: false }).limit(100);
  return (
    <>
      <DashTitle title="Notifications" actions={data?.some((n) => !n.read_at) ? <form action={markNotificationsReadAction}><Button variant="outline">Mark all read</Button></form> : null} />
      {!data?.length ? <EmptyState title="No notifications yet" body="Shipment updates we email you will also appear here." /> : (
        <div className="space-y-3">
          {data.map((n) => (
            <Card key={n.id} className={n.read_at ? "opacity-75" : "border-gold/50"}>
              <div className="flex justify-between gap-3"><p className="font-semibold">{n.subject}</p><p className="shrink-0 text-xs text-muted">{new Date(n.created_at).toLocaleString("en-CA")}</p></div>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{n.body}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
