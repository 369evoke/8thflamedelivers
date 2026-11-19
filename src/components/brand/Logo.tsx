import { ARROW_PATH, FLAME_PATH } from "@/lib/brand";

export function LogoMark({ size = 40, variant = "dark" }: { size?: number; variant?: "dark" | "light" }) {
  const bg = variant === "dark" ? "#252525" : "#F8F6F0";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" role="img">
      <rect width="100" height="100" rx="14" fill={bg} />
      <path d={FLAME_PATH} fill="#B89555" />
      <path d={ARROW_PATH} fill={bg} />
    </svg>
  );
}

export function Logo({ variant = "dark", size = 40 }: { variant?: "dark" | "light"; size?: number }) {
  const text = variant === "dark" ? "text-charcoal" : "text-ivory";
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="8th Flame Delivery">
      <LogoMark size={size} variant={variant === "dark" ? "dark" : "light"} />
      <span className="leading-none">
        <span className={`block font-display text-[1.05rem] font-extrabold tracking-[0.08em] ${text}`}>8TH FLAME</span>
        <span className="mt-0.5 block text-[0.62rem] font-bold tracking-[0.34em] text-gold">DELIVERY</span>
      </span>
    </span>
  );
}
