"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { completeDeliveryAction, driverStatusAction } from "@/app/actions/driver";
import { STATUS_LABELS, type ShipmentStatus } from "@/lib/status";

/** Uses the browser BarcodeDetector API where supported (Chrome/Android); manual entry otherwise. */
export function BarcodeScanner({ onResult }: { onResult: (v: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [err, setErr] = useState("");
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ["code_128", "qr_code"] });
        const tick = async () => {
          if (!video.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          const hit = codes.find((c: { rawValue: string }) => /8F\d{12}/.test(c.rawValue));
          if (hit) { onResult(hit.rawValue.match(/8F\d{12}/)![0]); setActive(false); return; }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setErr("Camera unavailable. Enter the tracking number manually."); setActive(false); }
    })();
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [active, onResult]);

  if (!supported) return <p className="text-xs text-muted">Barcode scanning isn&apos;t supported on this browser — type the tracking number instead.</p>;
  return (
    <div>
      {err && <p className="text-xs text-danger">{err}</p>}
      {active ? <video ref={video} className="w-full rounded-lg bg-black" muted playsInline /> : <Button type="button" variant="outline" onClick={() => setActive(true)}><ScanLine size={16} /> Scan label barcode</Button>}
    </div>
  );
}

export function StatusUpdater({ shipmentId, options, requireScan }: { shipmentId: string; options: ShipmentStatus[]; requireScan: boolean }) {
  const [s, act, pending] = useActionState(driverStatusAction, {});
  const [status, setStatus] = useState<ShipmentStatus | "">(options[0] ?? "");
  const [scanned, setScanned] = useState("");
  if (!options.length) return <p className="text-sm text-muted">No status changes available right now.</p>;
  const needsNote = ["delivery_attempted", "exception", "delayed"].includes(status);
  return (
    <form action={act} className="space-y-3">
      {s.error && <Alert tone="danger">{s.error}</Alert>}
      {s.success && <Alert tone="success">{s.success}</Alert>}
      <input type="hidden" name="shipment_id" value={shipmentId} />
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button type="button" key={o} onClick={() => setStatus(o)} className={`rounded-lg border px-3 py-3 text-left text-sm font-semibold ${status === o ? "border-charcoal bg-charcoal text-ivory" : "border-beige bg-white"}`}>{STATUS_LABELS[o]}</button>
        ))}
      </div>
      <input type="hidden" name="status" value={status} />
      {status === "picked_up" && requireScan && (
        <div className="space-y-2 rounded-lg bg-beige/40 p-3">
          <BarcodeScanner onResult={setScanned} />
          <input name="scanned" value={scanned} onChange={(e) => setScanned(e.target.value)} placeholder="Tracking number on label" className="field font-mono uppercase" />
        </div>
      )}
      <input name="location" placeholder="Location (optional)" className="field" />
      <textarea name="notes" rows={2} placeholder={needsNote ? "What happened? (required)" : "Note (optional)"} className="field" required={needsNote} />
      <Button className="w-full py-3" disabled={pending || !status}>{pending ? "Saving…" : `Set: ${status ? STATUS_LABELS[status] : ""}`}</Button>
    </form>
  );
}

export function SignaturePad({ name }: { name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState("");
  const drawing = useRef(false);
  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.current!.width, y: ((e.clientY - r.top) / r.height) * canvas.current!.height };
  };
  return (
    <div>
      <canvas
        ref={canvas}
        width={600}
        height={200}
        className="w-full touch-none rounded-lg border border-beige bg-white"
        aria-label="Recipient signature pad"
        onPointerDown={(e) => { drawing.current = true; const c = canvas.current!.getContext("2d")!; c.lineWidth = 3; c.lineCap = "round"; c.strokeStyle = "#252525"; const p = pos(e); c.beginPath(); c.moveTo(p.x, p.y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const c = canvas.current!.getContext("2d")!; const p = pos(e); c.lineTo(p.x, p.y); c.stroke(); }}
        onPointerUp={() => { drawing.current = false; setData(canvas.current!.toDataURL("image/png")); }}
      />
      <button type="button" className="mt-1 text-xs font-semibold text-gold-dark" onClick={() => { canvas.current!.getContext("2d")!.clearRect(0, 0, 600, 200); setData(""); }}>Clear signature</button>
      <input type="hidden" name={name} value={data} />
    </div>
  );
}

export function DeliveryForm({ shipmentId, signatureRequired }: { shipmentId: string; signatureRequired: boolean }) {
  const [s, act, pending] = useActionState(completeDeliveryAction, {});
  if (s.success) return <Alert tone="success">{s.success}</Alert>;
  return (
    <form action={act} className="space-y-3">
      {s.error && <Alert tone="danger">{s.error}</Alert>}
      <input type="hidden" name="shipment_id" value={shipmentId} />
      <input name="recipient_name" placeholder="Received by (full name)" className="field" required />
      <label className="flex items-center gap-2 rounded-lg border border-dashed border-beige p-3 text-sm">
        <Camera size={18} className="text-gold" />
        <span className="flex-1">Delivery photo (optional)</span>
        <input type="file" name="photo" accept="image/*" capture="environment" className="max-w-[55%] text-xs" />
      </label>
      <div><p className="label">Recipient signature {signatureRequired ? "(required)" : "(optional)"}</p><SignaturePad name="signature" /></div>
      <input name="location" placeholder="Location (optional)" className="field" />
      <textarea name="notes" rows={2} placeholder="Delivery note (e.g. left with concierge)" className="field" />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" className="mt-1" /> I confirm the package was delivered to the recipient or left securely.</label>
      <Button variant="gold" className="w-full py-3 text-base" disabled={pending}>{pending ? "Saving…" : "Complete delivery"}</Button>
    </form>
  );
}
