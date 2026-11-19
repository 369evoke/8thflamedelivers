"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Alert, Button, Field } from "@/components/ui";
import { PROVINCES } from "@/lib/validation";
import { submitBusinessApplication, submitContact, submitDriverApplication } from "@/app/actions/public";
import type { FormState } from "@/app/actions/auth";

function Provinces({ name = "province", def = "ON" }: { name?: string; def?: string }) {
  return (
    <select name={name} id={name} defaultValue={def} className="field">
      {PROVINCES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
    </select>
  );
}

function Status({ s }: { s: FormState }) {
  if (s.success) return <Alert tone="success">{s.success}</Alert>;
  if (s.error) return <Alert tone="danger">{s.error}</Alert>;
  return null;
}

export function DriverApplicationForm() {
  const [s, act, pending] = useActionState(submitDriverApplication, {});
  const e = s.fieldErrors ?? {};
  if (s.success) return <Status s={s} />;
  return (
    <form action={act} className="grid gap-4 sm:grid-cols-2" encType="multipart/form-data">
      <div className="sm:col-span-2"><Status s={s} /></div>
      <Field label="Full name" name="full_name" error={e.full_name}><input id="full_name" name="full_name" className="field" required autoComplete="name" /></Field>
      <Field label="Email" name="email" error={e.email}><input id="email" name="email" type="email" className="field" required autoComplete="email" /></Field>
      <Field label="Phone" name="phone" error={e.phone}><input id="phone" name="phone" type="tel" className="field" required autoComplete="tel" /></Field>
      <Field label="Street address" name="address" error={e.address}><input id="address" name="address" className="field" required autoComplete="street-address" /></Field>
      <Field label="City" name="city" error={e.city}><input id="city" name="city" className="field" required /></Field>
      <Field label="Province" name="province"><Provinces /></Field>
      <Field label="Vehicle type" name="vehicle_type" error={e.vehicle_type}>
        <select id="vehicle_type" name="vehicle_type" className="field">{["Car", "Minivan", "Cargo van", "Box truck", "Pickup truck"].map((v) => <option key={v}>{v}</option>)}</select>
      </Field>
      <Field label="Vehicle make, model & year" name="vehicle_info" error={e.vehicle_info}><input id="vehicle_info" name="vehicle_info" className="field" /></Field>
      <Field label="Years of delivery/driving experience" name="experience_years" error={e.experience_years}><input id="experience_years" name="experience_years" type="number" min={0} max={60} defaultValue={0} className="field" /></Field>
      <Field label="Availability" name="availability" error={e.availability} hint="Days and hours you can work"><input id="availability" name="availability" className="field" required /></Field>
      <div className="sm:col-span-2">
        <Field label="Qualifications" name="qualifications" error={e.qualifications} hint="Licence class, commercial insurance, certifications, languages"><textarea id="qualifications" name="qualifications" rows={3} className="field" /></Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Documents" name="documents" error={e.documents} hint="Driver's licence, proof of insurance, vehicle registration. PDF/JPG/PNG, up to 10 MB each, max 5 files. Stored privately.">
          <input id="documents" name="documents" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="field" />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="consent" className="mt-1" />
        <span>I consent to 8th Flame Delivery collecting and reviewing this information and my documents to assess my application, as described in the <Link href="/privacy" className="underline">Privacy Policy</Link>.</span>
      </label>
      {e.consent && <p className="text-xs text-danger sm:col-span-2">{e.consent}</p>}
      <div className="sm:col-span-2"><Button disabled={pending}>{pending ? "Submitting…" : "Submit application"}</Button></div>
    </form>
  );
}

export function BusinessApplicationForm() {
  const [s, act, pending] = useActionState(submitBusinessApplication, {});
  const e = s.fieldErrors ?? {};
  if (s.success) return <Status s={s} />;
  return (
    <form action={act} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Status s={s} /></div>
      <Field label="Business name" name="name" error={e.name}><input id="name" name="name" className="field" required autoComplete="organization" /></Field>
      <Field label="Business email" name="email" error={e.email}><input id="email" name="email" type="email" className="field" required /></Field>
      <Field label="Contact person" name="contact_name" error={e.contact_name}><input id="contact_name" name="contact_name" className="field" required /></Field>
      <Field label="Phone" name="phone" error={e.phone}><input id="phone" name="phone" type="tel" className="field" required /></Field>
      <Field label="Business address" name="address" error={e.address}><input id="address" name="address" className="field" required /></Field>
      <Field label="City" name="city" error={e.city}><input id="city" name="city" className="field" required /></Field>
      <Field label="Province" name="province"><Provinces /></Field>
      <Field label="Business type" name="business_type" error={e.business_type}>
        <select id="business_type" name="business_type" className="field">{["Retailer", "Online store", "Wholesaler", "Corporate", "Healthcare", "Other"].map((v) => <option key={v}>{v}</option>)}</select>
      </Field>
      <Field label="Estimated shipments per month" name="estimated_monthly_volume" error={e.estimated_monthly_volume}><input id="estimated_monthly_volume" name="estimated_monthly_volume" type="number" min={0} className="field" required /></Field>
      <div className="sm:col-span-2"><Button disabled={pending}>{pending ? "Submitting…" : "Apply for a business account"}</Button></div>
    </form>
  );
}

export function ContactForm({ defaultEmail = "", defaultName = "" }: { defaultEmail?: string; defaultName?: string }) {
  const [s, act, pending] = useActionState(submitContact, {});
  const e = s.fieldErrors ?? {};
  if (s.success) return <Status s={s} />;
  return (
    <form action={act} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Status s={s} /></div>
      <Field label="Name" name="name" error={e.name}><input id="name" name="name" defaultValue={defaultName} className="field" required /></Field>
      <Field label="Email" name="email" error={e.email}><input id="email" name="email" type="email" defaultValue={defaultEmail} className="field" required /></Field>
      <Field label="Topic" name="category">
        <select id="category" name="category" className="field">
          <option value="general">General question</option>
          <option value="missing_shipment">Missing shipment</option>
          <option value="delayed_shipment">Delayed shipment</option>
          <option value="damage">Damaged package</option>
          <option value="billing">Billing</option>
          <option value="business">Business accounts</option>
          <option value="driver">Driver opportunities</option>
        </select>
      </Field>
      <Field label="Tracking number (optional)" name="tracking_number" error={e.tracking_number}><input id="tracking_number" name="tracking_number" className="field font-mono uppercase" /></Field>
      <div className="sm:col-span-2"><Field label="Subject" name="subject" error={e.subject}><input id="subject" name="subject" className="field" required /></Field></div>
      <div className="sm:col-span-2"><Field label="Message" name="message" error={e.message}><textarea id="message" name="message" rows={5} className="field" required /></Field></div>
      <div className="sm:col-span-2"><Button disabled={pending}>{pending ? "Sending…" : "Send message"}</Button></div>
    </form>
  );
}
