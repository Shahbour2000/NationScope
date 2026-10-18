import type { ReactNode } from "react";

export interface BarRow { key: string; label: ReactNode; value: number; display: ReactNode }

/** Horizontal bars. Values are shown as text too, so the chart is never the only carrier of information. */
export function BarList({ rows, max, ariaLabel }: { rows: BarRow[]; max?: number; ariaLabel: string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist" aria-label={ariaLabel}>
      {rows.map((r) => (
        <li key={r.key}>
          <span className="bl-label">{r.label}</span>
          <span className="bl-track" aria-hidden="true"><span className="bl-fill" style={{ inlineSize: `${Math.max(2, Math.round((r.value / top) * 100))}%` }} /></span>
          <span className="bl-value">{r.display}</span>
        </li>
      ))}
    </ul>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <span className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <span style={{ inlineSize: `${pct}%` }} />
    </span>
  );
}

/** Area/line chart from real observations. x labels are shown only at the ends to stay readable on phones. */
export function LineChart({ points, ariaLabel, format }: { points: { label: string; value: number }[]; ariaLabel: string; format: (n: number) => string }) {
  if (points.length < 2) return null;
  const W = 600, H = 150, P = 8;
  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const xy = points.map((p, i) => [P + (i / (points.length - 1)) * (W - 2 * P), H - P - ((p.value - min) / span) * (H - 2 * P)] as const);
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1]![0].toFixed(1)},${H - P} L${xy[0]![0].toFixed(1)},${H - P} Z`;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity="0.35" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0.03" /></linearGradient>
        </defs>
        <path d={area} fill="url(#lc-fill)" />
        <path d={line} fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill="#8b5cf6" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <figcaption>
        <span>{points[0]!.label} · {format(points[0]!.value)}</span>
        <span>{format(min)} – {format(max)}</span>
        <span>{points[points.length - 1]!.label} · {format(points[points.length - 1]!.value)}</span>
      </figcaption>
    </figure>
  );
}

export function Sparkline({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  if (values.length < 2) return null;
  const W = 100, H = 28;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${((i / (values.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / span) * (H - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
      <path d={d} fill="none" stroke="#22d3ee" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
