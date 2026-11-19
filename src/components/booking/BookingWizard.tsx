"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Plus, Trash2, Loader2 } from "lucide-react";
import { Alert, Button, Card, Field } from "@/components/ui";
import { HANDLING_OPTIONS, PACKAGE_TYPES, PROVINCES } from "@/lib/validation";
import { formatCents, type PriceBreakdown } from "@/lib/pricing";

interface Addr { name: string; phone: string; email: string; street: string; unit: string; city: string; province: string; postal: string; instructions: string }
interface Pkg { package_type: string; description: string; quantity: number; weight_kg: string; length_cm: string; width_cm: string; height_cm: string; special_handling: string[] }
interface Option { code: string; name: string; description: string | null; same_day: boolean; transit_days: number; price: PriceBreakdown | null; error: string | null }
interface Quote { distance_km: number; distance_source: string; route: { from: string; to: string }; promo_applied: boolean; invoicing_available: boolean; options: Option[] }
export interface SavedAddress { id: string; label: string | null; contact_name: string; phone: string | null; email: string | null; street: string; unit: string | null; city: string; province: string; postal_code: string; instructions: string | null }

const emptyAddr = (p: Partial<Addr> = {}): Addr => ({ name: "", phone: "", email: "", street: "", unit: "", city: "", province: "ON", postal: "", instructions: "", ...p });
const emptyPkg = (): Pkg => ({ package_type: "Small box", description: "", quantity: 1, weight_kg: "", length_cm: "", width_cm: "", height_cm: "", special_handling: [] });

const STEPS = ["Pickup", "Delivery", "Packages", "Service", "Quote", "Your details", "Payment"];

