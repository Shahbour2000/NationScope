import type { GearInput } from '../engine/combat';
import type { PlayerEquipmentLike } from './player-state';

/**
 * Equipment data integrity (Phase 2).
 *
 * The player profile carries an `equipment` array. Its meaning is NOT confirmed by the game or the API contract (it looks like the
 * equipped loadout, but there is no "equipped" flag and a real production sample had only five rows). This module therefore never
 * promotes that array to "the player's complete loadout" on its own:
 *
 *  - a slot with no row is `missing` (UNKNOWN, never "explicitly empty" - the API cannot state emptiness);
 *  - a row that cannot be turned into usable stats is `invalid`, a slot reported more than once is `duplicate`; both keep their
 *    original rows so the reason can be shown instead of being dropped;
 *  - only when all six slots are `present` is the snapshot `complete` and a `GearInput` produced;
 *  - explicit emptiness can only come from the user (slot-level override), never from the API.
 *
 * Durability is preserved as data only. No wear mechanic is inferred from it here.
 * Player-owned equipment (this module) and market offers (`adapter/market.ts`) are separate types and never mix.
 */

export const EQUIPMENT_API_SLOTS = ['weapon', 'helmet', 'gloves', 'chest', 'pants', 'boots'] as const;
export type EquipmentApiSlot = (typeof EQUIPMENT_API_SLOTS)[number];
export type GearKey = 'weapon' | 'helmet' | 'gloves' | 'chest' | 'legs' | 'boots';
export const GEAR_KEYS: readonly GearKey[] = ['weapon', 'helmet', 'gloves', 'chest', 'legs', 'boots'];
/** The API calls the legs slot "pants"; the engine calls it "legs". */
export const API_SLOT_TO_GEAR: Record<EquipmentApiSlot, GearKey> = { weapon: 'weapon', helmet: 'helmet', gloves: 'gloves', chest: 'chest', pants: 'legs', boots: 'boots' };
export const GEAR_TO_API_SLOT: Record<GearKey, EquipmentApiSlot> = { weapon: 'weapon', helmet: 'helmet', gloves: 'gloves', chest: 'chest', legs: 'pants', boots: 'boots' };

/**
 * Stat keys carried by each profile slot (observed in recorded responses; same keys as the market offers).
 * UNVERIFIED against a published contract: a row without the required keys is reported `invalid`, never defaulted to 0.
 */
export const SLOT_STAT_KEYS: Record<EquipmentApiSlot, readonly string[]> = {
  weapon: ['attack', 'criticalChance'], helmet: ['criticalDamages'], gloves: ['precision'], chest: ['armor'], pants: ['armor'], boots: ['dodge'],
};
/** Wiki 01-basics §3.5: every weapon except the knife needs ammunition. The item-code spelling `knife` is only seen in test fixtures (UNVERIFIED). */
export const AMMO_EXEMPT_ITEM_CODES: readonly string[] = ['knife'];
/** Wiki 01-basics §3.4: items start at 100 durability. Used only to warn about odd values; durability is never changed or interpreted. */
export const DOCUMENTED_DURABILITY_RANGE = { min: 0, max: 100 } as const;

export type EquipmentSlotStatus = 'present' | 'missing' | 'invalid' | 'duplicate';
export type EquipmentCompleteness = 'complete' | 'partial' | 'unknown';
export type EquipmentRowIssueReason = 'not-an-array' | 'not-an-object' | 'missing-slot' | 'missing-item-code' | 'invalid-stats' | 'invalid-durability' | 'malformed';
export interface EquipmentRowIssue { index: number; slot: string | null; reason: EquipmentRowIssueReason }
export type SlotProblem = EquipmentRowIssueReason | `missing-stat:${string}` | 'duplicate-rows';

