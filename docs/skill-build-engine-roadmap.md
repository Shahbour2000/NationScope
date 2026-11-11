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
Status: **In Progress** (core done, verification pending)
- Done in baseline: Wiki pipeline order, rounding, overflow caps, ammo/rank/pill summing, battle caps, skill costs/unlocks, reset cost.
- Remaining: re-verify each registry row against the Wiki line by line (A1); confirm company-slot and leadership per-level values (needs in-game reading); capture one in-game reading per skill at levels 1-9; resolve Prestige point total.
- Acceptance: every `documented` row has a Wiki citation and a test; every non-documented row is listed in the handoff with the evidence needed.
- Tests: existing suites + new regression cases per fix. Dependencies: none.

## Phase B — Optimization algorithms
Status: **In Progress**
- Done in baseline: exact Pareto search in three groups, brute-force equivalence tests, constraint folding with conflict reports, deterministic ordering.
- Remaining: broaden exhaustive-vs-optimizer validation (random small cases incl. fixed gear, budgets, constraints); equipment candidate pruning review for `too-large` cases; performance budget for Sustainable mode.
- Acceptance: randomized equivalence test passes over >= 200 generated cases; no infeasible build ever returned.
- Dependencies: Phase A fixes.

## Phase C — Player data and equipment
Status: **In Progress**
- Done in baseline: equipment snapshot integrity (partial vs complete, missing vs empty), durability seeding, owned gear vs market offers.
- Remaining: re-validate against fresh `/players/{id}` samples; image/slot display data; handling of missing API fields in UI.
- Acceptance: documented availability matrix matches live samples; fixtures for partial/duplicate/invalid equipment pass.

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
