import Link from "next/link";
import { EmptyState, StatusBadge } from "@/components/ui";
import { formatCents } from "@/lib/pricing";
import type { ShipmentStatus } from "@/lib/status";

export interface ShipmentRow {
  id: string;
  tracking_number: string;
  status: ShipmentStatus;
  created_at: string;
  pickup_city: string;
  delivery_city: string;
  recipient_name: string;
  total_cents: number;
  payment_status: string;
  pickup_date?: string;
}

export function ShipmentTable({ rows, base, empty = "No shipments yet." }: { rows: ShipmentRow[]; base: string; empty?: string }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <div className="overflow-x-auto rounded-xl border border-beige bg-white">
      <table className="table">
        <thead><tr><th>Tracking</th><th>Status</th><th>Route</th><th className="hidden md:table-cell">Recipient</th><th className="hidden md:table-cell">Created</th><th className="text-right">Total</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Link href={`${base}/${r.id}`} className="font-mono font-semibold text-charcoal underline-offset-2 hover:underline">{r.tracking_number}</Link></td>
              <td><StatusBadge status={r.status} />{["unpaid", "pending", "failed"].includes(r.payment_status) && <span className="ml-1 text-xs text-warning">· {r.payment_status === "failed" ? "payment failed" : "unpaid"}</span>}</td>
              <td className="whitespace-nowrap">{r.pickup_city} → {r.delivery_city}</td>
              <td className="hidden md:table-cell">{r.recipient_name}</td>
              <td className="hidden whitespace-nowrap md:table-cell">{new Date(r.created_at).toLocaleDateString("en-CA")}</td>
              <td className="text-right">{formatCents(r.total_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const SHIPMENT_LIST_COLUMNS = "id, tracking_number, status, created_at, pickup_city, delivery_city, recipient_name, total_cents, payment_status, pickup_date";
