# Skill Build Engine — Roadmap (single source of truth)

Scope: Skill Build Engine only (`src/features/build-optimizer/**`, `src/app/tools/build-optimizer/**`, `src/app/api/build-optimizer/**`, `tests/build-optimizer/**`, engine docs). Nothing else in NationScope is touched; shared files need explicit approval first.
Source of truth for mechanics: the five Wiki files. Evidence labels: Documented / Estimated / Unverified / Verified (Verified only from in-game observation or API captures; passing tests never make a formula Verified).
Baseline: `NationScope-main (2).zip` supplied 2026-11-10 (no git metadata). Baseline audit below reflects that ZIP only.

## Baseline (audited 2026-11-10)
- Engine: ~2,100 lines in `engine/` (skills, combat, war-build, sustainable, loadout, constraints, solver, pill, economy, rewards, ranks, registry). Formula registry with evidence status per mechanic (`docs/build-optimizer-audit.md`, `docs/build-optimizer-wiki-conformance.md`).
- Adapter: profile/market/equipment-snapshot import, point ledger, scenario building (`adapter/`). API routes `import` and `optimize`.
- UI: 5-step wizard (Player -> Goal -> Data -> Run -> Results). One CSS breakpoint (40rem). Skills shown read-only in PlayerPanel; no skill pinning grid, no gear tiles, no company tiles.
- Tests (batch 0 baseline): 12 files / 197 tests under `tests/build-optimizer`. Result in this session: **197/197 passed using a stand-in describe/it runner** (real Vitest not installable: no network). Not run here: real Vitest, `tsc` for the whole project, ESLint, `next build`. These must be run on a machine with `npm ci` before any phase is marked Completed.
- Known limitations (from the existing audit docs): intermediate skill values are linear interpolation (Estimated); armor/dodge point-to-percent, health reserve and durability model Estimated; luck distribution, overflow order and Prestige point total Unverified; starting health/hunger and inventory not exposed by the API.

## Phase A — Engine correctness
Status: **Acceptance criteria met under the stand-in runner (Batch 4); real Vitest run pending.** Game-confirmation items remain open and tracked.
- Done (Batch 4): all 47 registry entries audited against the Wiki sections they cite (table in `docs/build-optimizer-wiki-conformance.md`); every Wiki table pinned from an independent copy in `tests/build-optimizer/wiki-registry-audit.test.ts`; statuses pinned so Estimated / Unverified cannot be promoted silently (28 Documented, 15 Estimated, 4 Unverified, 0 Verified); two registry entries had a missing linked test (`econ.pointsPerWork`, `pill.plan`), tests added; one confirmed discrepancy corrected (War Build search ranked by unrounded damage), with pinned regression tests.
- Remaining (needs the game, not code): in-game readings per skill at levels 1-9; company-slot and leadership per-level values; armor / dodge point-to-percent; luck distribution; overflow order; Prestige point total; crates at round / battle end (not modelled).
- Acceptance: every `documented` row has a Wiki citation and a test (checked by a test); every non-documented row lists the evidence needed (conformance doc).

## Phase B — Optimization algorithms
Status: **Acceptance criteria met under the stand-in runner (Batch 4); real Vitest run pending.** Optional items remain.
- Done (Batch 4): independent oracle (`tests/build-optimizer/oracle.ts`, no engine imports) and 1,461 counted deterministic cases in `oracle-equivalence.test.ts`: combat model 400, constraint resolution 300, solver 150, Pareto sets 200, two-group 100, War Build 340 (291 optimality comparisons across maxDamage / bestValue / maxNet / fixed gear / candidates / ammo / food / budgets), Sustainable 39; edge cases; determinism; 15 deliberate engine mutations all caught.
- Remaining (optional): performance budget for Sustainable mode; exact (not conservative) helmet / gloves wear inside the search; Sustainable search still ranks by unrounded damage (no failing input; fix identified); economic / hybrid searches were not re-derived by the oracle in this batch.
- Acceptance: randomized equivalence over >= 200 generated cases; no infeasible build ever returned (checked per case).

