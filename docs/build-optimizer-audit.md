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
| Damage pipeline order | `combat.hitOutcomes`, `combat.personalBoost` | skill+weapon attack → personal boosts (ammo + stimulant + rank, summed) → accuracy → crit → luck → battle bonuses → round down, min 1 (Wiki 03-war §1.6) | Documented | none |
| Accuracy / graze | `combat.hitOutcomes` | accuracy % = clean-hit chance, graze = 50 % damage, no crit | Documented | none |
| Critical hits | `combat.hitOutcomes` | crit only on clean hits with probability crit chance | Documented | none |
| Critical multiplier | `combat.critMultiplier` | a crit adds the crit-damage percentage: 1 + critDamage / 100 (Wiki 01-basics §2.4, 03-war §1.6 step 4); the `direct` switch is a what-if only | Documented | none |
| Luck range | `combat.luck` | ±10 % range; `minPerHit`/`maxPerHit` report the floored 0.9 / 1.1 extremes (Wiki 03-war §1.6 step 5) | Documented | none |
| Luck distribution | `combat.luck.distribution` | **not stated by the Wiki**: no distribution is assumed; the central per-hit figure uses luck 1.0 and is not an expectation over luck | Unverified | the Wiki (or observations) stating how luck is distributed |
| Rounding | `combat.rounding` | every outcome is rounded down with a minimum of 1; the per-hit score is the probability-weighted sum of the rounded outcomes (Wiki 03-war §1.6 step 7) | Documented | none |
| Overflow | `combat.overflow` | accuracy and crit chance above 100 → +3 attack / +3 crit damage per point, applied once (Wiki 01-basics §2.4) | Documented | none |
| Non-Wiki switches | `combat.conventions.whatif` | `critMultiplier: direct` and `stacking: multiplicative` are what-if switches; any result using them is labelled Unverified | Unverified | n/a (not Wiki behavior) |
| Overflow order | `combat.overflow.order` | the excess accuracy counts as Attack in step 1; the Wiki does not say where it enters the pipeline | Unverified | the Wiki (or observations) stating the order |
| Armor | `combat.sustain` | armor above 45 counts 50 %; loss per hit = max(1, 10 × (1 − armor%)) | Estimated | measured health lost per hit at several armor values; whether 45 applies to skill + gear total |
| Dodge | `combat.sustain` | dodge above 36 counts 50 %; dodge % = chance to avoid health loss | Estimated | measured dodge frequency; whether the threshold applies to skill + gear total |
| Health / hunger | `combat.sustain`, `loadout.food` | 10 health per hit; meal restores food % of max health and costs 1 hunger; reserve 10; no over-heal waste | Estimated | starting health/hunger (not exposed); eating-time rules; whether a hit needs ≥ 10 health |
| Food | `loadout.food`, `sustain.session` | bread 12 %, steak 18 %, cooked fish 25 % of max health | Documented (percentages) / Estimated (plan) | stock and prices (market API gives prices; inventory is not exposed) |
| Durability | `loadout.durability` | start 100, −1 per hit (weapon), −(1 − dodge) per hit for other worn items; no ammo → weapon does not wear; replacement = buy another copy | Estimated | observed wear per hit with and without dodge; real repair/replace rules |
| Ammo | `combat.personalBoost`, `combat.weaponAmmo` | light +12 %, medium +25 %, heavy +45 %; 1/3/12 lead per round | Documented | none |
| Personal boost stacking | `combat.personalBoost` | ammo, stimulant (Pill) and rank **summed** and applied to (Attack skill + weapon attack + accuracy-overflow attack) (Wiki 03-war §1.6 steps 1-2); the `multiplicative` switch is a what-if only | Documented | none |
| Battle bonuses | `combat.battleBonus` | bonuses summed and capped at +100 %, penalties summed and capped at −50 %, then combined (Wiki 03-war §1.7) | Documented | none |
| Rank | `rank.bonus` | lifetime damage thresholds → fixed bonus; API code matched by name, damage fallback | Documented | the real spelling of API rank codes |
| Loot | `rewards.loot` | each hit finds a Field Crate with probability = loot chance %; rarity odds and 25/75 weapon/armor split | Documented | none for odds; crate gold value needs live market floors |
| Equipment ranges | `gear.rarityRanges` | wiki min–max per slot and rarity; all real offers in the fixtures lie inside | Documented | none |
| Rarity-only items | `gear.rarityRanges` | evaluated at the low (default), mid or high point and reported as an estimate with a damage range; real stats always win | Estimated | n/a (inherently an estimate) |
| Pill modifier | `combat.booster` | +50 % (first 6 h) / −50 % (next 12 h) attack (Wiki 01-basics §3.6), entering the personal-boost **sum** with ammo and rank (Wiki 03-war §1.6 step 2). An earlier owner description (attack skill only, outside the sum) conflicts with the Wiki and was replaced | Documented | none |
| Pill timeline | `pill.timeline` | buff 360 min, debuff next 720 min, none after 1,080 min; no new Pill until both phases end | Documented (Wiki 01-basics §3.6) | none |
| Pill plan | `pill.plan` | phase shares of the hits in each battle window × per-hit damage computed in that phase; hits uniform in time unless explicit hit times are given | Estimated | real hit timing; the plan inherits the weakest evidence of the damage formulas |
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


