import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPlayerState, toWarBuildRequest, buildMarketSnapshot, offersToCandidates, goldFromMoney, economyPrices, toOptimizeRequest, optimizeBuild, importForBuild,
  recipeForMarketCode, rankFromCode, rankFromDamage, stackingCandidates, engineCleanHit, evaluateLoadouts, totalCost, SKILL_IDS,
  type ProfileLike, type CompanyLike, type ImportDeps, type MarketRowLike, type OfferLike,
} from '@/features/build-optimizer';
import { rankFormulas, type Observation } from '@/features/planner/evidence';

const fx = (f: string) => JSON.parse(readFileSync(`tests/fixtures/real/${f}`, 'utf8'));
const skills = fx('player-skills.json').skills as ProfileLike['skills'];
const profile = (o: Partial<ProfileLike> = {}): ProfileLike => ({ id: 'usr_1', name: 'Tester', countryId: 'eg', level: 22, damage: { total: '2549826', day: '0', week: '0', month: '0' }, skills, hasSkills: true, rankCode: null, ...o });
const market = fx('market.json') as MarketRowLike[];
const offers = fx('equipment-offers.json').offers as OfferLike[];
const companies = fx('companies.json').companies as CompanyLike[];
const approx = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);

describe('player state from the real profile shape', () => {
  it('maps API skill codes, ignores stamina, lists inferred mappings', () => {
    const s = buildPlayerState({ profile: profile() });
    const l = s.skills.levels.value!; assert.equal(s.skills.levels.source, 'api');
    assert.equal(l.attack, 5); assert.equal(l.accuracy, 4); assert.equal(l.critChance, 5); assert.equal(l.critDamage, 4);
    assert.equal(l.business, 1); assert.equal(l.leadership, 0); assert.equal(l.companySlots, 0); assert.equal(l.lootChance, 4);
    assert.ok(SKILL_IDS.every((k) => typeof l[k] === 'number'));
    assert.ok(s.skills.inferredMappings.includes('precision->accuracy'));
    assert.deepEqual(s.skills.unmapped, []); assert.equal(s.skills.spentPoints, totalCost(l));
  });
  it('skill points: earned, invested and available are separate; unknown Prestige is a lower bound, never a confirmed zero', () => {
    const s = buildPlayerState({ profile: profile() }); // fixture: level 22 (84 from levels), 85 invested
    assert.equal(s.skillPoints.earnedFromLevels, 84); assert.equal(s.skills.spentPoints, 85); assert.equal(s.skillPoints.invested, 85);
    assert.equal(s.skillPoints.prestigePoints, null); assert.equal(s.prestigeCount.value, null); assert.equal(s.prestigeCount.source, 'unavailable');
    assert.equal(s.skillPoints.impliedMinPrestige, 1); assert.equal(s.skillPoints.basis, 'lower-bound'); assert.equal(s.skillPoints.exact, false);
    assert.equal(s.skillPoints.earned.value, 88); assert.equal(s.skillPoints.available.value, 3); assert.ok(s.skillPoints.earned.note!.includes('LOWER BOUND'));
    assert.equal(s.skillPoints.consistent, true); assert.ok(s.warnings.some((w) => w.includes('at least 1 Prestige')));
    assert.ok(s.missing.some((m) => m.startsWith('exact skill-point ledger')));
    // not blocked: the optimizer runs on the lower bound and says so
    const r = toWarBuildRequest(s, { hits: 10, gearMode: 'optimize', candidates: { weapons: [] }, objective: { type: 'maxDamage' } });
    assert.ok(r.ok); if (r.ok) { assert.equal(r.request.player.totalPoints, 88); assert.ok(r.notes.some((n) => n.includes('LOWER BOUND'))); }
  });
  it('the ledger can be fixed by any one reliable input', () => {
    const byPrestige = buildPlayerState({ profile: profile(), user: { prestigeCount: 1 } });
    assert.equal(byPrestige.skillPoints.earned.value, 88); assert.equal(byPrestige.skillPoints.prestigePoints, 4); assert.equal(byPrestige.skillPoints.exact, true); assert.equal(byPrestige.skillPoints.available.value, 3);
    const byAvailable = buildPlayerState({ profile: profile(), user: { availableSkillPoints: 7 } }); // earned = 85 + 7 = 92 => 2 Prestige
    assert.equal(byAvailable.skillPoints.earned.value, 92); assert.equal(byAvailable.skillPoints.prestigePoints, 8); assert.equal(byAvailable.skillPoints.basis, 'user-available'); assert.equal(byAvailable.skillPoints.exact, true);
    const byTotal = buildPlayerState({ profile: profile(), user: { totalSkillPoints: 92 } }); assert.equal(byTotal.skillPoints.earned.source, 'user'); assert.equal(byTotal.skillPoints.available.value, 7);
    const none = buildPlayerState({ profile: profile({ skills: skills.map((x) => (x.code === 'attack' ? { ...x, level: 3 } : x)) }) }); // 85-11+4 = 78 invested <= 84
    assert.equal(none.skillPoints.earned.value, 84); assert.equal(none.skillPoints.exact, false); assert.equal(none.skillPoints.prestigePoints, null); assert.equal(none.skillPoints.available.value, 6);
  });
  it('supplied information that contradicts the invested points is flagged and blocks optimization', () => {
    const bad = buildPlayerState({ profile: profile(), user: { prestigeCount: 0 } }); // 85 invested but prestige 0 => 84 earned
    assert.equal(bad.skillPoints.consistent, false); assert.equal(bad.skillPoints.available.value, null); assert.ok(bad.warnings.some((w) => w.includes('contradicts')));
    assert.equal(toWarBuildRequest(bad, { hits: 10, gearMode: 'optimize', candidates: { weapons: [] }, objective: { type: 'maxDamage' } }).ok, false);
    const low = buildPlayerState({ profile: profile(), user: { totalSkillPoints: 80 } }); assert.equal(low.skillPoints.consistent, false);
  });
  it('user-supplied values win and are labelled', () => {
    const s = buildPlayerState({ profile: profile(), user: { totalSkillPoints: 92, prestigeCount: 0, firstResetFree: true, rankBonusPct: 3 } });
    assert.equal(s.skillPoints.earned.source, 'user');
    assert.equal(s.rank.bonusPct.value, 3); assert.equal(s.rank.bonusPct.source, 'user'); assert.equal(s.firstResetFree.value, true);
  });
  it('rank: recognised API code first, lifetime damage as the labelled fallback', () => {
    assert.equal(rankFromCode('Captain')!.bonusPct, 5); assert.equal(rankFromCode('rank_7'), null);
    assert.equal(rankFromDamage('4999').code, 'volunteer'); assert.equal(rankFromDamage('5000').code, 'fighter'); assert.equal(rankFromDamage('200000000').bonusPct, 12);
    const d = buildPlayerState({ profile: profile() }); assert.equal(d.rank.name.value, 'captain'); assert.equal(d.rank.bonusPct.value, 5); assert.equal(d.rank.bonusPct.source, 'derived'); // 2,549,826 lifetime damage
  });
  it('uses the profile attack bonus when it matches the Wiki rank table, and keeps rank metadata', () => {
    const dmg = (total: string | null) => ({ total, day: '0', week: '0', month: '0' });
    // Wiki 01-basics §2.6: General starts at 50,000,000 lifetime damage and gives +8%
    const s = buildPlayerState({ profile: profile({ rankCode: 'general', rankAttackBonusPercent: 8, rankMinDamage: 50000000, damage: dmg('50000000') }) });
    assert.equal(s.rank.bonusPct.value, 8); assert.equal(s.rank.bonusPct.source, 'api'); assert.equal(s.rank.minDamage.value, 50000000);
    assert.ok(!s.warnings.some((w) => w.includes('disagrees')));
    const noDamage = buildPlayerState({ profile: profile({ rankCode: 'general', rankAttackBonusPercent: 9, damage: dmg(null) }) });
    assert.equal(noDamage.rank.bonusPct.value, 9); assert.equal(noDamage.rank.bonusPct.source, 'api'); // nothing to check it against
    assert.ok(noDamage.rank.bonusPct.note?.includes('not cross-checked'));
    const fallback = buildPlayerState({ profile: profile({ rankCode: 'general', rankAttackBonusPercent: null, damage: dmg('50000000') }) });
    assert.equal(fallback.rank.bonusPct.value, 8); assert.equal(fallback.rank.bonusPct.source, 'derived'); // local code table fallback
  });
  it('wiki: an API rank bonus that disagrees with the Wiki table does not redefine the mechanic', () => {
    // 2,549,826 lifetime damage is Captain (>= 1,500,000, < 5,000,000): +5% in the Wiki table
    const s = buildPlayerState({ profile: profile({ rankCode: 'captain', rankAttackBonusPercent: 9, damage: { total: '2549826', day: '0', week: '0', month: '0' } }) });
    assert.equal(s.rank.bonusPct.value, 5); assert.equal(s.rank.bonusPct.source, 'derived');
    assert.ok(s.warnings.some((w) => w.includes('9%') && w.includes('Wiki') && w.includes('5%')));
    const r = toOptimizeRequest(s, { objective: { type: 'maxDamagePerHit' } }); assert.ok(r.ok); if (r.ok) assert.equal(r.request.combat.rankBonusPct, 5);
    const overridden = buildPlayerState({ profile: profile({ rankCode: 'captain', rankAttackBonusPercent: 9, damage: { total: '2549826', day: '0', week: '0', month: '0' } }), user: { rankBonusPct: 9 } });
    assert.equal(overridden.rank.bonusPct.value, 9); assert.equal(overridden.rank.bonusPct.source, 'user');
  });
  it('keeps API Prestige out of the unverified point formula while forwarding profile data', () => {
    const s = buildPlayerState({ profile: profile({ prestige: 7 }) });
    assert.equal(s.prestigeCount.value, 7); assert.equal(s.prestigeCount.source, 'api');
    assert.equal(s.skillPoints.earned.value, 88); assert.equal(s.skillPoints.exact, false); // same lower-bound ledger as legacy profile
    const req = toOptimizeRequest(s, { objective: { type: 'maxDamagePerHit' } });
    assert.ok(req.ok); if (req.ok) { assert.equal(req.request.player.prestigeCount, undefined, 'API Prestige is display-only and must not reach the engine request'); assert.equal(req.request.player.totalPoints, 88); }
    const u = toOptimizeRequest(buildPlayerState({ profile: profile({ prestige: 7 }), user: { prestigeCount: 2 } }), { objective: { type: 'maxDamagePerHit' } });
    assert.ok(u.ok); if (u.ok) assert.equal(u.request.player.prestigeCount, 2, 'a user-supplied Prestige count is what the ledger used, so it is forwarded');
  });
  it('retains profile equipment separately and maps only recognized snapshot slots', () => {
    const equipment: NonNullable<ProfileLike['equipment']> = [
      { slot: 'weapon', itemCode: 'knife', rarity: 'rare', stats: { attack: 70, criticalChance: 10 }, durability: 82 },
      { slot: 'helmet', itemCode: 'helm', rarity: 'common', stats: { criticalDamages: 12 }, durability: 90 },
      { slot: 'gloves', itemCode: 'glove', rarity: 'common', stats: { precision: 3 }, durability: 90 },
      { slot: 'chest', itemCode: 'chest', rarity: 'common', stats: { armor: 4 }, durability: 90 },
      { slot: 'pants', itemCode: 'pants', rarity: 'common', stats: { armor: 2 }, durability: 90 },
      { slot: 'boots', itemCode: 'boots', rarity: 'common', stats: { dodge: 1 }, durability: 90 },
    ];
    const s = buildPlayerState({ profile: profile({ equipment }) });
    assert.equal(s.equipmentSnapshot.source, 'api'); assert.equal(s.equipmentSnapshot.value?.length, 6);
    assert.equal(s.gear.source, 'api'); assert.deepEqual(s.gear.value?.weapon, { kind: 'item', stats: { attack: 70, critChance: 10, usesAmmo: false } });
    assert.deepEqual(s.gear.value?.legs, { kind: 'item', stats: { armor: 2 } });
    const request = toWarBuildRequest(s, { hits: 10, gearMode: 'fixed', objective: { type: 'maxDamage' } });
    assert.ok(request.ok); if (request.ok && request.request.gear.mode === 'fixed') assert.deepEqual(request.request.gear.gear, s.gear.value);
    assert.equal(s.economy.source, 'unavailable');
  });
  it('retains historical economy without treating it as a forecast input', () => {
    const economy = { lifetime: { from: null, to: null, shiftsWorked: 20, employeeShifts: 2, unitsProduced: 3, wagesEarned: '1000', marketBuys: null, marketSells: null }, recent: null, companies: 1 };
    const s = buildPlayerState({ profile: profile({ economy }) });
    assert.equal(s.economy.value?.lifetime?.shiftsWorked, 20); assert.equal(s.economy.source, 'api');
    assert.equal(toOptimizeRequest(s, { objective: { type: 'maxDamagePerHit' } }).ok, true);
  });
  it('unavailable data stays unavailable (never zero)', () => {
    const s = buildPlayerState({ profile: profile({ skills: [], hasSkills: false, level: null }) });
    assert.equal(s.skills.levels.value, null); assert.equal(s.level.value, null); assert.ok(s.missing.includes('skills') && s.missing.includes('level'));
    assert.equal(s.gear.value, null); assert.equal(s.pill.value, null); assert.equal(s.currentHealthHunger.source, 'unavailable');
    const partial = buildPlayerState({ profile: profile({ skills: skills.filter((x) => x.code !== 'attack') }) });
    assert.equal(partial.skills.levels.value, null); // one missing skill is not silently 0
    assert.equal(toOptimizeRequest(partial, { objective: { type: 'maxDamagePerHit' } }).ok, false);
  });
  it('flattens the raw stats body without inventing field meanings', () => {
    const s = buildPlayerState({ profile: profile(), statsRaw: { level: 22, damage: { all: '5', today: '1' }, work: { week: 3 } } });
    assert.deepEqual(s.stats.value, { level: '22', 'damage.all': '5', 'damage.today': '1', 'work.week': '3' });
  });
});