export function BookingWizard({
  mode = "book",
  user,
  pickupWindows,
  savedAddresses = [],
  businessId,
}: {
  mode?: "book" | "quote";
  user: { email: string; name: string; phone: string } | null;
  pickupWindows: string[];
  savedAddresses?: SavedAddress[];
  businessId?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(0);
  const [sender, setSender] = useState<Addr>(emptyAddr({ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" }));
  const [recipient, setRecipient] = useState<Addr>(emptyAddr());
  const [pickupDate, setPickupDate] = useState(today);
  const [pickupWindow, setPickupWindow] = useState(pickupWindows[0] ?? "");
  const [pkgs, setPkgs] = useState<Pkg[]>([emptyPkg()]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [service, setService] = useState("");
  const [promo, setPromo] = useState("");
  const [billing, setBilling] = useState<"card" | "invoice">("card");
  const [ack, setAck] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const steps = mode === "quote" ? STEPS.slice(0, 5) : STEPS;
  const selected = quote?.options.find((o) => o.code === service);

  const pkgPayload = useMemo(
    () => pkgs.map((p) => ({ ...p, quantity: Number(p.quantity), weight_kg: Number(p.weight_kg), length_cm: Number(p.length_cm), width_cm: Number(p.width_cm), height_cm: Number(p.height_cm) })),
    [pkgs],
  );

  function validateAddr(a: Addr, prefix: string, requireEmail: boolean) {
    const e: Record<string, string> = {};
    if (mode !== "quote" || prefix === "x") {
      if (a.name.trim().length < 2) e[prefix + "name"] = "Required";
      if (a.phone.replace(/\D/g, "").length < 10) e[prefix + "phone"] = "Enter a valid phone";
      if (requireEmail && !/^\S+@\S+\.\S+$/.test(a.email)) e[prefix + "email"] = "Enter a valid email";
      if (a.street.trim().length < 3) e[prefix + "street"] = "Required";
    }
    if (a.city.trim().length < 2) e[prefix + "city"] = "Required";
    if (!/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(a.postal.trim())) e[prefix + "postal"] = "Enter a valid postal code (A1A 1A1)";
    return e;
  }

  function validatePkgs() {
    const e: Record<string, string> = {};
    pkgs.forEach((p, i) => {
      if (p.description.trim().length < 3) e[`p${i}description`] = "Describe the contents";
      (["weight_kg", "length_cm", "width_cm", "height_cm"] as const).forEach((k) => { if (!(Number(p[k]) > 0)) e[`p${i}${k}`] = "Required"; });
      if (!(p.quantity >= 1)) e[`p${i}quantity`] = "Min 1";
    });
    return e;
  }

  async function fetchQuote() {
    setBusy(true);
    setErrors([]);
    try {
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: { city: sender.city, province: sender.province, postal: sender.postal },
          delivery: { city: recipient.city, province: recipient.province, postal: recipient.postal },
          packages: pkgPayload,
          promo_code: promo || undefined,
          business_id: businessId,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErrors([j.error, ...(j.details ?? [])].filter(Boolean));
        return false;
      }
      setQuote(j);
      const firstOk = (j.options as Option[]).find((o) => o.price);
      if (!j.options.some((o: Option) => o.code === service && o.price)) setService(firstOk?.code ?? "");
      return true;
    } catch {
      setErrors(["Network error — please try again."]);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    setErrors([]);
    let fe: Record<string, string> = {};
    if (step === 0) {
      fe = validateAddr(sender, "s_", true);
      if (mode === "book" && (!pickupDate || pickupDate < today)) fe.pickup_date = "Choose today or a future date";
    }
    if (step === 1) fe = validateAddr(recipient, "r_", false);
    if (step === 2) fe = validatePkgs();
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    if (step === 2 && !(await fetchQuote())) return;
    if (step === 3 && !selected?.price) return setErrors(["Choose an available service."]);
    setStep((s) => Math.min(s + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!ack) return setErrors(["Please confirm your shipment contains no restricted items."]);
    setBusy(true);
    setErrors([]);
    try {
      const r = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { ...sender },
          recipient: { ...recipient },
          pickup_date: pickupDate,
          pickup_window: pickupWindow,
          packages: pkgPayload,
          service_code: service,
          promo_code: promo || undefined,
          business_id: businessId,
          billing_method: billing,
          restricted_items_ack: true,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErrors([j.error, ...(j.details ?? [])].filter(Boolean));
        setBusy(false);
        return;
      }
      window.location.href = j.redirect;
    } catch {
      setErrors(["Network error — you have not been charged. Please try again."]);
      setBusy(false);
    }
  }

  const A = (a: Addr, set: (a: Addr) => void, prefix: string, who: "sender" | "recipient") => {
    const f = (k: keyof Addr, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
      <Field label={label} name={prefix + k} error={fieldErr[prefix + k]}>
        <input id={prefix + k} className="field" value={a[k]} aria-invalid={!!fieldErr[prefix + k]} onChange={(e) => set({ ...a, [k]: e.target.value })} {...props} />
      </Field>
    );
    const full = mode === "book";
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {full && savedAddresses.length > 0 && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor={prefix + "saved"}>Use a saved address</label>
            <select id={prefix + "saved"} className="field" defaultValue="" onChange={(e) => {
              const s = savedAddresses.find((x) => x.id === e.target.value);
              if (s) set({ name: s.contact_name, phone: s.phone ?? "", email: s.email ?? "", street: s.street, unit: s.unit ?? "", city: s.city, province: s.province, postal: s.postal_code, instructions: s.instructions ?? "" });
            }}>
              <option value="">—</option>
              {savedAddresses.map((s) => <option key={s.id} value={s.id}>{s.label || s.contact_name} — {s.street}, {s.city}</option>)}
            </select>
          </div>
        )}
        {full && f("name", who === "sender" ? "Sender name" : "Recipient name", { autoComplete: "name" })}
        {full && f("phone", who === "sender" ? "Sender phone" : "Recipient phone", { type: "tel", autoComplete: "tel" })}
        {full && f("email", who === "sender" ? "Sender email" : "Recipient email (optional)", { type: "email", autoComplete: "email" })}
        {full && f("street", "Street address", { autoComplete: "address-line1" })}
        {full && f("unit", "Apartment / unit (optional)")}
        {f("city", "City", { autoComplete: "address-level2" })}
        <Field label="Province" name={prefix + "province"}>
          <select id={prefix + "province"} className="field" value={a.province} onChange={(e) => set({ ...a, province: e.target.value })}>
            {PROVINCES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </Field>
        {f("postal", "Postal code", { autoComplete: "postal-code", placeholder: "A1A 1A1", className: "field uppercase" })}
        {full && (
          <div className="sm:col-span-2">
            <Field label={who === "sender" ? "Pickup instructions (optional)" : "Delivery instructions (optional)"} name={prefix + "instructions"}>
              <textarea id={prefix + "instructions"} rows={2} className="field" value={a.instructions} onChange={(e) => set({ ...a, instructions: e.target.value })} />
            </Field>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <ol className="mb-6 flex flex-wrap gap-2" aria-label="Booking progress">
          {steps.map((s, i) => (
            <li key={s} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${i === step ? "bg-charcoal text-ivory" : i < step ? "bg-gold/20 text-gold-dark" : "bg-beige text-muted"}`} aria-current={i === step ? "step" : undefined}>
              {i < step ? <Check size={12} /> : <span>{i + 1}</span>} {s}
            </li>
          ))}
        </ol>

        <Card className="p-5 md:p-7">
          {errors.length > 0 && (
            <div className="mb-5"><Alert tone="danger"><ul className="list-inside list-disc space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Alert></div>
          )}

          {step === 0 && (
            <>
              <h2 className="mb-5 text-xl font-bold">{mode === "quote" ? "Where are we picking up?" : "Pickup details"}</h2>
              {A(sender, setSender, "s_", "sender")}
              {mode === "book" && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Preferred pickup date" name="pickup_date" error={fieldErr.pickup_date}><input id="pickup_date" type="date" min={today} className="field" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} /></Field>
                  <Field label="Preferred pickup time window" name="pickup_window">
                    <select id="pickup_window" className="field" value={pickupWindow} onChange={(e) => setPickupWindow(e.target.value)}>
                      {pickupWindows.map((w) => <option key={w} value={w}>{w.replace("-", " – ")}</option>)}
                    </select>
                  </Field>
                </div>
              )}
            </>
          )}

          {step === 1 && (<><h2 className="mb-5 text-xl font-bold">{mode === "quote" ? "Where is it going?" : "Delivery details"}</h2>{A(recipient, setRecipient, "r_", "recipient")}</>)}

          {step === 2 && (
            <>
              <h2 className="mb-1 text-xl font-bold">Package information</h2>
              <p className="mb-5 text-sm text-muted">Add each distinct package. Use quantity for identical boxes.</p>
              <div className="space-y-5">
                {pkgs.map((p, i) => {
                  const up = (patch: Partial<Pkg>) => setPkgs(pkgs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  const num = (k: "weight_kg" | "length_cm" | "width_cm" | "height_cm", label: string) => (
                    <Field label={label} name={`p${i}${k}`} error={fieldErr[`p${i}${k}`]}>
                      <input id={`p${i}${k}`} type="number" inputMode="decimal" min="0" step="0.1" className="field" value={p[k]} onChange={(e) => up({ [k]: e.target.value })} />
                    </Field>
                  );
                  return (
                    <fieldset key={i} className="rounded-lg border border-beige p-4">
                      <legend className="px-1 text-sm font-bold">Package {i + 1}</legend>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Type" name={`p${i}type`}>
                          <select id={`p${i}type`} className="field" value={p.package_type} onChange={(e) => up({ package_type: e.target.value })}>{PACKAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                        </Field>
                        <div className="sm:col-span-2"><Field label="Contents description" name={`p${i}description`} error={fieldErr[`p${i}description`]}><input id={`p${i}description`} className="field" value={p.description} onChange={(e) => up({ description: e.target.value })} placeholder="e.g. Books, clothing, documents" /></Field></div>
                        <Field label="Quantity" name={`p${i}quantity`} error={fieldErr[`p${i}quantity`]}><input id={`p${i}quantity`} type="number" min={1} max={100} className="field" value={p.quantity} onChange={(e) => up({ quantity: Number(e.target.value) })} /></Field>
                        {num("weight_kg", "Weight each (kg)")}
                        <div className="hidden sm:block" />
                        {num("length_cm", "Length (cm)")}
                        {num("width_cm", "Width (cm)")}
                        {num("height_cm", "Height (cm)")}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                        {HANDLING_OPTIONS.map(([code, label]) => (
                          <label key={code} className="flex items-center gap-2">
                            <input type="checkbox" checked={p.special_handling.includes(code)} onChange={(e) => up({ special_handling: e.target.checked ? [...p.special_handling, code] : p.special_handling.filter((h) => h !== code) })} /> {label}
                          </label>
                        ))}
                      </div>
                      {pkgs.length > 1 && <button type="button" onClick={() => setPkgs(pkgs.filter((_, j) => j !== i))} className="mt-3 inline-flex items-center gap-1 text-sm text-danger"><Trash2 size={14} /> Remove</button>}
                    </fieldset>
                  );
                })}
              </div>
              {pkgs.length < 25 && <Button type="button" variant="outline" className="mt-4" onClick={() => setPkgs([...pkgs, emptyPkg()])}><Plus size={16} /> Add another package</Button>}
              <p className="mt-4 text-xs text-muted">Restricted items (weapons, explosives, flammables, cannabis, alcohol, cash, live animals and other hazardous goods) cannot be shipped. <Link href="/faq" className="underline">See the full list</Link>.</p>
            </>
          )}

          {step === 3 && quote && (
            <>
              <h2 className="mb-1 text-xl font-bold">Choose a service</h2>
              <p className="mb-5 text-sm text-muted">{quote.route.from} → {quote.route.to} · {quote.distance_km} km {quote.distance_source === "estimate" && "(estimated)"}</p>
              <div className="space-y-3" role="radiogroup">
                {quote.options.length === 0 && <Alert tone="warning">No services are available for this route right now. Please contact us.</Alert>}
                {quote.options.map((o) => (
                  <label key={o.code} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${service === o.code ? "border-gold bg-gold/5" : "border-beige"} ${!o.price ? "cursor-not-allowed opacity-60" : ""}`}>
                    <input type="radio" name="service" value={o.code} disabled={!o.price} checked={service === o.code} onChange={() => setService(o.code)} className="mt-1" />
                    <span className="flex-1">
                      <span className="font-bold">{o.name}</span>
                      <span className="block text-sm text-muted">{o.description}</span>
                      <span className="block text-xs text-muted">{o.same_day ? "Same business day" : `Est. ${o.transit_days} business day${o.transit_days === 1 ? "" : "s"}`}</span>
                      {o.error && <span className="block text-sm text-danger">{o.error}</span>}
                    </span>
                    {o.price && <span className="font-display text-lg font-extrabold">{formatCents(o.price.total_cents)}</span>}
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 4 && selected?.price && (
            <>
              <h2 className="mb-5 text-xl font-bold">Your shipping quote</h2>
              <Breakdown p={selected.price} />
              <div className="mt-5 flex items-end gap-2">
                <div className="flex-1"><Field label="Promo code" name="promo"><input id="promo" className="field uppercase" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} /></Field></div>
                <Button type="button" variant="outline" onClick={fetchQuote} disabled={busy || !promo}>Apply</Button>
              </div>
              {promo && quote && !quote.promo_applied && !busy && <p className="mt-1 text-xs text-muted">Press Apply to check the code.</p>}
              {quote?.promo_applied && <p className="mt-1 text-xs text-success">Promo applied.</p>}
              {mode === "quote" && (
                <div className="mt-6 flex flex-wrap gap-3"><Link href="/ship" className="rounded-lg bg-charcoal px-5 py-2.5 text-sm font-semibold text-ivory">Book this shipment</Link><p className="self-center text-xs text-muted">Quotes are estimates until booking; the final price is recalculated securely at checkout.</p></div>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="mb-5 text-xl font-bold">Your details</h2>
              {user ? (
                <Alert>Booking as <strong>{user.email}</strong>. This shipment will appear in your account.</Alert>
              ) : (
                <div className="space-y-3">
                  <Alert>You&apos;re checking out as a guest. Your confirmation and tracking details will be emailed to <strong>{sender.email}</strong>.</Alert>
                  <p className="text-sm">Want your history and saved addresses? <Link href="/sign-in?next=/ship" className="font-semibold underline">Sign in</Link> or <Link href="/sign-up" className="font-semibold underline">create an account</Link> first.</p>
                </div>
              )}
              {businessId && quote?.invoicing_available && (
                <fieldset className="mt-5"><legend className="label">Billing</legend>
                  <label className="mr-6 inline-flex items-center gap-2 text-sm"><input type="radio" checked={billing === "card"} onChange={() => setBilling("card")} /> Pay by card now</label>
                  <label className="inline-flex items-center gap-2 text-sm"><input type="radio" checked={billing === "invoice"} onChange={() => setBilling("invoice")} /> Add to business invoice</label>
                </fieldset>
              )}
            </>
          )}

          {step === 6 && selected?.price && (
            <>
              <h2 className="mb-5 text-xl font-bold">Review & pay</h2>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="font-semibold">Pickup</dt><dd className="text-muted">{sender.name}<br />{sender.unit && `${sender.unit}-`}{sender.street}, {sender.city} {sender.province} {sender.postal}<br />{pickupDate} · {pickupWindow}</dd></div>
                <div><dt className="font-semibold">Delivery</dt><dd className="text-muted">{recipient.name}<br />{recipient.unit && `${recipient.unit}-`}{recipient.street}, {recipient.city} {recipient.province} {recipient.postal}</dd></div>
                <div><dt className="font-semibold">Packages</dt><dd className="text-muted">{pkgs.reduce((s, p) => s + Number(p.quantity), 0)} package(s), {selected.price.actual_weight_kg} kg</dd></div>
                <div><dt className="font-semibold">Service</dt><dd className="text-muted">{selected.name}</dd></div>
              </dl>
              <label className="mt-6 flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>I confirm this shipment contains no restricted or prohibited items and I accept the <Link href="/terms" className="underline" target="_blank">Terms and Conditions</Link>.</span>
              </label>
              <Button className="mt-6 w-full py-3 text-base" onClick={submit} disabled={busy}>
                {busy ? <><Loader2 className="animate-spin" size={18} /> Processing…</> : billing === "invoice" ? `Book shipment — ${formatCents(selected.price.total_cents)} to invoice` : `Continue to secure payment — ${formatCents(selected.price.total_cents)}`}
              </Button>
              {billing === "card" && <p className="mt-2 text-center text-xs text-muted">You&apos;ll be redirected to Stripe. Your shipment is confirmed only after payment is verified.</p>}
            </>
          )}

          <div className="mt-8 flex justify-between border-t border-beige pt-5">
            <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>Back</Button>
            {step < steps.length - 1 && (
              <Button type="button" onClick={next} disabled={busy}>{busy ? <><Loader2 className="animate-spin" size={16} /> Calculating…</> : step === 2 ? "Get prices" : "Continue"}</Button>
            )}
          </div>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <p className="eyebrow">Summary</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><span className="text-muted">From:</span> {sender.city || "—"} {sender.postal}</li>
            <li><span className="text-muted">To:</span> {recipient.city || "—"} {recipient.postal}</li>
            <li><span className="text-muted">Packages:</span> {pkgs.reduce((s, p) => s + Number(p.quantity || 0), 0)}</li>
            <li><span className="text-muted">Service:</span> {selected?.name ?? "—"}</li>
          </ul>
          {selected?.price && <p className="mt-4 border-t border-beige pt-4 font-display text-2xl font-extrabold">{formatCents(selected.price.total_cents)}</p>}
        </Card>
      </aside>
    </div>
  );
}

export function Breakdown({ p }: { p: PriceBreakdown }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {p.lines.map((l) => (<tr key={l.label}><td className="py-1.5 text-muted">{l.label}</td><td className="py-1.5 text-right">{formatCents(l.amount_cents)}</td></tr>))}
        <tr className="border-t border-beige"><td className="py-1.5 font-semibold">Subtotal</td><td className="py-1.5 text-right font-semibold">{formatCents(p.subtotal_cents)}</td></tr>
        {p.discount_cents > 0 && <tr><td className="py-1.5 text-success">Discounts</td><td className="py-1.5 text-right text-success">−{formatCents(p.discount_cents)}</td></tr>}
        <tr><td className="py-1.5 text-muted">{p.tax_label}</td><td className="py-1.5 text-right">{formatCents(p.tax_cents)}</td></tr>
        <tr className="border-t-2 border-charcoal"><td className="py-2 font-bold">Total (CAD)</td><td className="py-2 text-right font-display text-lg font-extrabold">{formatCents(p.total_cents)}</td></tr>
      </tbody>
    </table>
  );
}
