# Build Optimizer - Wiki conformance record

Source hierarchy used for this record: (1) the Age of Nations Wiki files (`01-basics`, `02-economy`, `03-war`, `04-politics`, `05-community`) are authoritative for game mechanics; (2) the project specification and audit documents guide the implementation; (3) the API documentation and recorded responses say which data exists, never how a mechanic works; (4) the source code is the thing being checked; (5) synthetic fixtures are test aids only.

No formula in this project is labelled **Verified**: that label is reserved for in-game observation. **Documented** means the Wiki states it.

## Implemented per the Wiki

| Mechanic | Wiki source | Implementation | Test |
|---|---|---|---|
| Damage pipeline: skill attack + weapon attack, then personal boosts, accuracy, crit, luck, battle bonuses, round down | 03-war §1.6 | `engine/combat.ts` `computeHit` | `wiki: hit pipeline` |
| Ammo, stimulant (Pill) and rank bonuses are **summed** and applied to (skill + weapon) attack | 03-war §1.6 step 2; 01-basics §3.5-3.6 | `computeHit` (`personalMultiplier`) | `wiki: personal boosts are summed` |
| Round down, minimum damage 1; the per-hit score is the weighted sum of rounded outcomes | 03-war §1.6 step 7 | `computeHit` (`expected`; `expectedUnrounded` is diagnostic only) | `wiki: rounding and minimum damage` |
| Luck: +-10 % **range** | 03-war §1.6 step 5 | `minPerHit` / `maxPerHit` | `wiki: luck range only` |
| Accuracy = clean-hit chance, graze 50 %, crit only on clean hits, crit adds the crit-damage percentage | 03-war §1.6 steps 3-4; 01-basics §2.4 | `computeHit` | `wiki: hit pipeline`, `wiki: critical damage adds a percentage` |
| Accuracy / crit chance cap 100; excess = +3 Attack / +3 Critical Damage per point | 01-basics §2.4 | `computeHit` | `wiki: accuracy and crit chance stop at 100...` |
| Firearm without ammo adds nothing and does not wear; knife needs none | 01-basics §3.5 | `computeHit`, `adapter/equipment-snapshot.ts` (`AMMO_EXEMPT_ITEM_CODES`) | `wiki: a firearm without ammunition...` |
| Battle bonuses capped at +100 %, penalties at -50 % | 03-war §1.7 | `battleModifierPct` | `wiki: battle bonus caps` |
| Rank bonus by lifetime damage; the API percentage may not redefine it | 01-basics §2.6 | `adapter/player-state.ts` | `rank thresholds...`, `wiki: an API rank bonus that disagrees...` |
| Skill costs, endpoints, unlock levels, reset cost | 01-basics §2.4-2.5 | `engine/skills.ts` | existing `review.test.ts` |
| Ammo %, food %, rarity ranges, crate odds, recipes | 01-basics §2.3, §3.3-3.5, §4.4; 02-economy §1.2 | engine constants | `ammunition and food`, `rarity stat ranges`, `Field Crate odds and recipes` |
| Durability: 100 at start, 1 per hit, dodge protects armor, broken at 0 | 01-basics §3.4 | `engine/loadout.ts`, `engine/sustainable.ts`; profile durability seeds Fixed Gear in `run.ts` | `profile durability reaches the Sustainable model...` |
| Weapons without ammo never dominated away (Pareto pruning) | 01-basics §3.5 | `adapter/market.ts` | `pareto-ammo.test.ts` |

## Wiki is silent or ambiguous - kept explicitly unresolved

| Item | What the Wiki says | What the engine does |
|---|---|---|
| Luck distribution | only the +-10 % range | no distribution assumed; the central figure uses luck 1.0 and says so (`combat.luck.distribution`, Unverified) |
| Where excess accuracy enters the pipeline | "becomes Attack" | counted as Attack in step 1 (`combat.overflow.order`, Unverified, flagged only when overflow occurs) |
| Earned points after Prestige | +4 per Prestige, points returned, level drops | API Prestige is displayed, never folded into the total; the ledger is a lower bound unless the user supplies a total (`skills.pointsEarned.prestigeInteraction`, Unverified) |
| Skill values between level 0 and 10 | only the two endpoints | linear interpolation, labelled Estimated |
| Armor / dodge point -> percentage | "armor reduces by the protection percentage", thresholds 45 / 36 | 1 point = 1 %, labelled Estimated (`combat.sustain`) |
| Health reserve before a hit | "hits you could afford are counted" | engine reserve of 10 health, labelled as an engine assumption |
| Meaning of the profile `equipment` array | not a Wiki matter (API data) | treated as a possibly partial snapshot; missing slots are unknown, never empty |