describe('market and equipment from real responses', () => {
  it('money conversion is exact', () => { approx(goldFromMoney('5400'), 0.54); approx(goldFromMoney(1234567n), 123.4567); approx(goldFromMoney('0'), 0); });
  it('snapshot and economy prices (unknown stays unknown)', () => {
    const m = buildMarketSnapshot(market);
    assert.equal(m.ask.lead, goldFromMoney('5400')); assert.equal(m.bid.livestock, null);
    const p = economyPrices(m, 'bid'); assert.equal(p.cattle?.buy, undefined); assert.equal(p.lead?.buy, goldFromMoney('5400'));
    assert.equal(p.stimulant !== undefined, true);
  });
  it('item code mapping', () => {
    assert.equal(recipeForMarketCode('steel')!.pointsPerUnit, 8); assert.equal(recipeForMarketCode('lightAmmo')!.itemCode, 'lightBullets');
    assert.equal(recipeForMarketCode('livestock')!.pointsPerUnit, 20); assert.equal(recipeForMarketCode('jet'), null);
  });
  it('offers become Pareto-pruned loadout candidates', () => {
    const r = offersToCandidates(offers, { maxPerSlot: 3 });
    assert.ok(r.candidates.weapons.length >= 1);
    for (const w of r.candidates.weapons) assert.ok(typeof w.stats.attack === 'number' && w.price! > 0);
    for (const list of [r.candidates.helmets, r.candidates.chests, r.candidates.boots]) assert.ok(!list || list.length <= 3);
    const dup = offersToCandidates([{ ...offers[0]!, offerId: 'a', price: '100000' }, { ...offers[0]!, offerId: 'b', price: '200000' }]); // same stats, dearer
    const all = Object.values(dup.candidates).flat(); assert.equal(all.filter((x) => x).length, 1);
    assert.deepEqual(offersToCandidates([{ offerId: 'x', itemCode: 'c', slot: 'cape', price: '1', durability: 5, stats: {} }]).skipped.map((s) => s.reason), ['unknown slot cape']);
  });
  it('real candidates feed the loadout search', () => {
    const { candidates } = offersToCandidates(offers, { maxPerSlot: 2 });
    const r = evaluateLoadouts(candidates, { levels: buildPlayerState({ profile: profile() }).skills.levels.value!, booster: 'none', hits: 100, ammoOptions: ['none', 'light'], leadPrice: 0.54, objective: 'maxDamage' });
    assert.ok(r.ok && r.results.length > 0);
  });
});

