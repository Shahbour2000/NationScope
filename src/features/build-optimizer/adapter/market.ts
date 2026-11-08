import { MONEY_SCALE, parseMoney } from '@/lib/money';
import type { AnyItem, Candidates } from '../engine/loadout';
import type { WeaponStats } from '../engine/combat';
import { marketCodeOf, MARKET_CODE, SLOT_STAT } from './codes';
import { AMMO_EXEMPT_ITEM_CODES } from './equipment-snapshot';
import type { EconomyInput } from '../engine/economy';

export interface MarketRowLike { itemCode: string; bestAsk?: string | null; bestBid?: string | null; last?: string | null }
export interface OfferLike { offerId: string; itemCode: string; rarity?: string | null; slot?: string | null; stats?: Record<string, number> | null; durability?: number | null; price: string }

/** API money (1/10,000 gold strings, exact BigInt) -> gold as a number. Conversion happens ONLY at this boundary. */
export function goldFromMoney(v: string | bigint): number {
  const b = typeof v === 'bigint' ? v : parseMoney(v);
  return Number(b / MONEY_SCALE) + Number(b % MONEY_SCALE) / Number(MONEY_SCALE);
}
export interface MarketSnapshot { ask: Record<string, number | null>; bid: Record<string, number | null>; last: Record<string, number | null> }
export function buildMarketSnapshot(rows: readonly MarketRowLike[]): MarketSnapshot {
  const g = (v: string | null | undefined) => (v == null ? null : goldFromMoney(v));
  const s: MarketSnapshot = { ask: {}, bid: {}, last: {} };
  for (const r of rows) { s.ask[r.itemCode] = g(r.bestAsk); s.bid[r.itemCode] = g(r.bestBid); s.last[r.itemCode] = g(r.last); }
  return s;
}
export type SellBasis = 'bid' | 'last' | 'ask';
/** Prices keyed by ENGINE item id. Buying uses the lowest ask; selling uses `sellBasis` (default bid = instant sale). Unknown stays undefined. */
export function economyPrices(m: MarketSnapshot, sellBasis: SellBasis = 'bid'): EconomyInput['prices'] {
  const out: EconomyInput['prices'] = {};
  for (const engineId of Object.keys(MARKET_CODE)) {
    const code = marketCodeOf(engineId);
    const sell = (sellBasis === 'bid' ? m.bid : sellBasis === 'ask' ? m.ask : m.last)[code];
    const buy = m.ask[code];
    out[engineId] = { ...(sell != null ? { sell } : {}), ...(buy != null ? { buy } : {}) };
  }
  return out;
}

const STAT_KEYS = { weapon: ['attack', 'criticalChance'], helmet: ['criticalDamages'], gloves: ['precision'], chest: ['armor'], legs: ['armor'], boots: ['dodge'] } as const;
export interface CandidateOptions { maxPerSlot?: number; minDurability?: number }
export interface CandidateBuild { candidates: Candidates; skipped: { offerId: string; reason: string }[]; assumptions: string[] }

/**
 * Real market offers -> loadout candidates, pruned to the Pareto front per slot (cheaper, stronger, more durable never lose).
 * Offers cost their listed price; none of these are "owned". Owned/equipped gear is NOT exposed by the API (user input).
 */
export function offersToCandidates(offers: readonly OfferLike[], o: CandidateOptions = {}): CandidateBuild {
  const skipped: CandidateBuild['skipped'] = [];
  const assumptions = ['Offers are priced at their listed gold price and treated as not owned.'];
  const bySlot = new Map<string, { item: AnyItem; vec: number[]; price: number }[]>();
  for (const f of offers) {
    const gear = SLOT_STAT[f.slot ?? '']?.gear;
    if (!gear) { skipped.push({ offerId: f.offerId, reason: `unknown slot ${f.slot}` }); continue; }
    const keys = STAT_KEYS[gear]; const st = f.stats ?? {};
    if (keys.some((k) => typeof st[k] !== 'number')) { skipped.push({ offerId: f.offerId, reason: 'missing stat values' }); continue; }
    if (f.durability == null || f.durability < (o.minDurability ?? 1)) { skipped.push({ offerId: f.offerId, reason: 'durability unknown or too low' }); continue; }
    const price = goldFromMoney(f.price);
    let stats: unknown;
    if (gear === 'weapon') { const usesAmmo = !AMMO_EXEMPT_ITEM_CODES.includes(f.itemCode); stats = { attack: st.attack!, critChance: st.criticalChance!, usesAmmo } satisfies WeaponStats; }
    else if (gear === 'helmet') stats = { critDamage: st.criticalDamages! };
    else if (gear === 'gloves') stats = { accuracy: st.precision! };
    else if (gear === 'boots') stats = { dodge: st.dodge! };
    else stats = { armor: st.armor! };
    const item = { id: f.offerId, stats, durability: f.durability, price } as AnyItem;
    // Dominance dimensions. For weapons "needs no ammo" is an advantage: a firearm must never prune an ammo-free weapon (and vice versa the ammo-free weapon may prune a worse firearm).
    const vec = [...keys.map((k) => st[k]!), f.durability, ...(gear === 'weapon' ? [(stats as WeaponStats).usesAmmo ? 0 : 1] : [])];
    (bySlot.get(gear) ?? bySlot.set(gear, []).get(gear)!).push({ item, vec, price });
  }
  assumptions.push('Weapons are assumed to need ammo unless the item code is "knife" (knife code assumed).');
  const front = (xs: { item: AnyItem; vec: number[]; price: number }[]) => {
    const kept = xs.filter((a) => !xs.some((b) => b !== a && b.price <= a.price && b.vec.every((v, i) => v >= a.vec[i]!) && (b.price < a.price || b.vec.some((v, i) => v > a.vec[i]!))));
    kept.sort((a, b) => a.price - b.price || a.item.id.localeCompare(b.item.id));
    return kept.slice(0, o.maxPerSlot ?? 6).map((x) => x.item);
  };
  const c: Candidates = { weapons: front(bySlot.get('weapon') ?? []) as Candidates['weapons'] };
  if (bySlot.has('helmet')) c.helmets = front(bySlot.get('helmet')!) as Candidates['helmets'];
  if (bySlot.has('gloves')) c.gloves = front(bySlot.get('gloves')!) as Candidates['gloves'];
  if (bySlot.has('chest')) c.chests = front(bySlot.get('chest')!) as Candidates['chests'];
  if (bySlot.has('legs')) c.legs = front(bySlot.get('legs')!) as Candidates['legs'];
  if (bySlot.has('boots')) c.boots = front(bySlot.get('boots')!) as Candidates['boots'];
  return { candidates: c, skipped, assumptions };
}