type GearSlotValue = NonNullable<GearInput[GearKey]>;
export interface EquipmentSlotState {
  slot: EquipmentApiSlot; gear: GearKey; status: EquipmentSlotStatus;
  /** Every valid row the API reported for this slot (more than one for `duplicate`). */
  entries: PlayerEquipmentLike[];
  /** Engine item, only for `present`. */
  item: GearSlotValue | null;
  /** Durability exactly as reported (data only). */
  durability: number | null;
  problems: SlotProblem[];
}
export interface EquipmentSnapshot {
  /** false when the profile had no equipment block at all. */
  reported: boolean;
  completeness: EquipmentCompleteness;
  slots: Record<EquipmentApiSlot, EquipmentSlotState>;
  /** Valid rows whose slot name is not one of the six known slots. They are kept, never mapped. */
  unrecognized: PlayerEquipmentLike[];
  rejected: EquipmentRowIssue[];
  counts: Record<EquipmentSlotStatus, number>;
  /** Human-readable English warnings (also surfaced through PlayerState.warnings). */
  warnings: string[];
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function itemFromEntry(slot: EquipmentApiSlot, entry: PlayerEquipmentLike): { item: GearSlotValue | null; problems: SlotProblem[] } {
  const s = entry.stats;
  const missing = SLOT_STAT_KEYS[slot].filter((k) => !s || !finite(s[k]));
  if (missing.length) return { item: null, problems: missing.map((k) => `missing-stat:${k}` as const) };
  const st = s as Record<string, number>;
  switch (slot) {
    case 'weapon': return { item: { kind: 'item', stats: { attack: st.attack!, critChance: st.criticalChance!, usesAmmo: !AMMO_EXEMPT_ITEM_CODES.includes(entry.itemCode) } }, problems: [] };
    case 'helmet': return { item: { kind: 'item', stats: { critDamage: st.criticalDamages! } }, problems: [] };
    case 'gloves': return { item: { kind: 'item', stats: { accuracy: st.precision! } }, problems: [] };
    case 'chest': case 'pants': return { item: { kind: 'item', stats: { armor: st.armor! } }, problems: [] };
    case 'boots': return { item: { kind: 'item', stats: { dodge: st.dodge! } }, problems: [] };
  }
}

const emptyCounts = (): Record<EquipmentSlotStatus, number> => ({ present: 0, missing: 0, invalid: 0, duplicate: 0 });

export function buildEquipmentSnapshot(entries: readonly PlayerEquipmentLike[] | null | undefined, rejected: readonly EquipmentRowIssue[] = []): EquipmentSnapshot {
  const reported = entries !== null && entries !== undefined;
  const rows = entries ?? [];
  const slots = {} as Record<EquipmentApiSlot, EquipmentSlotState>;
  const unrecognized: PlayerEquipmentLike[] = [];
  const known = new Set<string>(EQUIPMENT_API_SLOTS);
  for (const slot of EQUIPMENT_API_SLOTS) slots[slot] = { slot, gear: API_SLOT_TO_GEAR[slot], status: 'missing', entries: [], item: null, durability: null, problems: [] };
  for (const row of rows) { if (known.has(row.slot)) slots[row.slot as EquipmentApiSlot].entries.push(row); else unrecognized.push(row); }
  const rejectedBySlot = new Map<EquipmentApiSlot, EquipmentRowIssue[]>();
  for (const r of rejected) if (r.slot && known.has(r.slot)) rejectedBySlot.set(r.slot as EquipmentApiSlot, [...(rejectedBySlot.get(r.slot as EquipmentApiSlot) ?? []), r]);

  const counts = emptyCounts();
  for (const slot of EQUIPMENT_API_SLOTS) {
    const st = slots[slot];
    const bad = rejectedBySlot.get(slot) ?? [];
    const total = st.entries.length + bad.length;
    if (total === 0) st.status = 'missing';
    else if (total > 1) { st.status = 'duplicate'; st.problems = ['duplicate-rows']; st.durability = null; }
    else if (bad.length === 1) { st.status = 'invalid'; st.problems = [bad[0]!.reason]; }
    else {
      const entry = st.entries[0]!;
      const { item, problems } = itemFromEntry(slot, entry);
      st.durability = entry.durability;
      if (item) { st.status = 'present'; st.item = item; } else { st.status = 'invalid'; st.problems = problems; }
    }
    counts[st.status]++;
  }

  const completeness: EquipmentCompleteness = counts.present === EQUIPMENT_API_SLOTS.length ? 'complete' : counts.present === 0 ? 'unknown' : 'partial';
  const warnings: string[] = [];
  if (!reported) warnings.push('The profile did not include an equipment block: equipment is unknown.');
  else {
    if (completeness !== 'complete') {
      const names = (st: EquipmentSlotStatus) => EQUIPMENT_API_SLOTS.filter((s) => slots[s].status === st).join(', ');
      const parts = (['missing', 'invalid', 'duplicate'] as const).filter((st) => counts[st] > 0).map((st) => `${st}: ${names(st)}`);
      warnings.push(`Profile equipment is ${completeness} (${counts.present}/${EQUIPMENT_API_SLOTS.length} slots usable; ${parts.join('; ')}). Missing slots are unknown, not empty, so it is not treated as the full loadout.`);
    }
    for (const r of rejected) warnings.push(r.index < 0 ? `Profile equipment block was ignored (${r.reason}).` : `Equipment row ${r.index}${r.slot ? ` (${r.slot})` : ''} was rejected: ${r.reason}.`);
    if (unrecognized.length) warnings.push(`Equipment rows with unknown slot names were kept but not mapped: ${unrecognized.map((u) => u.slot).join(', ')}.`);
    for (const slot of EQUIPMENT_API_SLOTS) {
      const st = slots[slot];
      if (st.status === 'duplicate') warnings.push(`Slot ${slot} was reported more than once; none of its rows is used.`);
      if (st.status === 'invalid' && st.problems.some((p) => p.startsWith('missing-stat:'))) warnings.push(`Slot ${slot} has no usable stats (${st.problems.join(', ')}).`);
      const d = st.durability;
      if (d !== null && (d < DOCUMENTED_DURABILITY_RANGE.min || d > DOCUMENTED_DURABILITY_RANGE.max)) warnings.push(`Slot ${slot} durability ${d} is outside the documented ${DOCUMENTED_DURABILITY_RANGE.min}-${DOCUMENTED_DURABILITY_RANGE.max} range; kept as reported.`);
    }
  }
  return { reported, completeness, slots, unrecognized, rejected: [...rejected], counts, warnings };
}

export type ResolvedSlotStatus = 'present' | 'explicitEmpty' | 'missing' | 'invalid' | 'duplicate';
export type ResolvedSlotSource = 'api' | 'user' | 'unavailable';
export interface ResolvedSlot { status: ResolvedSlotStatus; source: ResolvedSlotSource; durability: number | null }
export interface ResolvedEquipment {
  /** A GearInput only when all six slots are resolved (an item or an explicit empty); otherwise null. Never a partial loadout. */
  gear: GearInput | null;
  /** Completeness of the RESOLVED loadout after user overrides. */
  completeness: EquipmentCompleteness;
  slots: Record<GearKey, ResolvedSlot>;
  unresolved: GearKey[];
  /** Slots where a user value replaced a usable API row. */
  overridden: GearKey[];
  sources: { api: GearKey[]; user: GearKey[] };
}

/**
 * Slot-level merge. A user value (an item or `{kind:'empty'}`) wins for its slot and is labelled `user`; every other slot comes from the
 * snapshot only when it is `present`. A slot that is missing/invalid/duplicate and not filled by the user stays unresolved.
 */
export function resolveEquipment(snapshot: EquipmentSnapshot | null, userGear?: GearInput | null): ResolvedEquipment {
  const slots = {} as Record<GearKey, ResolvedSlot>;
  const gear: GearInput = {};
  const overridden: GearKey[] = [], api: GearKey[] = [], user: GearKey[] = [], unresolved: GearKey[] = [];
  for (const api_slot of EQUIPMENT_API_SLOTS) {
    const k = API_SLOT_TO_GEAR[api_slot];
    const snap = snapshot?.slots[api_slot];
    const u = userGear?.[k];
    if (u !== undefined) {
      (gear as Record<string, unknown>)[k] = u;
      slots[k] = { status: u.kind === 'empty' ? 'explicitEmpty' : 'present', source: 'user', durability: null };
      user.push(k); if (snap?.status === 'present') overridden.push(k);
    } else if (snap?.status === 'present' && snap.item) {
      (gear as Record<string, unknown>)[k] = snap.item;
      slots[k] = { status: 'present', source: 'api', durability: snap.durability };
      api.push(k);
    } else {
      slots[k] = { status: snap?.status === 'invalid' || snap?.status === 'duplicate' ? snap.status : 'missing', source: 'unavailable', durability: null };
      unresolved.push(k);
    }
  }
  const resolved = GEAR_KEYS.length - unresolved.length;
  const completeness: EquipmentCompleteness = resolved === GEAR_KEYS.length ? 'complete' : resolved === 0 ? 'unknown' : 'partial';
  return { gear: completeness === 'complete' ? gear : null, completeness, slots, unresolved, overridden, sources: { api, user } };
}
