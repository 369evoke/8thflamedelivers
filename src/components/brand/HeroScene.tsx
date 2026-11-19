import { ARROW_PATH, FLAME_PATH } from "@/lib/brand";

/** Brand illustration of an 8th Flame courier and van. Replaced by a photo when
 *  public/images/hero-courier.jpg exists (see README › Brand assets). */
export function HeroScene() {
  return (
    <svg viewBox="0 0 560 420" className="h-auto w-full" role="img" aria-label="8th Flame Delivery courier loading a parcel into a branded delivery van">
      <rect width="560" height="420" rx="20" fill="#EAE4D8" />
      <rect y="320" width="560" height="100" rx="0" fill="#dcd4c3" />
      <rect y="318" width="560" height="4" fill="#cfc6b3" />
      {/* van */}
      <g transform="translate(150 140)">
        <path d="M0 40 Q0 20 20 20 H250 Q270 20 276 40 L300 110 Q330 118 334 140 V176 Q334 186 324 186 H0 Z" fill="#FFFFFF" stroke="#252525" strokeWidth="3" />
        <path d="M262 46 L284 108 H246 V46 Z" fill="#cfd6dc" stroke="#252525" strokeWidth="3" />
        <rect x="0" y="150" width="334" height="12" fill="#252525" />
        <rect x="0" y="134" width="210" height="8" fill="#B89555" />
        <g transform="translate(30 50) scale(.62)">
          <rect width="100" height="100" rx="14" fill="#252525" />
          <path d={FLAME_PATH} fill="#B89555" />
          <path d={ARROW_PATH} fill="#252525" />
        </g>
        <text x="104" y="80" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="20" letterSpacing="1.5" fill="#252525">8TH FLAME</text>
        <text x="105" y="98" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="11" letterSpacing="4.5" fill="#B89555">DELIVERY</text>
        <circle cx="70" cy="188" r="30" fill="#252525" /><circle cx="70" cy="188" r="12" fill="#bbb" />
        <circle cx="270" cy="188" r="30" fill="#252525" /><circle cx="270" cy="188" r="12" fill="#bbb" />
      </g>
      {/* courier */}
      <g transform="translate(62 170)">
        <circle cx="34" cy="20" r="16" fill="#8a5a3c" />
        <path d="M16 14 Q34 -6 52 14 V18 H16 Z" fill="#252525" />
        <rect x="14" y="40" width="40" height="66" rx="10" fill="#252525" />
        <rect x="14" y="58" width="40" height="5" fill="#B89555" />
        <rect x="18" y="104" width="13" height="50" rx="5" fill="#3a3a3a" />
        <rect x="37" y="104" width="13" height="50" rx="5" fill="#3a3a3a" />
        <rect x="14" y="150" width="20" height="8" rx="3" fill="#252525" />
        <rect x="35" y="150" width="20" height="8" rx="3" fill="#252525" />
        {/* parcel */}
        <rect x="40" y="58" width="56" height="44" rx="3" fill="#c49a62" stroke="#8e6a3a" strokeWidth="2" />
        <rect x="64" y="58" width="8" height="44" fill="#e9d9b8" />
        <rect x="52" y="66" width="16" height="10" fill="#fff" />
        <path d="M54 50 Q64 70 56 82" stroke="#8a5a3c" strokeWidth="9" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
