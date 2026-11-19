/**
 * Exact fixed-point helpers for the Economy Engine.
 * - Gold is a bigint in 1/10,000 gold (the API money format).
 * - Rates are basis points (bp): 1% = 100 bp, 100% = 10,000 bp.
 * - Production points (PP) from the API are 1/10,000 PP (inferred, see ROADMAP).
 * No floating point is used for any money result.
 */
export const BP = 10_000n;
export const GOLD_SCALE = 10_000n;
export const PP_SCALE = 10_000n;

/** Integer division rounded half away from zero. */
export function roundDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new RangeError("Division by zero.");
  const neg = n < 0n !== d < 0n;
  const a = n < 0n ? -n : n, b = d < 0n ? -d : d;
  const q = (a * 2n + b) / (2n * b);
  return neg ? -q : q;
}
export function floorDiv(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new RangeError("Division by zero.");
  const q = n / d;
  return n % d !== 0n && n < 0n !== d < 0n ? q - 1n : q;
}
export const ceilDiv = (n: bigint, d: bigint): bigint => -floorDiv(-n, d);

/** Percent (may be fractional, e.g. 7.5) to basis points, rounded. */
export function pctToBp(percent: number): bigint {
  if (!Number.isFinite(percent)) throw new RangeError("Rate must be finite.");
  return BigInt(Math.round(percent * 100));
}
export const mulBp = (v: bigint, bp: bigint): bigint => roundDiv(v * bp, BP);
export const mulBpFloor = (v: bigint, bp: bigint): bigint => floorDiv(v * bp, BP);
/** v x (1 - rate). */
export const afterRate = (v: bigint, bp: bigint): bigint => roundDiv(v * (BP - bp), BP);

const INT = /^-?\d+$/;
/** Parses an API money/point string; null (never 0) for anything that is not an integer. */
export function parseIntString(v: unknown): bigint | null {
  if (typeof v === "string" && INT.test(v)) return BigInt(v);
  if (typeof v === "number" && Number.isSafeInteger(v)) return BigInt(v);
  return null;
}

export const minBig = (a: bigint, b: bigint): bigint => (a < b ? a : b);
export const maxBig = (a: bigint, b: bigint): bigint => (a > b ? a : b);
export const clampBig = (v: bigint, lo: bigint, hi: bigint): bigint => (v < lo ? lo : v > hi ? hi : v);

/** Display only: gold with up to 4 decimals. */
export function goldText(v: bigint, decimals = 4): string {
  const neg = v < 0n; let a = neg ? -v : v;
  const step = 10n ** BigInt(4 - decimals);
  a = ((a + step / 2n) / step) * step;
  const whole = (a / GOLD_SCALE).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (a % GOLD_SCALE).toString().padStart(4, "0").slice(0, decimals);
  const body = decimals > 0 ? `${whole}.${frac}` : whole;
  return neg && a !== 0n ? `-${body}` : body;
}

/** Parses a gold amount typed by a person ("0.18", "12", "3.1415") into 1/10,000 units. Null if not a plain non-negative decimal with at most 4 places. */
export function parseGoldDecimal(text: string): bigint | null {
  const m = /^(\d{1,12})(?:\.(\d{1,4}))?$/.exec(text.trim());
  if (!m) return null;
  return BigInt(m[1]!) * GOLD_SCALE + BigInt((m[2] ?? "").padEnd(4, "0") || "0");
}
