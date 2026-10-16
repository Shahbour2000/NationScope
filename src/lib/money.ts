/**
 * Exact money arithmetic. The API sends money as integer strings in 1/10,000 gold
 * ("12345" = 1.2345). Values are kept as BigInt and never converted to float.
 */
export const MONEY_SCALE = 10_000n;
const INTEGER = /^-?\d+$/;

export function parseMoney(value: string): bigint {
  if (typeof value !== "string" || !INTEGER.test(value)) throw new Error("Invalid money value.");
  return BigInt(value);
}

export function sumMoney(values: readonly string[]): bigint {
  return values.reduce((acc, v) => acc + parseMoney(v), 0n);
}

/** Formats as gold with `decimals` (0 to 4) places, rounding half away from zero. */
export function formatGold(value: bigint, opts: { decimals?: number; group?: boolean } = {}): string {
  const decimals = opts.decimals ?? 2;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 4) throw new Error("decimals must be 0 to 4.");
  const negative = value < 0n;
  let abs = negative ? -value : value;
  const step = 10n ** BigInt(4 - decimals);
  abs = ((abs + step / 2n) / step) * step;
  const whole = (abs / MONEY_SCALE).toString();
  const grouped = opts.group === false ? whole : whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % MONEY_SCALE).toString().padStart(4, "0").slice(0, decimals);
  const body = decimals > 0 ? `${grouped}.${frac}` : grouped;
  return negative && abs !== 0n ? `-${body}` : body;
}
