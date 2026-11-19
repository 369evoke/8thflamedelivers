import { Card } from "@/components/ui";
import { ActionForm } from "@/components/forms/ActionForm";
import { assignDriverAction, confirmShipmentAction, internalNoteAction, refundAction, schedulePickupAction, staffCancelAction, staffStatusAction } from "@/app/actions/ops";
import { hasPermission, type Role } from "@/lib/permissions";
import { STATUS_LABELS, TRANSITIONS, type ShipmentStatus } from "@/lib/status";
import type { DriverOption } from "@/lib/ops-data";

export function StaffShipmentActions({ role, s, drivers, payments, scheduled }: { role: Role; s: { id: string; status: ShipmentStatus; payment_status: string; pickup_date: string; pickup_window: string }; drivers: DriverOption[]; payments: { id: string; status: string; amount_cents: number; provider: string }[]; scheduled: boolean }) {
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(role, p);
  const paid = ["paid", "invoiced"].includes(s.payment_status);
  const next = TRANSITIONS[s.status].filter((x) => x !== "cancelled");
  const [ws, we] = s.pickup_window.split("-");
  const refundable = payments.filter((p) => p.provider === "stripe" && ["paid", "partially_refunded"].includes(p.status));
  const done = ["delivered", "cancelled", "returned_to_sender"].includes(s.status);

  return (
    <Card className="space-y-6 p-6">
      <h2 className="font-bold">Operations</h2>
      {!paid && <p className="rounded bg-warning/10 px-3 py-2 text-sm text-warning">Payment not verified ({s.payment_status}). Operational actions unlock once paid.</p>}
      {paid && can("shipments.confirm") && s.status === "awaiting_confirmation" && (
        <ActionForm action={confirmShipmentAction} submit="Confirm booking" variant="gold"><input type="hidden" name="id" value={s.id} /></ActionForm>
      )}
      {paid && can("dispatch.assign") && !done && (
        <details open={!scheduled}><summary className="cursor-pointer text-sm font-semibold">Schedule pickup</summary>
          <ActionForm action={schedulePickupAction} submit="Save schedule" className="mt-3 space-y-2">
            <input type="hidden" name="id" value={s.id} />
            <input type="date" name="date" defaultValue={s.pickup_date} className="field" />
            <div className="grid grid-cols-2 gap-2"><input type="time" name="start" defaultValue={ws} className="field" /><input type="time" name="end" defaultValue={we} className="field" /></div>
            <input name="notes" placeholder="Notes" className="field" />
          </ActionForm>
        </details>
      )}
      {paid && can("dispatch.assign") && !done && !["shipment_created", "awaiting_confirmation"].includes(s.status) && (
        <details open><summary className="cursor-pointer text-sm font-semibold">Assign / reassign driver</summary>
          <ActionForm action={assignDriverAction} submit="Assign" className="mt-3 space-y-2">
            <input type="hidden" name="id" value={s.id} />
            <select name="driver_id" className="field" required defaultValue="">
              <option value="" disabled>Choose an approved driver</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.available ? "available" : "off"}, {d.active} active{d.area ? `, ${d.area}` : ""}</option>)}
            </select>
            <select name="assignment_type" className="field"><option value="full">Pickup & delivery</option><option value="pickup">Pickup only</option><option value="delivery">Delivery only</option></select>
            <input name="notes" placeholder="Note to driver (optional)" className="field" />
          </ActionForm>
        </details>
      )}
      {paid && can("shipments.update_status") && next.length > 0 && (
        <details><summary className="cursor-pointer text-sm font-semibold">Update status</summary>
          <ActionForm action={staffStatusAction} submit="Record status" className="mt-3 space-y-2">
            <input type="hidden" name="id" value={s.id} />
            <select name="status" className="field">{next.map((x) => <option key={x} value={x}>{STATUS_LABELS[x]}</option>)}</select>
            <input name="location" placeholder="Location (e.g. Toronto facility)" className="field" />
            <textarea name="notes" rows={2} placeholder="Notes" className="field" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="public" defaultChecked /> Show note to customer</label>
          </ActionForm>
        </details>
      )}
      {can("shipments.notes") && (
        <details><summary className="cursor-pointer text-sm font-semibold">Add internal note</summary>
          <ActionForm action={internalNoteAction} submit="Add note" resetOnSuccess className="mt-3 space-y-2"><input type="hidden" name="id" value={s.id} /><textarea name="note" rows={2} className="field" /></ActionForm>
        </details>
      )}
      {can("payments.refund") && refundable.map((p) => (
        <details key={p.id}><summary className="cursor-pointer text-sm font-semibold">Refund payment</summary>
          <ActionForm action={refundAction} submit="Issue refund" variant="danger" confirm="Issue this refund through Stripe?" className="mt-3 space-y-2">
            <input type="hidden" name="payment_id" value={p.id} />
            <input name="amount" type="number" step="0.01" min="0.01" defaultValue={(p.amount_cents / 100).toFixed(2)} className="field" />
            <input name="reason" placeholder="Reason" className="field" required />
          </ActionForm>
        </details>
      ))}
      {can("shipments.cancel") && !done && (
        <details><summary className="cursor-pointer text-sm font-semibold text-danger">Cancel shipment</summary>
          <ActionForm action={staffCancelAction} submit="Cancel shipment" variant="danger" confirm="Cancel this shipment? The customer will be notified." className="mt-3 space-y-2">
            <input type="hidden" name="id" value={s.id} /><input name="reason" placeholder="Reason (internal)" className="field" required />
          </ActionForm>
        </details>
      )}
    </Card>
  );
}
