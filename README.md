# 8th Flame Delivery

A full courier, parcel shipping and logistics platform for a company-run delivery business: customers and businesses book with 8th Flame, and the company's own staff handle dispatch, drivers and delivery.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, RLS) · Stripe Checkout + webhooks · Resend email · Google Maps Platform · Vercel

---

## What's in the box

| Area | Where | Highlights |
|---|---|---|
| Public website | `src/app/(public)` | 13 pages, responsive header + mobile menu, homepage tracking box, only **active** service areas shown |
| Booking | `/ship`, `/quote`, `components/booking/BookingWizard.tsx` | 7-step wizard, multiple packages, restricted-item + size/weight checks, guest or account checkout |
| Pricing engine | `src/lib/pricing.ts`, `src/lib/quote-service.ts` | Server-side only; base, per-km, per-kg over allowance, dimensional weight, minimum charge, surcharges, handling fees, area multiplier, intercity lane surcharge, business discount, promo codes, provincial tax. All rates live in the database |
| Payments | `api/shipments`, `api/stripe/webhook` | Stripe Checkout; shipment is marked **paid only by the signature-verified webhook**; amount checked against the stored total; refunds; failed/expired handling |
| Tracking | `/track/[number]`, `lib/tracking.ts` | Timeline built only from recorded events; public view strips names, addresses, phones and internal events; check-digit tracking numbers |
| Labels & receipts | `api/labels/[id]`, `api/receipts/[id]`, `api/invoices/[id]` | 4×6 thermal and letter PDFs, one page per package, Code 128 barcode + QR, logged on each generation |
| Customer portal | `/account/*` | Overview stats, shipments, cancel (policy-based, auto-refund), saved addresses, payments & receipts, notifications, support tickets, settings |
| Driver portal | `/driver/*` | Phone-first; assigned shipments only; navigate/call; barcode scan to confirm pickup (BarcodeDetector); status updates; failed attempts; exceptions; proof of delivery with photo + signature pad; routes; availability |
| Dispatch | `/dispatch/*` | Board (incoming, pending assignment, awaiting pickup, active, delayed, exceptions), confirm, schedule pickup, assign/reassign, routes with ordered stops, Google map |
| Business portal | `/business/portal/*` | Negotiated pricing, create shipment, CSV bulk upload (≤200 rows), history, labels, invoices, shared addresses, team members |
| Admin | `/admin/*` | All 21 sections; live KPIs and charts from real data; employee roles; audit log |
| Notifications | `lib/notify.ts` | Customer, driver, business and staff emails; every message logged (sent / failed / skipped); `channel` column ready for SMS |
| Database | `supabase/migrations` | 28 tables + `area_routes`, enums, indexes, constraints, triggers, RLS on every table, private storage buckets |

### Roles

`customer`, `driver`, `super_admin`, `operations_manager`, `dispatcher`, `support`, `finance`, plus business membership (`owner`/`admin`/`member`). Permissions are enforced in three places:
1. **Database RLS** — customers see their own shipments, drivers only their assigned ones, business members only their business's, staff per role.
2. **Server checks** — every server action and API route calls `assertPermission` / `assertDriver` / ownership checks *before* using the service-role client.
3. **UI** — navigation and buttons are hidden when not permitted (convenience only, never relied on).

Users can't change their own role: a database trigger blocks it.

---

## Setup (about 30 minutes)

### 1. Supabase
1. Create a project at supabase.com (region: **Canada (Central)** helps with data residency).
2. In **SQL Editor**, run the files in `supabase/migrations/` in order (`0001` → `0004`), then `supabase/seed.sql`.
   Or with the CLI: `supabase link --project-ref <ref> && supabase db push`, then run the seed.
3. **Authentication → URL Configuration:** Site URL = your domain; add `https://yourdomain/auth/callback` to Redirect URLs.
4. **Authentication → Providers → Email:** keep "Confirm email" **on**.
5. Copy the URL, anon key and service-role key into your env.

### 2. First super administrator
Sign up on the site, then run in the SQL editor (the role guard allows this from the SQL editor):
```sql
update public.profiles set role = 'super_admin' where email = 'you@yourdomain.ca';
insert into public.employees (profile_id, title) select id, 'Owner' from public.profiles where email = 'you@yourdomain.ca';
```
Add other staff from **Admin → Employee Management** after that.

### 3. Configure operations (Admin)
- **Service Areas:** the Greater Toronto examples are seeded *inactive*. Review postal prefixes (FSAs), pick services, and activate. Add **intercity lanes** for travel between areas.
- **Shipping Services** and **Pricing:** every seeded price is a placeholder. Set your real rates and verify tax rates.
- **Settings:** package limits, restricted-item keywords, pickup windows, cancellation policy.
- **Website Management:** support email, phone and address.

