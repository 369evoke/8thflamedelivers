"use client";
import { ActionForm } from "./ActionForm";
import { saveAddressAction } from "@/app/actions/customer";
import { PROVINCES } from "@/lib/validation";

export function AddressForm({ businessId }: { businessId?: string }) {
  return (
    <ActionForm action={saveAddressAction} submit="Save address" resetOnSuccess className="grid gap-3">
      {businessId && <input type="hidden" name="business_id" value={businessId} />}
      <input name="label" placeholder="Label (e.g. Home, Warehouse)" className="field" />
      <input name="contact_name" placeholder="Contact name" className="field" required />
      <div className="grid grid-cols-2 gap-3"><input name="phone" placeholder="Phone" className="field" /><input name="email" type="email" placeholder="Email" className="field" /></div>
      <input name="street" placeholder="Street address" className="field" required />
      <div className="grid grid-cols-2 gap-3"><input name="unit" placeholder="Unit" className="field" /><input name="city" placeholder="City" className="field" required /></div>
      <div className="grid grid-cols-2 gap-3">
        <select name="province" defaultValue="ON" className="field">{PROVINCES.map(([c]) => <option key={c}>{c}</option>)}</select>
        <input name="postal_code" placeholder="A1A 1A1" className="field uppercase" required />
      </div>
      <textarea name="instructions" placeholder="Instructions (optional)" rows={2} className="field" />
    </ActionForm>
  );
}