## Corrections made against the Wiki in this phase

1. The Pill was modelled as an Attack-skill-only modifier outside the personal-boost sum. The Wiki lists the stimulant among the summed personal boosts, so it now enters the sum. An earlier owner description of the old model is recorded in `combat.booster`; there is no switch back.
2. Scoring used unrounded damage. It now uses the Wiki's round-down / minimum-1 outcomes.
3. The critical multiplier was labelled Unverified. The Wiki ("extra damage", "adds the critical damage percentage") documents `1 + critDamage/100`.
4. A cheaper, stronger firearm no longer removes an ammo-free weapon from the candidates.
5. An API rank percentage that disagrees with the Wiki rank table no longer wins; a warning is shown and the user may override.


## Batch 4 - registry audit (47 entries)

Method: each entry was read against the Wiki sections named in its `source`; constants were pinned in `tests/build-optimizer/wiki-registry-audit.test.ts` from a table typed out of the Wiki (not read from the engine); behaviour was compared with an independent re-implementation (`tests/build-optimizer/oracle.ts`). "Match" means implementation correctness against the Wiki text. It never promotes a status: Verified would need in-game confirmation, so **0 entries are Verified**. Classification (unchanged): **28 Documented** (20 mechanics + 8 algorithms), **15 Estimated**, **4 Unverified**, **0 Verified**. A status change now fails `wiki-registry-audit.test.ts` until the pin is edited deliberately.