## Batch 4 - verification record

- Independent oracle: `tests/build-optimizer/oracle.ts` imports nothing from the engine; its tables are typed from the Wiki and its searches are plain full enumerations (no bounds folding, no Pareto pruning). `tests/build-optimizer/oracle-equivalence.test.ts` runs deterministic seeded cases (seed in every assertion message): combat model 400, constraint resolution 300 (+9 edge), solver 150 (82 compared on ranking, 68 conflict agreement) +4 edge, Pareto sets 200, two-group 100, War Build 340 (291 optimality comparisons, 25 infeasible, 24 conflict; 120 maxDamage, 80 bestValue, 80 maxNet, 60 fixed gear) +20 edge, Sustainable 39. Checks: optimum equals the oracle, every returned build is feasible and its reported damage / cost / meals equal the oracle's recomputation, roles are what their names say, results are deterministic.
- Mutation check (engine deliberately broken, oracle must fail): 15 mutations (food reserve, armor threshold, solver tie-break, Pareto equality, best-value share, maxPoints bound, dominance rule, ammo stock, overflow x3 in two places, graze share, Pill debuff, unlock level, rank bonus, silent status promotion) - all caught. A first run missed the crit-overflow mutation (unreachable with Wiki ranges); a direct computeHit fuzz with out-of-range stats was added.
- Extra hunts (not committed): 600 + 900 seeded War Build cases (3 mismatches before Correction 6, 0 after), 261 Sustainable cases against the old expression (0 mismatches), offense-allocation scan (no ordering difference).
- Real Vitest, the real full `tsc`, ESLint and `next build` were NOT run (no dependencies, no network). Results above come from a stand-in describe/it runner; the engine and the new test files type-check under `tsc --strict` with stubbed Node / Vitest types.

## Batch 5 - player data and equipment validation record (2026-11-12)
Scope: adapters only (`adapter/player-state.ts`, `adapter/market.ts`, `adapter/equipment-snapshot.ts`, `adapter/import.ts`, notes in `run.ts`). No engine formula or mechanic changed. Evidence: recorded market / offer captures (2026-10-17) and **synthetic** profile cases (no raw `/players/{id}` capture exists in the repository; see `API/PLAYER_DATA_AUDIT.md`).

| # | Problem (confirmed by a failing case on the original code) | Fix | Regression test |
|---|---|---|---|
| 1 | Profile `level` 0 / negative: `buildPlayerState` threw `RangeError`, so the whole import failed; level 1.5 gave fractional point totals | unusable level -> unavailable + warning, never clamped; level > 50 warns | `REGRESSION: unusable profile level ...` (5 cases + override + max) |
| 2 | Same skill code twice with different levels: the first row won silently | conflicting rows make that skill unknown (user may supply it); identical rows silent | `REGRESSION: duplicate skill rows` |
| 3 | Profile equipment row with a negative stat became a usable item | slot `invalid` (`invalid-stats`), never used or clamped | `a negative gear stat is invalid ...` |
| 4 | Offer price `0` made a free item; a malformed price string made `importForBuild` throw (losing the profile too); negative price accepted | invalid / non-positive price -> offer skipped with a reason | `price 0, a negative price and a malformed price ...`, `one malformed offer price no longer makes the whole import throw` |
| 5 | Offer with a negative stat was a candidate | skipped (`missing stat values`) | `a negative stat is rejected` |
| 6 | Same `offerId` repeated: both copies were candidates and took cap slots | identical copies = one offer; conflicting copies all rejected | `identical duplicate offer ids ...` |
| 7 | Market `bestAsk` / `bestBid` / `last` of 0, negative or malformed became a price (zero = free ammo / ingredients, malformed = throw) | such values are unknown (null) | `zero, negative and malformed prices are unknown` |

