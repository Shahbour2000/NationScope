"use client";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { Icon } from "@/components/Icon";
import { itemIconSrc } from "@/lib/media";
import type { Evidence } from "../domain/evidence";
import { goldText } from "../domain/fixed";
import { polyline, type SeriesPoint } from "../domain/series";
import type { Text } from "./text";
import s from "./engine.module.css";

/** Product picture from the game's item icon URL; falls back to a generic icon (never a broken image). */
export function ItemIcon({ code, size = 32 }: { code: string; size?: number }) {
  return <RemoteImage src={itemIconSrc(code)} size={size} fallback={<span className="img img-fallback" style={{ inlineSize: size, blockSize: size }}><Icon name="box" size={Math.round(size * 0.6)} /></span>} />;
}

/** Gold with sensible precision: whole numbers for big amounts, 4 decimals for tiny per-point values. */
export function money(v: bigint | null, dec?: number): string {
  if (v === null) return "-";
  const a = v < 0n ? -v : v;
  return goldText(v, dec ?? (a >= 1_000_000n ? 0 : a >= 10_000n ? 2 : 4));
}
export const tone = (v: bigint | null): string => (v === null ? "" : v > 0n ? s.gain! : v < 0n ? s.loss! : "");
export const pct = (bp: bigint | null): string => (bp === null ? "-" : `${(Number(bp) / 100).toFixed(1)}%`);

export function EvTag({ e, t }: { e: Evidence; t: Text }) {
  return <span className={`${s.chip} ${s[e]}`} title={t.evHelp[e]}>{t.ev[e]}</span>;
}
export function Meter({ value, max, kind }: { value: number; max: number; kind?: "gain" | "loss" }) {
  const w = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return <div className={s.meter} role="presentation"><i className={kind === "gain" ? s.gainbar : kind === "loss" ? s.lossbar : undefined} style={{ inlineSize: `${w}%` }} /></div>;
}

export function Spark({ points, label }: { points: readonly SeriesPoint[]; label: string }) {
  const p = polyline(points, 240, 56);
  if (!p) return null;
  const up = points[points.length - 1]!.price >= points[0]!.price;
  return (
    <svg className={s.chart} viewBox="0 0 240 56" role="img" aria-label={label} preserveAspectRatio="none">
      <path d={p.d} fill="none" stroke={up ? "var(--gain, #5fe3a1)" : "var(--loss, #ff7b93)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Profit (y) by gross wage (x). Marks are the scenario wages. Chart only: money results are computed elsewhere in exact bigint. */
export function CurveChart({ curve, marks, label }: { curve: { wage: bigint; profit: bigint }[]; marks: { wage: bigint; profit: bigint; label: string }[]; label: string }) {
  if (curve.length < 2) return null;
  const W = 300, H = 120, pad = 6;
  const xs = curve.map((c) => Number(c.wage)), ys = curve.map((c) => Number(c.profit));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(0, ...ys), y1 = Math.max(0, ...ys);
  const X = (v: number) => pad + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * pad), Y = (v: number) => H - pad - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * pad);
  const d = curve.map((c, k) => `${k ? "L" : "M"}${X(Number(c.wage)).toFixed(1)},${Y(Number(c.profit)).toFixed(1)}`).join("");
  return (
    <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line x1={pad} x2={W - pad} y1={Y(0)} y2={Y(0)} stroke="var(--line-strong)" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke="var(--brand-cyan)" strokeWidth="2" />
      {marks.map((m) => <circle key={m.label} cx={X(Number(m.wage))} cy={Y(Number(m.profit))} r="4.5" fill={m.profit >= 0n ? "#5fe3a1" : "#ff7b93"} stroke="var(--bg)" strokeWidth="1.5"><title>{m.label}</title></circle>)}
    </svg>
  );
}
