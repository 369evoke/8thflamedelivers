"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Shipping Services" },
  { href: "/track", label: "Track Shipment" },
  { href: "/business", label: "Business Solutions" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

export function Header({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-beige bg-ivory/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
        <Link href="/" className="shrink-0"><Logo size={36} /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition hover:text-gold-dark ${path === n.href ? "text-gold-dark" : "text-charcoal"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href={signedIn ? "/account" : "/sign-in"} className="px-3 py-2 text-sm font-semibold hover:text-gold-dark">
            {signedIn ? "My Account" : "Sign In"}
          </Link>
          <Link href="/quote" className="rounded-lg border border-charcoal/25 px-4 py-2 text-sm font-semibold hover:border-charcoal">Get a Quote</Link>
          <Link href="/ship" className="rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-ivory hover:bg-charcoal-soft">Ship Now</Link>
        </div>
        <button className="rounded-md p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Toggle menu">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="border-t border-beige bg-ivory px-5 pb-6 pt-2 lg:hidden" aria-label="Mobile" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="block border-b border-beige/70 py-3 font-medium">{n.label}</Link>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/quote" className="rounded-lg border border-charcoal/25 py-3 text-center font-semibold">Get a Quote</Link>
            <Link href="/ship" className="rounded-lg bg-charcoal py-3 text-center font-semibold text-ivory">Ship Now</Link>
          </div>
          <Link href={signedIn ? "/account" : "/sign-in"} className="mt-3 block py-2 text-center font-semibold">{signedIn ? "My Account" : "Sign In"}</Link>
        </nav>
      )}
    </header>
  );
}