| # | Entry | Status | Wiki source | Result of the audit | Open point / evidence needed |
|---|---|---|---|---|---|
| 1 | `combat.battleBonus` | documented | 03-war §1.7 | Match: positives summed and capped at +100%, penalties summed and capped at -50%, separately. | Per-bonus eligibility (side, ownership) is supplied by the caller / battle screen, not derived. |
| 2 | `combat.booster` | documented | 01-basics §3.6; 03-war §1.6 step 2 | Match: +50% / -50% enters the summed personal boosts. Oracle fuzz covers all three phases. | - |
| 3 | `combat.bounty` | documented | 03-war §3.1 | Match with the written rules (rate 0.01-5 per 1,000, payout per hit up to the reserved budget, managers excluded). Existing test only; not re-derived. | Whether a payout is per hit or per damage unit rounding is not stated. |
| 4 | `combat.conventions.whatif` | unverified | 01-basics §2.4; 03-war §1.6 | Alternative readings (crit multiplier, additive vs multiplicative stacking) kept as what-if switches; defaults follow the Wiki. | Needs in-game readings with a known stat set. |
| 5 | `combat.critMultiplier` | documented | 01-basics §2.4; 03-war §1.6 step 4 | Match under the reading "adds the critical damage percentage": multiplier = 1 + critDamage/100. Oracle fuzz 400. | If the in-game value were the total multiplier, the what-if switch covers it. |
| 6 | `combat.hitOutcomes` | documented | 03-war §1.6 steps 3-4 | Match: accuracy = clean-hit probability; graze = 50% and cannot crit; crit only on clean hits. Oracle fuzz 400. | - |
| 7 | `combat.luck` | documented | 03-war §1.6 step 5 | Match for the stated +-10% range (min / max per hit equal the oracle on 400 inputs). | - |
| 8 | `combat.luck.distribution` | unverified | 03-war §1.6 step 5 (silent) | Expected value uses neutral luck; the shape of the distribution is not in the Wiki. | Needs a battle-log sample. |
| 9 | `combat.overflow` | documented | 01-basics §2.4 | Match: accuracy above 100 -> +3 Attack per point; crit chance above 100 -> +3 critical damage per point. Observation: with Wiki ranges crit chance cannot exceed 98 (50 + 48), so that half is only reachable synthetically; tested synthetically. | - |
| 10 | `combat.overflow.order` | unverified | 01-basics §2.4 (rate) / 03-war §1.6 (order not stated) | Engine adds overflow Attack before the personal multiplier; the Wiki gives the rate but not the position in the order. | Needs an in-game reading with accuracy above 100. |
| 11 | `combat.personalBoost` | documented | 03-war §1.6 steps 1-2 | Match: ammo + stimulant + rank are summed, then applied to skill attack + weapon attack. Oracle fuzz 400. | - |
| 12 | `combat.rounding` | documented | 03-war §1.6 step 7 | Match in computeHit. DISCREPANCY FOUND in the War Build search (see Corrections, item 6): ranking used unrounded damage. Corrected. | - |
| 13 | `combat.sustain` | estimated | 01-basics §2.2/§2.4; 03-war §1.5 | Documented parts match (10 health per hit, armor reduces it, minimum 1, thresholds 45 / 36 at 50%). Estimated part: 1 armor / dodge point = 1 percentage point. | Needs an in-game reading of health lost per hit at known armor. |
| 14 | `combat.weaponAmmo` | documented | 01-basics §3.5 | Match: a firearm without ammo adds nothing and does not wear; the knife needs none. Oracle edge cases. | - |
| 15 | `constraints.resolve` | documented | project requirement (spec §2.2, §3.4) | Implementation correctness: agrees with exhaustive per-level filtering on 300 seeded cases (feasible and contradictory) plus invalid-input edge cases. | - |
| 16 | `econ.barRegen` | documented | 01-basics §1.3/§2.2; 02-economy §1.5/§2.2 | Match: 10% of max per hour, work costs 10, steady state 0.24 x max works per day. | - |
| 17 | `econ.dailyNet` | estimated | 02-economy §1.5/§1.9/§2.2/§2.4 | Engine composition of documented parts; storage caps, upgrade amortisation and shipping not modelled. Existing tests only. | - |
| 18 | `econ.pointsPerWork` | estimated | 02-economy §1.4/§1.6 | Production skill value x (1 + bonuses): matches; the Wiki says bonuses accumulate but not whether they add or multiply (summed = estimate). Linked test was MISSING; added. | Needs one in-game company with two bonuses. |
| 19 | `econ.unitValue` | estimated | 02-economy §1.2/§2.5/§4.4 | Engine formula; production-tax carry fractions ignored. Existing test. | - |
| 20 | `gear.rarityRanges` | documented | 01-basics §3.3; project owner 2026-10-31 | Match: all 36 range cells compared with a table typed from the Wiki. | - |
| 21 | `loadout.durability` | estimated | 01-basics §3.4/§3.5 | Documented parts match (100 durability, 1 per hit, only the weapon wears on a dodge, none without ammo). Replacement counting / pricing is an engine policy. Oracle compares replacement costs. | Helmet / gloves wear is searched conservatively (see Limitations). |
| 22 | `loadout.food` | estimated | 01-basics §2.3 | Restore percentages match (12 / 18 / 25% of max health). Meal count formula, 10-health reserve and food choice are engine design. Oracle re-implements them independently. | Whether a hit needs full health is not stated. |
| 23 | `loadout.search` | documented | engine design | Implementation correctness: equals full enumeration (oracle, War Build cases). | - |
| 24 | `objective.hybrid` | estimated | engine design | Not re-audited in this batch (existing tests). | - |
| 25 | `objective.maxDamagePerHit` | estimated | engine design on combat.* | Per-hit objective uses computeHit (rounded); consistent with the oracle. | - |
| 26 | `objective.maxEconomy` | estimated | engine design on econ.* | Not re-audited in this batch (existing tests). | - |
| 27 | `objective.maxNetValue` | estimated | engine design | Net = gold per damage x damage + crate value - cost; oracle equals engine on 80 maxNet cases (after Correction 6). | - |
| 28 | `pill.plan` | estimated | engine design | Plan damage equals an independent phase-weighted sum (new test). Linked test was MISSING; added. Hits assumed uniform over the battle window. | - |
| 29 | `pill.timeline` | documented | 01-basics §3.6; 03-war §1.6 step 2 | Match: 360 min +50%, 720 min -50%, no new Pill until both phases end. Constants pinned. | - |
| 30 | `rank.bonus` | documented | 01-basics §2.6 | Match: ten thresholds and bonuses incl. +8% -> +12%; boundary values tested (one below / at each threshold). | The rank name "Commander" comes from a translation in the supplied Wiki text; code names follow the API spelling. |
| 31 | `rewards.contract` | estimated | 03-war §3.3 | Payout = damage done value minus 10% of the unfinished value; arithmetic is the engine reading of the Wiki sentence. | Needs a settled contract example. |
| 32 | `rewards.loot` | documented | 01-basics §4.2/§4.4; 03-war §1.10 | Match for per-hit crate chance = loot chance and the odds table (sum 100%). NOT modelled: crates distributed at round / battle end (150k / 400k damage), badges. | Declared limitation, not a mismatch. |
| 33 | `skills.cost` | documented | 01-basics §2.4 | Match: 1,1,2,3,4,5,6,8,9,10; cumulative 49. | - |
| 34 | `skills.pointsEarned` | documented | 01-basics §2.1/§2.8; project owner 2026-10-31 | Match: 4 per level above 1 (level 22 -> 84, owner-confirmed) + 4 per Prestige. | - |
| 35 | `skills.pointsEarned.prestigeInteraction` | unverified | 01-basics §2.1/§2.8 | Total after the Prestige level drop is not stated; an unknown Prestige is never treated as 0. | Needs a prestiged player with known points. |
| 36 | `skills.resetCost` | documented | 01-basics §2.5 | Match: 0.5 gold per spent point, first reset free. | - |
| 37 | `skills.unlock` | documented | 01-basics §2.4 | Match: all 14 unlock levels (player level). | - |
| 38 | `skills.value.endpoints` | documented | 01-basics §2.4 | Match: all 28 endpoint values. | - |
| 39 | `skills.value.linear` | estimated | modelling assumption | Linear interpolation between the two Wiki endpoints. | Needs in-game values at levels 1-9. |
| 40 | `solver.exhaustive` | documented | engine design | Implementation correctness: top-3 equals the oracle (score, preferences, points, level order) on 82 feasible cases; infeasible cases agree. | - |
| 41 | `solver.twoGroup` | documented | engine design | Best pair equals all-pairs enumeration on 100 cases; Pareto front verified on 200 sets. Only the top result is guaranteed (dominated entries are pruned). | - |
| 42 | `sustain.search` | documented | engine design | Equals enumeration of the public session evaluator on 39 cases. | See Limitations (Sustainable still ranks by unrounded damage). |
| 43 | `sustain.session` | estimated | 01-basics §2.2-2.4, §3.4-3.5; 03-war §1.5 | Engine design on documented parts; used as the evaluator in the enumeration test (not independently re-implemented). | - |
| 44 | `war.fixedGear` | documented | project owner 2026-10-31 | Fixed gear needs all six slots, no acquisition cost or replacement; oracle fixed-gear cases 60. | - |
| 45 | `war.objectives` | documented | engine design; project owner 2026-10-31 | Objective semantics (maxDamage, bestValue, maxNet, roles) re-implemented independently; equal on 291 optimality comparisons after Correction 6. | - |
| 46 | `war.search` | documented | engine design | Equals full enumeration on 291 feasible cases, 25 infeasible, 24 conflict. | - |
| 47 | `war.session` | estimated | 01-basics §2.2-2.4, §3.4-3.5; 03-war §1.5; engine design | Cost and survival model re-implemented independently from the registry text; equal. | - |

