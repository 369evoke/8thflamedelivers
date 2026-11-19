"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export function TrackForm({ initial = "", dark = false }: { initial?: string; dark?: boolean }) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = v.replace(/\s+/g, "").toUpperCase();
        if (!/^8F\d{12}$/.test(t)) return setErr("Tracking numbers start with 8F followed by 12 digits.");
        setErr("");
        router.push(`/track/${t}`);
      }}
      className="w-full"
    >
      <label htmlFor="track" className={`mb-2 block text-sm font-semibold ${dark ? "text-ivory" : ""}`}>Track a shipment</label>
      <div className="flex gap-2">
        <input
          id="track"
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="e.g. 8F482019573611"
          className="field flex-1 font-mono uppercase"
          aria-invalid={!!err}
          aria-describedby={err ? "track-err" : undefined}
          autoComplete="off"
        />
        <button className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 font-semibold text-charcoal hover:bg-gold-dark hover:text-ivory">
          <Search size={18} /> <span className="hidden sm:inline">Track</span>
        </button>
      </div>
      {err && <p id="track-err" className={`mt-2 text-sm ${dark ? "text-gold" : "text-danger"}`}>{err}</p>}
    </form>
  );
}
