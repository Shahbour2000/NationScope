/** Pure hemicycle layout. Coordinates are in a unit space: x in [-1, 1], y in [0, 1] (y up from the baseline). */
export interface Seat { x: number; y: number; angle: number; row: number }
export interface Layout { seats: Seat[]; seatSize: number }

const rowsFor = (n: number): number => (n <= 8 ? 1 : n <= 20 ? 2 : n <= 40 ? 3 : n <= 70 ? 4 : n <= 120 ? 5 : 6);

export function layoutParliament(n: number): Layout {
  if (!Number.isInteger(n) || n < 0) throw new Error("seat count must be a non-negative integer");
  if (n === 0) return { seats: [], seatSize: 0 };
  const rows = rowsFor(n);
  const radii = rows === 1 ? [0.8] : Array.from({ length: rows }, (_, i) => 0.45 + (i / (rows - 1)) * 0.5);
  const total = radii.reduce((a, b) => a + b, 0);
  // largest-remainder split of n seats across rows, proportional to the row's arc length
  const exact = radii.map((r) => (n * r) / total);
  const counts = exact.map(Math.floor);
  let left = n - counts.reduce((a, b) => a + b, 0);
  exact.map((v, i) => ({ i, rem: v - Math.floor(v) })).sort((a, b) => b.rem - a.rem).forEach(({ i }) => { if (left > 0) { counts[i]!++; left--; } });

  const gap = rows > 1 ? (radii[1]! - radii[0]!) : 1;
  let seatSize = Math.min(0.15, gap * 0.9);
  const seats: Seat[] = [];
  radii.forEach((r, row) => {
    const k = counts[row]!;
    if (k > 1) seatSize = Math.min(seatSize, ((Math.PI * r) / (k - 1)) * 0.9);
    for (let j = 0; j < k; j++) {
      const angle = k === 1 ? Math.PI / 2 : Math.PI - (j / (k - 1)) * Math.PI;
      seats.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), angle, row });
    }
  });
  // left-to-right by angle, so each party fills a wedge; outer rows first on ties
  seats.sort((a, b) => b.angle - a.angle || b.row - a.row);
  return { seats, seatSize };
}

export interface PartyGroup<T> { key: string; name: string | null; members: T[] }

/** Groups members by party: ruling party first, then by size, members without a party last. Stable and deterministic. */
export function groupByParty<T extends { party?: { id: string; name: string } | null }>(members: readonly T[], rulingId?: string | null): PartyGroup<T>[] {
  const map = new Map<string, PartyGroup<T>>();
  for (const m of members) {
    const key = m.party?.id ?? "__none__";
    const g = map.get(key) ?? { key, name: m.party?.name ?? null, members: [] };
    g.members.push(m);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === "__none__") return 1;
    if (b.key === "__none__") return -1;
    if (rulingId && a.key === rulingId) return -1;
    if (rulingId && b.key === rulingId) return 1;
    return b.members.length - a.members.length || (a.name ?? "").localeCompare(b.name ?? "");
  });
}

export const PARTY_COLORS = ["#a855f7", "#19c8ff", "#e040fb", "#4f6cf7", "#f5a623", "#22c55e", "#ef4444", "#14b8a6"];
export const NO_PARTY_COLOR = "#6b7794";