## Phase C — Player data and equipment
Status: **Batch 5 done (adapter validation); real-tool run and fresh live samples Pending**
- Done (Batch 5): profile / equipment / market adapters audited against the API reference and the recorded 2026-10-17 captures; 7 confirmed data-handling defects fixed with regression tests (unusable level crash, conflicting duplicate skills, negative equipment stats, zero / negative / malformed offer prices, negative offer stats, duplicate offer ids, zero / malformed market prices); result notes now state failed offer slots, unread offer pages, rejected offers and cap-dropped offers; availability matrix in `API/PLAYER_DATA_AUDIT.md`; 34 tests + one synthetic fixture file (`tests/fixtures/synthetic/`).
- Not available: no network in Batch 5, so **no fresh samples**; the repository holds no raw `/players/{id}` or `/stats` capture (profile cases are synthetic and labelled).
- Open, approval needed (would change results): the importer reads only the 30 cheapest offers per slot (later pages ignored); `offersToCandidates` caps each slot at the 6 cheapest Pareto-optimal offers (strongest dropped); War Build conservative helmet / gloves durability (Batch 4 limitation).
- Still not exposed by the API: starting health / hunger, inventory stocks, Pill state, reset cooldown; Prestige-related point totals stay Unverified.
- Remaining: owner-supplied raw `/players/{id}` and `/players/{id}/stats` captures (one with Prestige > 0, one with an empty equipment slot if the API can show it); decision on the two open candidate-coverage items; image / slot display data; real Vitest / tsc / ESLint / next build.
- Acceptance: documented availability matrix matches live samples (matrix written; live re-check Pending); fixtures for partial / duplicate / invalid equipment pass (done).

## Phase D — Economic optimization
Status: **Pending review** (exists, Estimated)
- Remaining: separate theoretical-damage vs cost-efficient outputs in results; budget/cost-per-hit/session clarity; economy formulas stay Estimated until tax/bonus rules are confirmed.

