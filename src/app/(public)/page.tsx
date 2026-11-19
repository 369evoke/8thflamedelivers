import Image from "next/image";
import Link from "next/link";
import { existsSync } from "fs";
import path from "path";
import { Building2, CalendarClock, Clock, Boxes, MapPin, Package, ShieldCheck, Truck, Eye, Receipt, Headphones, Route } from "lucide-react";
import { ButtonLink, Card, Section } from "@/components/ui";
import { HeroScene } from "@/components/brand/HeroScene";
import { TrackForm } from "@/components/tracking/TrackForm";
import { getActiveAreas } from "@/lib/public-data";

export const revalidate = 300;

const SERVICES = [
  { icon: Clock, t: "Same-Day Delivery", d: "Urgent parcels picked up and delivered within the same business day in active local zones." },
  { icon: CalendarClock, t: "Scheduled Delivery", d: "Choose your pickup date and time window. We plan the route around you." },
  { icon: Package, t: "Standard Parcel Delivery", d: "Economical, dependable parcel shipping for everyday needs." },
  { icon: Building2, t: "Business Shipping", d: "Approved accounts, negotiated rates, invoicing and team access." },
  { icon: Truck, t: "Local Courier Services", d: "Documents and small items across town, handled by our own drivers." },
  { icon: Boxes, t: "Bulk Shipments", d: "Upload a CSV and book dozens of shipments in a single step." },
];

const STEPS = [
  ["Book Your Shipment", "Enter pickup and delivery details, see a transparent price and pay securely online."],
  ["We Pick Up Your Package", "Our dispatch team confirms your booking and assigns a vetted 8th Flame driver."],
  ["Track Your Shipment", "Follow every recorded scan and status update with your tracking number."],
  ["Your Package Is Delivered", "Proof of delivery is captured and your shipment record is updated."],
];

const WHY = [
  { icon: Route, t: "Convenient shipping", d: "Book in minutes, from any device, without calling us." },
  { icon: ShieldCheck, t: "Professional delivery management", d: "Every shipment is dispatched and supervised by our operations team." },
  { icon: Eye, t: "Shipment tracking", d: "Real tracking events, recorded by our drivers and staff." },
  { icon: Receipt, t: "Transparent pricing", d: "A line-by-line breakdown before you pay. No surprises." },
  { icon: Building2, t: "Business shipping solutions", d: "Bulk booking, invoices and team accounts for companies." },
  { icon: Headphones, t: "Customer support", d: "Real people, with a ticket you can follow online." },
];

export default async function HomePage() {
  const areas = await getActiveAreas();
  const hasPhoto = existsSync(path.join(process.cwd(), "public/images/hero-courier.jpg"));

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-ivory px-5 pb-16 pt-10 md:pb-24 md:pt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="eyebrow mb-4">Courier · Parcel · Logistics</p>
            <h1 className="text-4xl font-extrabold leading-[1.05] md:text-6xl">Your Shipments. <span className="text-gold-dark">Our Commitment.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Reliable courier and parcel delivery solutions for individuals and businesses. From local pickups to scheduled shipments, 8th Flame Delivery keeps your packages moving.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/ship" className="px-6 py-3 text-base">Ship Now</ButtonLink>
              <ButtonLink href="/track" variant="outline" className="px-6 py-3 text-base">Track Shipment</ButtonLink>
            </div>
            <div className="mt-10 max-w-lg rounded-xl border border-beige bg-white p-4 shadow-sm">
              <TrackForm />
            </div>
          </div>
          <div className="relative">
            <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-gold/10 blur-2xl" aria-hidden />
            {hasPhoto ? (
              <Image src="/images/hero-courier.jpg" alt="8th Flame Delivery courier with a delivery van" width={1120} height={840} priority className="relative rounded-2xl object-cover shadow-xl" />
            ) : (
              <div className="relative rounded-2xl shadow-xl"><HeroScene /></div>
            )}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <Section className="bg-white" id="services">
        <p className="eyebrow">Our shipping services</p>
        <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Shipping built around how you work</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(({ icon: I, t, d }) => (
            <Card key={t} className="transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-charcoal text-gold"><I size={22} /></span>
              <h3 className="mt-4 text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8"><Link href="/services" className="font-semibold text-gold-dark hover:underline">Compare all services →</Link></div>
      </Section>

      {/* HOW IT WORKS */}
      <Section>
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Four steps from booking to doorstep</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="relative rounded-xl border border-beige bg-white p-5">
              <span className="font-display text-4xl font-extrabold text-gold">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted">Step {i + 1}</p>
              <h3 className="mt-2 font-bold">{t}</h3>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* WHY */}
      <Section className="bg-charcoal text-ivory">
        <p className="eyebrow !text-gold">Why choose 8th Flame</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-extrabold md:text-4xl">One company, accountable from pickup to delivery</h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map(({ icon: I, t, d }) => (
            <div key={t} className="flex gap-4">
              <I className="mt-1 shrink-0 text-gold" size={22} />
              <div><h3 className="font-bold">{t}</h3><p className="mt-1 text-sm text-ivory/70">{d}</p></div>
            </div>
          ))}
        </div>
      </Section>

      {/* BUSINESS + DRIVER */}
      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-8">
            <p className="eyebrow">Business shipping</p>
            <h2 className="mt-2 text-2xl font-extrabold">For retailers, online stores, wholesalers and corporate teams</h2>
            <p className="mt-3 text-muted">Apply for an approved business account to unlock negotiated rates, bulk CSV booking, monthly invoicing and team access.</p>
            <ButtonLink href="/business" className="mt-6">Explore business solutions</ButtonLink>
          </Card>
          <Card className="bg-beige/40 p-8">
            <p className="eyebrow">Become a driver</p>
            <h2 className="mt-2 text-2xl font-extrabold">Join the 8th Flame delivery team</h2>
            <p className="mt-3 text-muted">We&apos;re looking for qualified, reliable drivers. Approved drivers receive planned assignments from our dispatch team.</p>
            <ButtonLink href="/drivers" variant="outline" className="mt-6">Apply to drive</ButtonLink>
          </Card>
        </div>
      </Section>

      {/* AREAS */}
      <Section className="bg-white">
        <p className="eyebrow">Service areas</p>
        <h2 className="mt-2 text-3xl font-extrabold">Where we deliver</h2>
        {areas.length ? (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-beige px-4 py-3">
                <MapPin size={18} className="text-gold" /> <span className="font-semibold">{a.name}</span>
                <span className="ml-auto text-xs text-muted">{a.province}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-xl text-muted">Our service areas are being finalized. Enter your postal codes on the quote page to check availability, or contact us.</p>
        )}
        <Link href="/service-areas" className="mt-6 inline-block font-semibold text-gold-dark hover:underline">View service areas →</Link>
      </Section>

      {/* CTA */}
      <section className="bg-gold px-5 py-16 text-center">
        <h2 className="text-3xl font-extrabold text-charcoal md:text-4xl">Let&apos;s Get Your Package Moving.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/ship" className="px-6 py-3">Ship Now</ButtonLink>
          <ButtonLink href="/track" variant="outline" className="border-charcoal px-6 py-3">Track Shipment</ButtonLink>
        </div>
      </section>
    </>
  );
}