describe('end to end: imported player -> scenario -> engine', () => {
  const deps = (over: Partial<ImportDeps> = {}): ImportDeps => ({
    profile: async () => ({ player: profile() }), companies: async () => ({ rows: companies.filter((c) => ['steel', 'concrete', 'lead'].includes(c.itemCode)).slice(0, 3) }),
    stats: async () => ({ level: 22 }), market: async () => ({ rows: market }), offers: async (slot) => ({ rows: offers.filter((o) => o.slot === slot) }), ...over });
  it('import reports failures and keeps the rest', async () => {
    const r = await importForBuild('usr_1', deps({ companies: async () => { throw new Error('boom'); }, offers: async (s) => { if (s === 'boots') throw new Error('x'); return { rows: offers.filter((o) => o.slot === s) }; } }));
    assert.ok(r); assert.equal(r!.failures.companies, 'boom'); assert.equal(r!.failures['equipment:boots'], 'x'); assert.equal(r!.state.companies.count, null);
    assert.ok(r!.state.missing.some((m) => m.startsWith('companies')));
    assert.equal(await importForBuild('u', deps({ profile: async () => ({ player: null }) })), null);
    await assert.rejects(() => importForBuild('u', deps({ profile: async () => { throw new Error('down'); } })));
  });
  it('military optimization from real imported data keeps owned companies and never reduces skills when reset is off', async () => {
    const imp = (await importForBuild('usr_1', deps(), { totalSkillPoints: 95, prestigeCount: 0, firstResetFree: false }))!;
    const sc = toOptimizeRequest(imp.state, { objective: { type: 'maxDamagePerHit' }, allowReset: false, market: imp.market!, ammo: 'none' });
    assert.ok(sc.ok); if (!sc.ok) return;
    const res = optimizeBuild(sc.request); assert.ok(res.ok); if (!res.ok) return;
    const cur = imp.state.skills.levels.value!;
    for (const b of res.builds) { assert.ok(!b.resetRequired); for (const k of SKILL_IDS) assert.ok(b.levels[k] >= cur[k]); assert.ok(b.mandatoryPreserved.includes('cap:companies:owned')); assert.ok(b.pointsSpent <= 95); }
    assert.ok(res.builds[0]!.hit.missing.includes('gear.weapon')); // gear unknown is reported, not assumed
    assert.ok(sc.notes.some((n) => n.includes('gear unknown') || n.includes('Equipped gear unknown')));
  });
  it('economy and hybrid objectives work on the imported companies and real prices', async () => {
    const imp = (await importForBuild('usr_1', deps(), { totalSkillPoints: 110, gear: { weapon: { kind: 'empty' }, helmet: { kind: 'empty' }, gloves: { kind: 'empty' }, chest: { kind: 'empty' }, legs: { kind: 'empty' }, boots: { kind: 'empty' } } }))!;
    const sc = toOptimizeRequest(imp.state, { objective: { type: 'maxEconomy' }, market: imp.market!, taxes: { marketPct: 5, incomePct: 5 }, job: { wagePerPoint: 0.8 }, allowReset: false });
    assert.ok(sc.ok); if (!sc.ok) return;
    const eco = optimizeBuild(sc.request); assert.ok(eco.ok || eco.reason === 'infeasible');
    const hy = toOptimizeRequest(imp.state, { objective: { type: 'hybrid', mode: 'constrained', minDailyNet: -1e9 }, market: imp.market!, taxes: { marketPct: 5 }, allowReset: false });
    assert.ok(hy.ok); if (!hy.ok) return;
    const r = optimizeBuild(hy.request); assert.ok(r.ok || r.reason === 'infeasible');
    if (r.ok) assert.ok(r.builds[0]!.economy !== null);
    const noMarket = toOptimizeRequest(imp.state, { objective: { type: 'maxEconomy' } }); assert.ok(!noMarket.ok && noMarket.missing.includes('market snapshot'));
  });
  it('pill analysis runs on an imported player with an explicit state', async () => {
    const imp = (await importForBuild('usr_1', deps(), { totalSkillPoints: 95, pill: { kind: 'none' } }))!;
    const sc = toOptimizeRequest(imp.state, { objective: { type: 'maxDamagePerHit' }, pill: { schedule: [{ startMinutes: 0, durationMinutes: 30, hits: 80 }], cost: { mode: 'buy', marketPrice: goldFromMoney('90000') } } });
    assert.ok(sc.ok); if (!sc.ok) return;
    const r = optimizeBuild(sc.request); assert.ok(r.ok); if (r.ok) { const p = r.builds[0]!.pill!; assert.ok(p.ok && p.stateUsed.kind === 'none'); }
    const unknown = toOptimizeRequest((await importForBuild('usr_1', deps(), { totalSkillPoints: 95 }))!.state, { objective: { type: 'maxDamagePerHit' }, pill: { schedule: [{ startMinutes: 0, durationMinutes: 30, hits: 80 }], cost: { mode: 'owned' } } });
    assert.ok(unknown.ok); if (unknown.ok) { const r2 = optimizeBuild(unknown.request); assert.ok(r2.ok); if (r2.ok) { const pa = r2.builds[0]!.pill!; assert.ok(!pa.ok && pa.reason === 'state-unknown'); } }
  });
});

