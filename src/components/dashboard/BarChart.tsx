/** Minimal accessible SVG bar chart rendered on the server from real query results. */
export function BarChart({ data, format = (n: number) => String(n), height = 180, label }: { data: { label: string; value: number }[]; format?: (n: number) => string; height?: number; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure>
      <svg viewBox={`0 0 100 ${height / 3}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={`${label}: total ${format(total)}`}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 3 - 2);
          return <rect key={i} x={i * w + w * 0.15} y={height / 3 - h} width={w * 0.7} height={h} rx="0.6" className="fill-gold"><title>{`${d.label}: ${format(d.value)}`}</title></rect>;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted"><span>{data[0]?.label}</span><span>{data[data.length - 1]?.label}</span></div>
      <figcaption className="sr-only">{data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}</figcaption>
    </figure>
  );
}
