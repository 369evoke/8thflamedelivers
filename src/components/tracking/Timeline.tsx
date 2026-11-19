import { STATUS_LABELS, statusTone, type ShipmentStatus } from "@/lib/status";

export interface TimelineEvent { status: ShipmentStatus; at: string; location?: string | null; notes?: string | null; actor?: string | null; internal?: string | null; signed_by?: string | null }

const dot = { neutral: "bg-muted", gold: "bg-gold", success: "bg-success", warning: "bg-warning", danger: "bg-danger" };

export function Timeline({ events, showActor = false }: { events: TimelineEvent[]; showActor?: boolean }) {
  const list = [...events].reverse();
  if (!list.length) return <p className="text-sm text-muted">No tracking events recorded yet.</p>;
  return (
    <ol className="relative ml-2 border-l-2 border-beige">
      {list.map((e, i) => (
        <li key={i} className="mb-6 ml-6 last:mb-0">
          <span className={`absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-white ${dot[statusTone(e.status)]} ${i === 0 ? "ring-4 ring-gold/20" : ""}`} />
          <p className={`font-semibold ${i === 0 ? "" : "text-charcoal/80"}`}>{STATUS_LABELS[e.status]}</p>
          <p className="text-xs text-muted">{new Date(e.at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}{e.location && ` · ${e.location}`}</p>
          {e.notes && <p className="mt-1 text-sm">{e.notes}</p>}
          {e.signed_by && <p className="mt-1 text-sm text-muted">Received by {e.signed_by}</p>}
          {showActor && e.actor && <p className="mt-1 text-xs text-muted">By {e.actor}</p>}
          {e.internal && <p className="mt-1 rounded bg-beige/60 px-2 py-1 text-xs">Internal: {e.internal}</p>}
        </li>
      ))}
    </ol>
  );
}
