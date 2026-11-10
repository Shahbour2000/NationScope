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
Status: **In Progress** (Batch 1 done: skill grid with pins; everything else below still Pending)
- Batch 1 delivered: `SkillPinGrid` (10-segment current-level bars, tap-to-pin minimum level, +/- per skill, Any = optimizer decides, locked skills disabled, "pin current levels", clear pins, points reserved by pins, over-budget warning only when the earned total is exact). Pins are ordinary `min` entries of `form.constraints`: same request body, same engine path, no engine change. Verified by test that war, economic and hybrid runs honour pins. Replaces the read-only skills card in step 1.
- Still Pending: gear/consumable tiles, Combat/Economy + Simplified/Advanced restyle of the goal step, companies tiles, results as build cards with before/after, removal of the developer-facing "What we could read" card, responsive/RTL manual checks (only CSS logical properties and a 40rem breakpoint were added; not visually checked in a browser).
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
