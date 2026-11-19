"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button } from "@/components/ui";
import { bulkUploadAction, type BulkResult } from "@/app/actions/business";

export function BulkUpload({ businessId, addresses, windows, defaultDate }: { businessId: string; defaultDate: string; addresses: { id: string; label: string | null; contact_name: string; street: string; city: string }[]; windows: string[] }) {
  const [s, act, pending] = useActionState<BulkResult, FormData>(bulkUploadAction, {});
  return (
    <div className="space-y-4">
      <form action={act} className="space-y-3">
        {s.error && <Alert tone="danger">{s.error}</Alert>}
        <input type="hidden" name="business_id" value={businessId} />
        <label className="label" htmlFor="pickup">Pickup address</label>
        {addresses.length ? (
          <select id="pickup" name="pickup_address_id" className="field">{addresses.map((a) => <option key={a.id} value={a.id}>{a.label || a.contact_name} — {a.street}, {a.city}</option>)}</select>
        ) : <Alert tone="warning">Add a pickup address under <Link href="/business/portal/addresses" className="underline">Saved Addresses</Link> first.</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="pd">Default pickup date</label><input id="pd" type="date" name="pickup_date" defaultValue={defaultDate} className="field" /></div>
          <div><label className="label" htmlFor="pw">Default window</label><select id="pw" name="pickup_window" className="field">{windows.map((w) => <option key={w}>{w}</option>)}</select></div>
        </div>
        <input type="file" name="file" accept=".csv,text/csv" className="field" required />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="ack" className="mt-1" /> I confirm none of these shipments contain restricted items.</label>
        <Button disabled={pending || !addresses.length}>{pending ? "Processing rows…" : "Upload & create shipments"}</Button>
      </form>
      {s.success && <Alert tone="success">{s.success}</Alert>}
      {s.rows && (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-beige">
          <table className="table"><thead><tr><th>Row</th><th>Result</th></tr></thead>
            <tbody>{s.rows.map((r) => <tr key={r.row}><td>{r.row}</td><td className={r.ok ? "text-success" : "text-danger"}>{r.ok ? `✓ ${r.tracking}` : r.message}</td></tr>)}</tbody></table>
        </div>
      )}
    </div>
  );
}