### Corrections (Batch 4)

6. **War Build search ranked by unrounded damage** (completes correction 2 above). Registry `combat.rounding` and the reported damage use the Wiki's round-down / minimum-1 outcomes, but `war-build.ts` ranked offense, applied the `bestValue` share threshold and computed net value with the unrounded expected damage. Near a threshold the two disagree by up to about 0.5 damage per hit (roughly 0.4% at 120 damage per hit). Failing inputs (found by the randomized oracle, pinned in `tests/build-optimizer/regression-war-search-rounding.test.ts`): seed 20347 bestValue share 0.5 returned a primary build with 49.9973% of the best reported damage (4110.80, cost 294) instead of 7186.14 at cost 323; seeds 20319 / 20583 returned a best-value role at 79.91% of the best damage (cost 180) and a role costing 185 where 2024 damage at cost 57 qualified. Fix: one expression in `war-build.ts` (offense value now uses the same floored outcomes as `computeHit`). Impact on 600 seeded cases: 516 feasible, primary build changed in 1 (the threshold flip above), any returned build changed in 3; no case changed status. Sustainable search: same expression exists (`sustainable.ts`); 247 random cases and a scan of offense allocations found no ordering difference, so it was NOT changed (see Limitations).

### Wiki ambiguities still unresolved

- Whether a hit needs full health (engine reserves 10 health; labelled an engine assumption).
- Armor / dodge points to percentage (1 point = 1% is an estimate).
- Luck distribution inside the +-10% range.
- Position of overflow Attack relative to the personal boosts.
- Whether production bonuses add or multiply (`econ.pointsPerWork`).
- Total skill points after a Prestige level drop.
- Crates distributed at round / battle end and badges are described by the Wiki but not modelled.
- Wiki table gives only endpoints for skills; values at levels 1-9 are interpolated.

### Limitations recorded by the audit

- The War Build search values helmet and gloves wear conservatively (1 durability per hit) while reported costs use dodge-adjusted wear; with a gold budget and low helmet / gloves durability the search can miss a build that is feasible with exact wear. It never returns an infeasible build. Randomized tests keep helmet / gloves durability high; chest, legs, boots and weapon replacements are compared exactly.
- `solver.twoGroup` guarantees the best result only; second and third alternatives from pruned fronts may be missing.
- The Sustainable search still ranks by unrounded expected damage (same expression as the corrected War Build one); no failing input exists; one-line fix identified if one appears.