### 4. Stripe
1. Use test keys first. Add `STRIPE_SECRET_KEY`.
2. **Developers → Webhooks → Add endpoint:** `https://yourdomain/api/stripe/webhook`, events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

Without Stripe keys, card checkout refuses to start (it never fakes a payment). Approved business accounts with invoicing still work.

### 5. Email (Resend)
Verify your domain at resend.com, then set `RESEND_API_KEY`, `EMAIL_FROM` and `OPERATIONS_EMAIL`. Without a key, emails are logged as **skipped** in Admin → Notifications. For auth emails (verification, reset), set Supabase **Auth → SMTP** to Resend's SMTP so they're branded and reliable.

### 6. Google Maps
Enable **Distance Matrix**, **Geocoding** and **Maps JavaScript** APIs. Create two keys:
- `GOOGLE_MAPS_SERVER_KEY` (server, API-restricted) — real driving distance and geocoding.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser, HTTP-referrer restricted) — dispatch maps.

Without a server key, distance is **estimated** from area centre points and labelled "estimated" everywhere it's shown.

### 7. Run locally
```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
npm test                     # 41 tests
npm run build
```

---

## Deploy to Vercel
1. Push this repo to GitHub, then **Vercel → Add New Project → Import**.
2. Add every variable from `.env.example` (Production + Preview). Set `NEXT_PUBLIC_SITE_URL` to your domain.
3. Deploy, then add your domain and update the Supabase redirect URL and Stripe webhook URL to match.
4. **Before going live:** switch Stripe to live keys and a live webhook, replace the in-memory rate limiter (below), have a lawyer review the Privacy Policy and Terms, set your liability limits, and run one full test booking end to end.

---

## Security notes
- No secret is ever in a `NEXT_PUBLIC_` variable; `src/lib/env.ts` is `server-only`.
- Prices are always recomputed on the server; totals from the browser are ignored.
- Payments are confirmed only by the verified Stripe webhook; the paid amount must match the stored total.
- Uploads (driver documents, proof of delivery) go to **private** buckets, with type/size checks; staff view them through 5–10 minute signed URLs.
- Guest bookings get a random access token; only its SHA-256 hash is stored.
- Public tracking returns status, dates and cities only.
- Admin actions are written to `audit_logs`, including offline invoice payments and refunds.
- Security headers (HSTS, frame-deny, nosniff, referrer policy) are set in `next.config.ts`.
- **Rate limiting:** `src/lib/rate-limit.ts` is in-memory (per server instance). On Vercel, swap its store for Upstash Redis / Vercel KV before launch; the function signature stays the same.
- **PIPEDA:** consent checkboxes on signup and applications, minimal public data, role-restricted access, and access requests through support. Use a Canada-region Supabase project if residency matters to your customers.

---

## Tests
`npm test` runs 41 Vitest tests:
- **Pricing engine** — dimensional weight, minimums, handling, discount stacking, area/lane adjustments, distance limits.
- **Workflow & permissions** — all 17 statuses, legal transitions, drivers can't confirm/cancel, role scoping.
- **Identifiers & validation** — tracking check digits, postal codes, restricted items, limits, guest tokens.
- **Tracking privacy** — public output contains no personal data or internal events.
- **Documents** — label page sizes and per-package pages, receipts, email escaping.
- **Database** — every migration and the seed run against a real Postgres (PGlite) with Supabase auth stubs, then RLS is checked: customers see only their shipments, drivers only assigned ones, business members only their business, anonymous users nothing, users can't edit shipments or promote themselves.

---

## Brand assets
`public/brand/` has the mark, the horizontal logo and a one-colour black version for labels, vans and uniforms. The symbol is a flame cut by a forward arrow (delivery and motion). Palette: ivory `#F8F6F0`, charcoal `#252525`, antique gold `#B89555`, beige `#EAE4D8`.
**Hero photo:** the homepage shows a brand illustration. Add a licensed photo at `public/images/hero-courier.jpg` (1120×840+) and it's used automatically.

---

## Built vs. planned
**Working now:** everything in the table above.

**Prepared for, not built yet (don't advertise these):**
- Route **optimization**: routes are ordered by hand; `delivery_routes.optimization_meta` is reserved.
- **SMS**: `notifications.channel` supports `sms`; no provider is connected.
- **Shopify / e-commerce and a public business API**: `businesses.external_integrations` is reserved; CSV upload works today.
- **Multiple dispatch centres, warehouses, sorting, fleet/vehicle records**: not modelled yet. Areas, lanes and routes are the extension points.
- **Native driver app**: the driver portal is a mobile web app (installable to the home screen).
- **Driver pay calculation**: the portal shows completed work; pay rates aren't modelled.
- **Automatic overdue invoices / Stripe-paid invoices**: overdue is computed for display; invoices are paid offline and marked by finance.