describe('bridge to the existing evidence gate', () => {
  it('candidates agree with the engine on a clean hit (ammo + rank only; the Pill is not an input)', () => {
    for (const stacking of ['additive', 'multiplicative'] as const) {
      const e = engineCleanHit({ ammo: 'medium', rankPct: 4, stacking });
      const c = stackingCandidates.find((x) => x.id === (stacking === 'additive' ? 'stack.additive' : 'stack.multiplicative'))!;
      approx(c.predict({ attackSkill: 100, weaponAttack: 30, ammoPct: 25, rankPct: 4 }), e);
    }
  });
  it('real observations would let the planner decide how ammo and rank combine', () => {
    const obs: Observation[] = [];
    for (const ammoPct of [0, 12, 25, 45]) for (const rankPct of [0, 1, 4, 8, 12]) for (const attackSkill of [100, 250, 400]) {
      const inputs = { attackSkill, weaponAttack: 60, ammoPct, rankPct };
      obs.push({ inputs, observed: Math.floor((attackSkill + 60) * (1 + ammoPct / 100) * (1 + rankPct / 100)) });
    }
    const ranked = rankFormulas(stackingCandidates, obs, { variedInputs: ['ammoPct', 'rankPct', 'attackSkill'], tolerance: 1 });
    assert.equal(ranked[0]!.id, 'stack.multiplicative'); assert.equal(ranked[0]!.confidence, 'verified'); assert.notEqual(ranked[1]!.confidence, 'verified');
  });
});
