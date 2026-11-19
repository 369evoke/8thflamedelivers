import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const cols = [
  { title: "Shipping", links: [["Ship a Package", "/ship"], ["Get a Quote", "/quote"], ["Track a Shipment", "/track"], ["Our Services", "/services"], ["Service Areas", "/service-areas"]] },
  { title: "Company", links: [["About Us", "/about"], ["Business Shipping", "/business"], ["Become a Driver", "/drivers"], ["Contact Us", "/contact"], ["FAQ", "/faq"]] },
  { title: "Legal", links: [["Privacy Policy", "/privacy"], ["Terms and Conditions", "/terms"]] },
];

export function Footer() {
  return (
    <footer className="mt-auto bg-charcoal text-ivory/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo variant="light" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">Courier, parcel and logistics services for individuals and businesses — managed end to end by our own team.</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-gold">{c.title}</p>
            <ul className="space-y-2 text-sm">
              {c.links.map(([l, h]) => (
                <li key={h}><Link href={h} className="hover:text-ivory">{l}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-ivory/50">© {new Date().getFullYear()} 8th Flame Delivery. All rights reserved.</div>
    </footer>
  );
}
