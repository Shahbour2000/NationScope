# Build Optimizer — formula and evidence audit

Status labels (used consistently in code, tests and reports):

- **Documented** — stated in the official wiki supplied with the project (or by the project owner) and implemented as written.
- **Estimated** — a modelling choice that fills a gap in the documentation; reasonable but not confirmed.
- **Unverified** — the wiki is ambiguous or silent; implemented behind a configurable switch.
- **Verified** — confirmed by real in-game observations or API captures. **Nothing is Verified yet.** Passing tests do not make a formula Verified.

Engine algorithms (search, constraint folding, objective definitions) are marked `kind: 'algorithm'` in the registry: their correctness is covered by tests (including brute-force equivalence), not by game evidence.

| Mechanic | Registry id | Current formula / logic | Status | Missing evidence |
|---|---|---|---|---|
| Skill cost | `skills.cost` | 1,1,2,3,4,5,6,8,9,10 per level; 49 to reach level 10 | Documented | none required |
| Skill endpoints and unlocks | `skills.value.endpoints`, `skills.unlock` | Level-0 and level-10 values and unlock levels from the wiki table (cross-checked line by line) | Documented | none required |
| Intermediate skill values | `skills.value.linear` | linear interpolation between level 0 and 10 | Estimated | one in-game reading of every skill at levels 1-9 (the Skills page) |
| Earned skill points | `skills.pointsEarned` | 4 × (level − 1) (level 22 = 84, confirmed by the owner) + 4 per Prestige | Documented | none for the level part |
| Prestige | `skills.pointsEarned.prestigeInteraction` | Prestige count is **unknown** unless supplied; unknown Prestige yields a lower bound for earned points (never a confirmed 0); invested > 4 × (level − 1) implies at least ⌈(invested − 4 × (level − 1)) / 4⌉ Prestige | Unverified | one of: prestigeCount, earned total, or the available (unspent) points shown on the Skills page; how the post-Prestige level interacts with the +4 per Prestige |
| Reset cost | `skills.resetCost` | 0.5 gold per invested point; first reset free | Documented | whether the first reset is still available (not exposed) |
| Damage pipeline order | `combat.hitOutcomes` | skill+weapon attack → personal boosts → accuracy → crit → luck → battle bonuses → floor, min 1 | Documented (order) | rounding at each stage |
| Accuracy / graze | `combat.hitOutcomes` | accuracy % = clean-hit chance, graze = 50 % damage, no crit | Documented | none |
| Critical hits | `combat.hitOutcomes` | crit only on clean hits with probability crit chance | Documented | none |
| Critical multiplier | `combat.critMultiplier` | 1 + critDamage / 100 (switch: critDamage / 100) | Unverified | a clean critical hit and a clean non-critical hit at known stats |
| Luck | `combat.luck` | ±10 %; expected value assumes mean 1; range reports 0.9 / 1.1 | Unverified | distribution of luck over many hits |
| Overflow | `combat.overflow` | accuracy and crit chance above 100 → +3 attack / +3 crit damage per point, applied once | Documented | whether overflow precedes personal boosts |
| Armor | `combat.sustain` | armor above 45 counts 50 %; loss per hit = max(1, 10 × (1 − armor%)) | Estimated | measured health lost per hit at several armor values; whether 45 applies to skill + gear total |
| Dodge | `combat.sustain` | dodge above 36 counts 50 %; dodge % = chance to avoid health loss | Estimated | measured dodge frequency; whether the threshold applies to skill + gear total |
| Health / hunger | `combat.sustain`, `loadout.food` | 10 health per hit; meal restores food % of max health and costs 1 hunger; reserve 10; no over-heal waste | Estimated | starting health/hunger (not exposed); eating-time rules; whether a hit needs ≥ 10 health |
| Food | `loadout.food`, `sustain.session` | bread 12 %, steak 18 %, cooked fish 25 % of max health | Documented (percentages) / Estimated (plan) | stock and prices (market API gives prices; inventory is not exposed) |
| Durability | `loadout.durability` | start 100, −1 per hit (weapon), −(1 − dodge) per hit for other worn items; no ammo → weapon does not wear; replacement = buy another copy | Estimated | observed wear per hit with and without dodge; real repair/replace rules |
| Ammo | `combat.personalBoost`, `combat.weaponAmmo` | light +12 %, medium +25 %, heavy +45 %; 1/3/12 lead per round | Documented | none |
| Ammo + rank stacking | `combat.personalBoost` | ammo and rank **summed** and applied to (effective Attack skill + weapon + accuracy-overflow attack) (switch: multiplied) | Documented (wiki: summed) | clean-hit observations with known ammo and rank (candidate formulas are ready for the evidence gate) |
| Battle bonuses | `combat.battleBonus` | positives capped at +100 %, penalties at −50 %, then added | Estimated | observed totals with both positive and negative factors |
| Rank | `rank.bonus` | lifetime damage thresholds → fixed bonus; API code matched by name, damage fallback | Documented | the real spelling of API rank codes |
| Loot | `rewards.loot` | each hit finds a Field Crate with probability = loot chance %; rarity odds and 25/75 weapon/armor split | Documented | none for odds; crate gold value needs live market floors |
| Equipment ranges | `gear.rarityRanges` | wiki min–max per slot and rarity; all real offers in the fixtures lie inside | Documented | none |
| Rarity-only items | `gear.rarityRanges` | evaluated at the low (default), mid or high point and reported as an estimate with a damage range; real stats always win | Estimated | n/a (inherently an estimate) |
| Pill modifier | `combat.booster` | **Owner-confirmed**: +50 % (first 6 h) / −50 % (next 12 h) applied to the **Attack skill value only**, before the weapon is added and before ammo/rank; no effect on weapon attack, accuracy-overflow attack, crit chance/damage, accuracy, armor, dodge, loot or any other skill; not a stackable bonus | Documented (owner-confirmed; not yet observed in game) | an in-game observation of a clean hit before/after taking a Pill, to move this to Verified |
| Pill timeline | `pill.timeline` | buff 360 min, debuff next 720 min, none after 1,080 min; no new Pill until both phases end | Documented (owner-confirmed) | none beyond observation |
| Pill plan | `pill.plan` | phase shares of the hits in each battle window × expected damage in that phase (exact in expectation: damage is linear in the Attack skill); hits uniform in time unless explicit hit times are given | Estimated | real hit timing; the Pill analysis inherits the weakest evidence of the damage formulas (currently Unverified: crit multiplier, luck) |
| Pill state | — | **never assumed**: unknown state → analysis refused unless an explicit state is supplied | n/a | the player's current phase and remaining minutes |
| Fixed-hit war session | `war.session` | damage = N × E; survival, food, ammo and replacement costs for N hits | Estimated | see health/hunger and durability rows |
| Sustainable session | `sustain.session` | fight until health/hunger, food stock, ammo stock or durability limits | Estimated | starting health/hunger, inventory stocks, durabilities (not exposed) |
| Own-company work | `econ.barRegen`, `econ.pointsPerWork` | 0.24 × bar max works per day; points = production × (1 + summed bonuses) | Documented (regen) / Estimated (bonus sum) | how bonuses combine |
| Daily economy | `econ.dailyNet`, `econ.unitValue` | own profit + worker margin + wages after income tax; storage caps and upgrades not modelled | Estimated | tax rates per country, bonuses, real worker output |
| Company slots / leadership | `skills.value.linear` | company count and workers become minimum-stat constraints | Estimated | exact per-level slot and worker values |
| Bounty | `combat.bounty` | gold per 1,000 damage, capped by the remaining budget; ineligible players earn 0 | Documented | none |
| Contract payout | `rewards.contract` | full value, else value done minus 10 % of the unfinished value | Estimated | exact penalty arithmetic |
| Objectives | `war.objectives` | maxDamage, bestValue (share configurable, default 0.8), maxNet (needs revenue) | Algorithm | none |
| Search | `war.search`, `sustain.search`, `solver.exhaustive`, `solver.twoGroup`, `loadout.search` | exact Pareto-front search; exhaustive per configuration | Algorithm | none |
| Constraints | `constraints.resolve` | mandatory constraints folded into per-skill bounds and a point budget; conflicts reported, preferences never enforced | Algorithm | none |
| Fixed Gear | `war.fixedGear` | all six slots mandatory; no acquisition or replacement cost; skills optimized around the real stats | Algorithm (owner rule) | the player's real equipped gear (not exposed by any recorded endpoint) |
| Single-hit, economic and mixed objectives | `objective.maxDamagePerHit`, `objective.maxNetValue`, `objective.maxEconomy`, `objective.hybrid` | earlier objectives: offense-only (4 skills), net value of one horizon, economy (economic skills only), opt-in hybrid (4 combat + 4 economic skills); the full War Build is `optimizeWarBuild` | Estimated | as for the underlying mechanics |
