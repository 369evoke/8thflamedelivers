"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
}

export function ShellNav({ items, mobile }: { items: NavItem[]; mobile?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => path === h || (h.split("/").length > 2 && path.startsWith(h + "/"));
  const list = (
    <ul className="space-y-0.5 px-3">
      {items.map((i) => (
        <li key={i.href}>
          <Link
            href={i.href}
            className={`block rounded-md px-3 py-2 text-sm font-medium ${active(i.href) ? "bg-charcoal text-ivory" : "text-charcoal hover:bg-beige/60"}`}
          >
            {i.label}
          </Link>
        </li>
      ))}
    </ul>
  );
  if (!mobile) return <nav className="overflow-y-auto pb-4">{list}</nav>;
  return (
    <>
      <button onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open} className="p-2">{open ? <X /> : <Menu />}</button>
      {open && <nav onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }} className="fixed inset-x-0 top-[57px] bottom-0 overflow-y-auto bg-white py-3">{list}</nav>}
    </>
  );
}