## Phase E — Skill Builder UI/UX (reference-image driven)
Status: **In Progress** (Batches 1-3 done: skill grid, tiles, goal step, result cards; browser and real-tool verification Pending)
- Batch 1 delivered: `SkillPinGrid` (10-segment current-level bars, tap-to-pin minimum level, +/- per skill, Any = optimizer decides, locked skills disabled, "pin current levels", clear pins, points reserved by pins, over-budget warning only when the earned total is exact). Pins are ordinary `min` entries of `form.constraints`: same request body, same engine path, no engine change. Verified by test that war, economic and hybrid runs honour pins. Replaces the read-only skills card in step 1.
- Batch 2 delivered: gear tiles (6 slots, same `form.gear` inputs), ammo / food / Pill tiles (allowed-vs-excluded toggles of `form.ammo`, `form.food[*].use`, `form.pill.enabled`; Pill tile only where the engine supports it: war + fixed hits), read-only company tiles, goal step redesign (goal switch, grouped choices, live summary and "next step asks for" list derived from `sectionsFor`), removal of the developer-facing "What we could read" card (replaced by a plain-language notice only when profile data could not be read). No engine, adapter or API change.
- Not supportable by the current engine/API (handled, not faked): per-slot gear lock/"Any" (engine has only Fixed Gear = all six slots, or Optimize with owned items as candidates); selectable company count / "any # of companies" and empty company slots (companies come from the profile; slot values per level unconfirmed); item pictures (API gives codes and rarities, no images); a Simplified/Customizable toggle (every step-3 input is already conditional on the goal; a second mode would hide real inputs); an Economy goal with the reference's Money/Case/Food/Hit sub-goals (engine economic objective is a single goal).
- Batch 3 delivered: results redesign. One card per build (all builds visible, tabs removed) with role, headline metrics (existing, with "vs current" where the engine returns a current value), a "What changes" block (changed/unchanged/unknown skills with from -> to, reset needed, items to buy / already owned / empty) and the previous full detail sections kept inside a collapsible "Full details" (open when there is one build). A "Before and after" table compares Current with every build, with exact deltas (percent only for a positive base), a "Best" badge when a build is strictly best, and the engine's own list of what the current calculation lacked. Pure mapping lives in `ui/result-cards.ts`. No engine, adapter or API change.
- Before / After data actually available: per-hit damage, damage over the same hits (war) or sustainable session damage, sustainable hits, health lost per hit, daily economic net (economic and hybrid), hybrid per-hit; "points before" is derived as the cost of the current skill levels (test confirms the engine counts points the same way). NOT available and therefore not shown: current cost and cost per 1,000 damage, current gear rows / items, current food or ammo use, current economy components (own companies, wages, workers), current damage for hybrid, current crates/loot. The current build uses the first allowed ammo type (engine behaviour); the panel says so.
- Still Pending: browser checks of the new layout (RTL, 360/768/1280px); real-tool verification; optional cleanup of unused message keys.
- Objectives: compact profile header (level, rank %, prestige, battle bonus, companies); skill grid with 10-segment level bars, Any/pinned state and +/- per skill showing points used/available; gear + consumable tiles (weapon, helmet, gloves, chest, pants, boots, ammo, food, pill) that lock a slot or leave it "Any"; Combat/Economy switch; Simplified/Advanced toggle; single primary action + reset; results as build cards with before/after.
- Constraints: keep NationScope dark identity, EN/AR with RTL, no invented item images, no engine-unsupported goals shown.
- Acceptance: UI tests for EN/AR render; manual check at 360px, 768px, 1280px; form state maps 1:1 to the existing `OptimizeInput` (no engine changes needed for the first UI batch).
- Dependencies: Phase A/C data labels stable.

## Phase F — Testing and final validation
Status: **Pending**
- Real `npm ci`, Vitest, `tsc --noEmit`, ESLint, `next build`; API integration tests with recorded samples; UI/RTL tests; regression suite.
- Acceptance: all five commands pass on a clean checkout, results recorded in the handoff.

## Delivery log
| Batch | Date | Contents | Result |
|---|---|---|---|
| 0 | 2026-11-10 | Audit, roadmap, handoff (docs only) | 197/197 under stand-in runner; no code changed |
| 1 | 2026-11-10 | Phase E: Skill Builder grid with pins (UI only, engine untouched) | 208/208 under stand-in runner (197 existing + 11 new); real Vitest, full tsc, ESLint, next build NOT run |
| 2 | 2026-11-10 | Phase E: gear/consumable/company tiles, goal step redesign, availability card removed (UI only) | 217/217 under stand-in runner (208 + 9 new); real Vitest, full tsc, ESLint, next build NOT run |
| 3 | 2026-11-11 | Phase E: result build cards, Before/After table, changes block (UI only) | 228/228 under stand-in runner (217 + 11 new); real Vitest, full tsc, ESLint, next build NOT run |
| 4 | 2026-11-12 | Engine verification: oracle + 1,461 seeded cases, registry audit of 47 entries, 1 correction (`war-build.ts`), regression tests, docs | 263/263 under stand-in runner (228 + 35 new); engine and new tests pass `tsc --strict` with stubbed Node/Vitest types; real Vitest, ESLint, next build NOT run |
| 5 | 2026-11-12 | Phase C: player / equipment / market data validation, 7 adapter fixes, disclosure notes, synthetic fixtures, docs (no engine change, no UI change) | 282 pass + 15 not executable here under the stand-in runner (297 total: 263 existing + 34 new); the 15 are React-render tests that also fail on the untouched baseline because react / react-dom are not installed in this session; changed adapter files and new tests pass a partial `tsc --strict`; real Vitest, full tsc, ESLint, next build NOT run |