Disclosure-only changes (behaviour and optimization results unchanged, text added to the result `notes`): offer slots that failed to load; slots where the API reported a further page that was not read; offers rejected as unusable; Pareto-optimal offers dropped by the per-slot cap.

Findings NOT fixed (would change optimization results; approval requested, see handoff): (a) **page limit**: only the 30 cheapest offers per slot are read (`getEquipmentOffers({ limit: 30, sort: "priceAsc" })`, `nextOffset` ignored), so a stronger, dearer item is invisible when 30 cheaper offers exist in that slot; (b) **per-slot cap**: `offersToCandidates` keeps the 6 cheapest Pareto-optimal offers, so with more than 6 the strongest are dropped even when the budget allows them (demonstrated by `FINDING (disclosed, behaviour unchanged)`); (c) War Build still uses conservative helmet / gloves durability and can miss feasible solutions under some gold budgets (unchanged).

Verified without change: the real weapon item code is `gun` (needs ammo); the `knife` code is still unobserved in any capture (Wiki-documented exemption kept, Unverified spelling); all recorded offers have positive prices, durability 1-100, no duplicate ids, no nulls; all 28 market rows are gold (`money`); `bestAsk = null` rows exist (livestock, cookedFish, cocain, case2, coffeeBeans, fuelCell) and stay unknown.

## Batch 6 - market-coverage fixes and Phase D review (2026-11-13)
Baseline: the repository after Batches 1-5. The user's own run of that state: real Vitest 297/297, `tsc --noEmit` 1 error (typing of `counts.verified` in `wiki-registry-audit.test.ts`, fixed here), ESLint 16 errors + 2 warnings (all in test files, untouched), `next build` passed.

### Approved fix 1 - offer pagination (`adapter/import.ts`, `src/lib/data/build-import.ts`)
Contract used: `GET /equipment` takes `limit` 1-60 and `offset` 0-10000 (`src/lib/api/endpoints.ts`) and returns `nextOffset`. Only one recorded capture shows it (`nextOffset: 30` with 30 rows, 2026-10-17); "no `nextOffset` on the last page" is inferred, not recorded. The importer now follows `nextOffset` per slot with page size 60 and at most 3 pages (the 180 cheapest offers per slot), stops on an empty page or an offset that does not advance, keeps rows already read when a later page fails, and records `{ fetched, pages, moreAvailable }` per slot; whenever `moreAvailable` the result notes say the search is not exhaustive.
Cost: first page unchanged in kind; worst case 18 offer requests per import instead of 6 (22 with profile, companies, stats, market) against the client limiter (default 40 / minute, API limit 60 / minute per IP). Offer pages are identical URLs for every player, so repeat imports are served from the client cache; a rate-limit failure on a later page degrades to a recorded partial read. Not measured on the live API.
Residual: a 4th page or a strong offer priced above the 180th cheapest is still not seen (stated in the notes). A rarity-aware fetch (e.g. `sort=priceDesc` page or the floor endpoint) was not added: no documented guarantee that price tracks strength.

### Approved fix 2 - per-slot cap (`adapter/market.ts`)
Old: the 6 cheapest Pareto offers (the strongest were always dropped). New: `spreadByPrice` keeps the cheapest, the dearest and evenly spaced ranks between (default cap still 6, so search size and speed are unchanged). Properties tested independently: exactly `cap` entries, ascending, deterministic, dearest kept, rank regret per budget <= gap - 1 and never worse than cheapest-N (120 seeded cases). Not a guarantee for every budget or in stat units; dropped counts remain in `prunedAway` and the result notes. Batch 5's test that pinned the old behaviour was rewritten to the new, approved behaviour.

### Phase D result
No confirmed economic bug. Details, classifications, not-modelled list and findings F1-F3: `docs/build-optimizer-wiki-conformance.md`, section "Batch 6". New tests: `phase-d-economy.test.ts` (20), `batch6-market-coverage.test.ts` (14), oracle `oracle-economy.ts`. Mutation check (done by hand, not committed): 8 deliberate defects in `economy.ts` (market tax dropped, regeneration 0.25, leadership cap ignored, bonus ignored in group choice, income tax dropped, missing price skipped, slot check removed, wage ignored) each fail at least one new test.
Also: the Batch 5 findings (a) page limit and (b) per-slot cap are resolved above; (c) the War Build conservative helmet / gloves durability limit is unchanged.

