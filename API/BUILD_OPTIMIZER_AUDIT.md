# NationScope Build Optimizer — Deep Engine Audit

**Audit scope:** read-only review of the current Build Optimizer, its adapters, domain parsing, tests, `API/` evidence, and the game Wiki in the adjacent `Wiki/` project. No code, formulas, UI, or database were changed; no live API requests were made.

**Evidence labels used here**

- **Confirmed / documented:** directly present in current source or the supplied Wiki/API evidence. “Documented” means the Wiki says it; it does not independently prove live gameplay behavior.
- **Strongly supported:** multiple source/evidence paths agree, but an authoritative game contract or controlled gameplay observation is absent.
- **Estimated:** deliberately modeled by NationScope because the exact rule is not available.
- **Unverified:** available evidence is insufficient to decide.
- **Suspected issue:** a concrete risk inferred from code behavior that should be validated before changing the model.

Line references below refer to the current checked-out files at audit time. Wiki paths are relative to `D:\Abdallah\Games\Age Of Nations\Wiki`.

## Architecture Overview

The optimizer is a feature module under `src/features/build-optimizer/`, divided into four practical layers:

1. **Game/API parsing:** `src/lib/domain/player.ts:9-81` validates and maps profile response fields; `adapter/player-state.ts:67-169` turns profile, company, stats, and user inputs into provenance-tagged `PlayerState` fields.
2. **Input normalization:** `adapter/scenario.ts` and `run.ts` convert UI/API input into engine requests. Market offers have a distinct adapter (`adapter/market.ts:39-77`).
3. **Pure calculation engine:** `engine/skills.ts`, `solver.ts`, `optimize.ts`, `combat.ts`, `economy.ts`, `war-build.ts`, and supporting reward, rarity, loadout, and sustainable-session modules.
4. **Presentation:** `view-model.ts` and `ui/` format results, assumptions, and localized labels. The UI ultimately invokes the engine through `run.ts`.

**Confirmed:** engine and adapter separate most parsing from deterministic calculations, and field provenance is retained in `PlayerState`. Formula metadata/status is also declared in several engine modules. **Risk:** the `PlayerState` is richer than the prediction inputs actually consumed: historical economy and stats are retained, and equipment durability is retained in the snapshot, but those values do not consistently enter the calculation request (see the sections below).

## Current Engine Workflow

1. A profile is parsed by `parsePlayer`; missing or malformed optional values remain null rather than being fabricated (`src/lib/domain/player.ts:53-81`).
2. `buildPlayerState` maps skill codes, rank, profile equipment, Prestige, economy, companies, and raw stats (`adapter/player-state.ts:90-168`). Unknown skill codes are warned about; a complete skill vector is required unless the user fills gaps.
3. The import adapter fetches profile plus related datasets, including companies, player stats, and market offers; market offer candidates are not treated as owned (`adapter/market.ts:39-45`; import orchestration is in `adapter/import.ts`).
4. `run.ts` merges state and form values. User-entered gear overrides API-mapped profile gear (`run.ts:52-53,95`); fixed gear is separately normalized from the form.
5. Generic optimization (`optimize.ts`) supports per-hit damage, net value, economy, and hybrid objectives. War optimization (`war-build.ts`) jointly searches skill, gear, ammo, and spending choices; sustainable optimization models repeated sessions and durability (`sustainable.ts`).
6. The view model presents recommended builds, modeled metrics, warnings, and assumptions. The API/profile import display is narrower than the complete internal state; inspect `view-model.ts` when integrating additional fields.

**Confirmed limitation:** the current optimizer is a planning simulator over supplied snapshots and assumptions, not a live-game rules engine. It does not query battle state or continuously synchronize market/company changes while solving.

## Skills Mechanics Audit

### Skill catalog and point costs

`engine/skills.ts:1-111` defines fourteen skills, their minimum unlock levels, level-0/level-10 values, max level 10, and upgrade costs `[1,1,2,3,4,5,6,8,9,10]` (49 points to level 10). These endpoints, unlocks, and costs correspond to `Wiki/01-basics.md:190-223` (skill table and point-cost section). This is **documented alignment**, not a gameplay remeasurement.

The catalog includes Energy, Health, Hunger, Attack, Company Slots, Business, Production, Critical Chance, Critical Damage, Armor, Accuracy, Dodge, Loot Chance, and Leadership. Wiki endpoint values and unlocks are in `01-basics.md:194-207`. Point reset is modeled as 0.5 gold per spent point, with a caller-provided free-first-reset boolean (`skills.ts:159-160`; Wiki `01-basics.md:225-229`). Whether the reset is still free is not API-derived (`player-state.ts:167`).

### Intermediate values

**Confirmed implementation assumption:** `skillValue` linearly interpolates between the Wiki’s level-0 and level-10 endpoints (`skills.ts:91-110`). The Wiki gives endpoints, but not a table for every intermediate level. Therefore all intermediate values are **estimated**, and an off-by-one/game-specific progression curve could change damage and economy recommendations. Tests currently validate the chosen interpolation against itself; they do not establish it against the game.

### Points, Prestige, and ledger

The level-only documented rule is four points per level above level 1 (`skills.ts:113+`; Wiki `01-basics.md:151,217`). The code has a Prestige term, `4 * prestige`, but tags the prestige interaction as unverified (`skills.ts:56-64`). Wiki `01-basics.md:262-270` says Prestige returns all allocated points and grants four additional points per Prestige. The Phase 3 evidence in `API/MECHANICS_VERIFICATION.md` records a development profile at level 50, Prestige 7, with 224 invested points; this agrees with the proposed `4*(level-1)+4*prestige` value for that example, but does not prove total/unspent points after any Prestige lifecycle.

`buildPlayerState` intentionally retains API Prestige but excludes it from the ledger (`adapter/player-state.ts:121-134`). It calculates an exact ledger only from an explicit total or available-point input; otherwise it reports a lower bound. This is a sound conservative choice. **Do not promote the inferred formula to authoritative available points** without observing actual Skills-page totals across post-Prestige levels.

### Unlock and constraint behavior

`engine/constraints.ts` resolves skill level bounds and mandatory requirements. Constraints reduce allowed levels and budget before search. Generic `maxDamagePerHit` only makes Attack, Accuracy, Critical Chance, and Critical Damage decision variables; survival skills are not optimized by that objective (`engine/optimize.ts`, objective skill groups). War optimization adds Health, Hunger, Armor, Dodge, and Loot Chance through separate groups (`war-build.ts`). This is intentional for the separate fixed-horizon war mode, but users should not read generic “combat” recommendations as a complete survivability build.

## Military Optimization Audit

### Damage, accuracy, and critical hits

`engine/combat.ts:108-166` computes a hit distribution from skill levels, recognized gear, ammo, rank bonus, battle modifiers, and an optional pill state. A weapon needing ammo is inactive with ammo `none`; clean-hit probability is capped at 100% accuracy, and the residual miss/graze outcome deals half damage and cannot crit. Critical chance is applied to clean hits. Accuracy above 100 converts at 3 Attack per point and Critical Chance above 100 converts at 3 Critical Damage per point, matching Wiki `01-basics.md:219-223`.

Ammo bonuses (+12%, +25%, +45%) and rank bonus are combined additively in the combat step, consistent with Wiki `01-basics.md:353-359` and `03-war.md:69-80`. Rank is applied to the combined attack base in the current implementation. The supplied player’s `rank.attackBonusPercent` reaches this field; local rank-table fallback is used only when API value is absent (see Prestige and Rank Integration).

**Unverified:** the default critical multiplier convention is `1 + criticalDamage/100`; Wiki calls the stat “extra damage” but does not explicitly state whether that is added to base damage or is the full multiplier. `CombatConventions` permits alternatives (`combat.ts`), but no confirmed gameplay observation resolving this convention is recorded. This is a high-impact calibration item.

**Estimated:** the model represents the game’s documented ±10% damage luck range as outcomes (`combat.ts` outcome construction). The exact probability distribution and whether averaging outcomes matches actual battle aggregation remain unverified.

### Rounded damage and objective score

The hit result exposes both `expected` and `expectedFloored` (`combat.ts:82,153-166`). `expectedFloored` floors each outcome and enforces minimum one damage, consistent with Wiki `03-war.md:71-80`; optimization metrics use the unrounded expected value in several objectives. This is a **confirmed model discrepancy** at the per-hit level. It can reorder close builds and distort threshold-based rewards, especially when damage is low or many fractional outcomes are accumulated. Recommendation: first establish whether game rounds each outcome exactly as Wiki says, then rank using expected value of the documented per-outcome result (while preserving the distribution for variance-sensitive objectives).

### Armor, dodge, and health

`combat.ts` and `engine/war-build.ts` model survivability using diminishing returns and caps. Wiki confirms base health, health loss per hit, and the existence of armor/dodge (`01-basics.md:159-170,219-223`; `03-war.md:58-80`), but does not fully specify the implementation curve. Formula metadata labels related calculations estimated. Exact reduction percentages, application order, combined equipment/skill thresholds, dodge frequency, and armor durability interactions are **unverified**. The levels used to derive threshold curves must be validated before treating session survival as exact.

War build assumes full health at session start when current health is not supplied; `player-state.ts:157` records that current health/hunger are unavailable. Hunger is part of the sustain search but current hunger is not modeled as a live starting state. These assumptions can materially change session length.

### Battle modifiers and pill

Battle modifiers are supplied manually as `WarContext`, not discovered from a current-battle endpoint in the calculation path (`combat.ts`, `war-build.ts:50,159`). Positive bonuses are capped at +100 and negative modifiers at -50 before combination; Wiki `03-war.md:83-101` lists the caps, but combined order/interaction is not independently verified. Missing context is effectively treated as no modifier and should remain visible as an assumption.

Pill behavior has an owner-confirmed model recorded in `API/MECHANICS_VERIFICATION.md` and formula metadata: +50% Attack-skill effect during the first six hours, then -50% for twelve hours, and no stacking with ammo/rank. The engine models it separately. Treat this as **strongly supported by supplied project/game evidence**, while retaining the source provenance in future tests.

### Rewards and resource costs

`engine/rewards.ts` models loot odds and expected crate value; `combat.ts` models bounty per damage with budget cap (`03-war.md:208-222`). **Suspected accuracy limitation:** bounty is computed from expected damage and then capped, rather than taking the expected value of the capped random damage distribution. Near a bounty-budget threshold this can differ from actual expected payout. Also verify that reward eligibility/side rules are supplied correctly; they are not inferred from live battle state.

Ammo and equipment acquisition costs are modeled from market snapshots/user values. Current ask/bid availability is a snapshot, and quantity/liquidity is not represented in candidate scoring. A theoretical cheapest item may not be purchasable in sufficient quantity.

## Economic Optimization Audit

### Current formula

`engine/economy.ts:36-99` calculates daily work capacity as `0.24 * barMax`, plus one initial full bar if selected; maps product recipes to value per production point; models own-company profit, employee wage income, worker margin, and company-slot feasibility. Recipe definitions are in `economy.ts` and align with the product inputs/outputs listed in Wiki `02-economy.md:39-77`.

`unitValuePerPoint` applies market and production tax as successive percentages to sale value, then subtracts ingredient cost (`economy.ts:54-66`). This is an **estimated expected-value abstraction**. Wiki production tax is described as withholding units at production time with fractional carry (`02-economy.md:228-243`); exact equivalence depends on product batching, what gets sold, company storage, and price/liquidity. It needs validation against real company activity, not merely a formula comparison.

The model assigns a company’s daily production to the best-value modeled product and multiplies by production skill/bonus (`economy.ts:77-88`). It does not represent actual activity scheduling choices, limited input inventory, recipe batch rounding, unsold output, or fluctuating market execution price. Results are therefore modeled opportunity estimates, not guaranteed realizable net income.

### Omitted company mechanics

**Confirmed data loss / model gap:** API-side `CompanyLike` has `storageLevel`, `engineLevel`, `breakRoomLevel`, and `workers` (`adapter/player-state.ts:21`), but scenario company groups preserve only item code/count and set production bonus to zero (`adapter/scenario.ts`, company mapping); `CompanyGroup` only supports count, recipe, and production bonus (`economy.ts:38`). The daily model does not calculate engine automation output or storage capacity. Wiki `02-economy.md:95-160` documents production bonuses, storage, company upgrades, and automated Engine production; `128-160` provides upgrade/engine behavior. Recommendations can be wrong for upgraded or storage-limited companies and miss the economic value/cost of automation.

Worker/leadership logic uses manually entered worker count, daily points, and wage. The API’s company fields are not a sufficient full workforce contract in the current adapter, and worker company-level context is flattened. Wiki describes Leadership capacity and employer work in `02-economy.md:178-222`; whether available company data is sufficient to predict actual worker output needs endpoint-level schema verification.

### Historical economy and tax data

Player `economy` and `/players/{id}/stats` are retained for provenance (`player-state.ts:150,166`) but are not used as predictive inputs. This is appropriate for historical activity counters absent a validated mapping to future production. Tax values are user/scenario inputs, not inferred as current player-specific country/company taxes. That is a material manual-input dependency; do not silently assume zero tax when user input is absent (current code records some zero-assumption warnings, e.g. income tax at `economy.ts:72`).

## Prestige and Rank Integration

### Prestige

**Documented:** Wiki says Prestige is available at level 50, returns all skill points, and gives +4 additional points (`01-basics.md:262-270`). **Strongly supported example:** the development P7/L50 profile from `API/MECHANICS_VERIFICATION.md` has 224 invested points, consistent with the candidate formula. **Unverified:** exact total/unspent points at levels after prestige, including partial XP/level transitions and whether the ordinary level point ledger is simply additive in every state. API `prestige` is retained but purposefully not used to create exact available points (`player-state.ts:121-134`). This behavior avoids false precision.

### Rank

Wiki rank thresholds and attack bonuses are listed in `01-basics.md:231-246`. `adapter/player-state.ts:136-144` gives API `rank.attackBonusPercent` precedence; if absent, it falls back to recognized rank code and then lifetime damage (`engine/ranks.ts`). Combat applies the resulting percentage; absent rank is explicitly treated as 0 and flagged (`combat.ts:131-133`). The API’s `rank.minDamage` is retained for display/provenance (`player-state.ts:163`) but is not used in calculations. The observed General value +8 matches the local table; no conflict is evident in the evidence reviewed. Keep the table as a fallback and consistency check, not a second additive bonus.

## Equipment Integration

`parsePlayer` preserves structured profile equipment and `buildPlayerState` keeps an independent `equipmentSnapshot` (`player-state.ts:67-88,152-165`). Recognized stats are mapped by slot to engine gear; duplicate slots are discarded as ambiguous, and user-entered gear takes precedence (`run.ts:52-53`). This respects the important distinction between the profile loadout snapshot and market offers. Phase 3 evidence (`API/MECHANICS_VERIFICATION.md`) supports but does not contractually prove that profile `equipment` is the equipped loadout; it does not prove complete owned inventory. It must not be presented as a complete inventory.

**Confirmed integration gap:** equipment durability survives in the snapshot but `profileGear` maps only combat stats and `GearInput` (`player-state.ts:68-87`) has no profile durability mapping. The generic fixed War request normalizes gear without durability (`war-build.ts:101,130`); only sustainable/fixed flow accepts explicit durability (`sustainable.ts:127`). Thus imported profile durability does not constrain sessions, despite Wiki stating gear loses durability on hits (`01-basics.md:337-339`; `03-war.md:65`). The user can manually supply durability in the UI, but profile import does not automatically do so.

Market candidates are offers, not owned items (`market.ts:39-45`). The API adapter derives ammo use from `itemCode !== 'knife'` (`market.ts:56`), and player gear mapping uses the same rule (`player-state.ts:79`). The Wiki supports ammo-based weapon behavior but whether `knife` is the only no-ammo code should be confirmed against the complete game item catalog.

**Suspected candidate-pruning bug:** `offersToCandidates` constructs the dominance vector from numeric stats and durability only (`market.ts:61-70`), omitting categorical `usesAmmo`. A weapon can be discarded as dominated even though it differs in whether it is active without ammo. Example: an expensive/better knife could be removed by a cheap numerically stronger gun; then the `ammo: none` feasible option is lost. Pareto dominance must compare candidates only within equivalent ammo semantics (and any other categorical behavior).

**Unverified rarity candidate:** rarity-only weapon options force `usesAmmo: true` (`engine/war-build.ts:86-95,325`), since no item identity is known. If a valid no-ammo weapon exists at a modeled rarity, its option is misclassified. Keep this as an explicit assumption or source the property from item catalog data.

## Optimization Algorithm Assessment

### Generic skill solver

`engine/solver.ts:33-70` performs deterministic depth-first enumeration across selected decision skills and respects bounds/budget. It ranks score, then preference satisfaction count, then lower points spent and deterministic level ordering. `maxEvaluations` caps traversal; if reached, output is partial and marked non-exhaustive. This is exact for the enumerated decision space when exhaustive. It does not optimize skills outside `decisionSkills`, so objective skill group selection in `optimize.ts` defines what “best” means.

### Grouped exact search

`enumerateGroup`, `paretoFront`, and `combineGroups` (`solver.ts:73-143`) enumerate disjoint skill groups, retain cost/metric Pareto points, and combine within budget. This is mathematically exact only when the combination objective is monotone in each retained metric and all relevant dimensions are preserved. Generic weighted hybrid normalizes combat/economy against solo maxima (`optimize.ts:124-129`); the result is a design choice, not a game rule, and weighting can be sensitive to the chosen baseline. The algorithm can be exact for its normalized objective while still not represent a user’s intended utility.

**Potential correctness issue:** Pareto reduction that retains only cost/metric-dominant options can remove an option satisfying a soft preference if preference satisfaction is not part of the dominance dimensions. `combineGroups` then applies preferences after the reduction (`solver.ts:105-129`). This matters when callers actually pass soft preferences. Tests assert preference reporting in generic solve, but should include a Pareto counterexample before relying on grouped hybrid preferences.

### War gear and configuration search

`war-build.ts:116+` jointly evaluates skill groups, gear candidates, ammo, costs, rewards, and fixed-horizon damage; its documented exactness claim is conditional on a finite candidate set and monotone objective (`war-build.ts:15`). Gear candidates are Pareto-pruned and capped per slot (default six in `market.ts:70`); run-level trimming also exists (`run.ts:73`). “Exhaustive”/configuration counts should be interpreted as enumeration of the retained set, not every market offer or every possible item. Surface the number excluded/truncated and objective sensitivity; silently treating a reduced list as globally exhaustive risks overclaiming optimality.

### Economic/hybrid objectives

Economic optimization enumerates Production, Business, Energy, Leadership, with company slots raised only as required by company count. CompanySlots is not freely traded against all other skills unless constraints/input require more slots. Hybrid offers constrained and weighted modes; both inherit the economic model’s omitted company mechanics. A mathematically exhaustive search over that model cannot correct inaccurate input mechanics.

## Bugs and Incorrect Assumptions

| Priority / confidence | Location | Root cause and effect | Recommended response |
|---|---|---|---|
| **P1 — Suspected concrete bug** | `src/features/build-optimizer/adapter/market.ts:61-70` | Pareto dominance ignores `usesAmmo`; a candidate with different activation semantics can be removed. This can eliminate an otherwise optimal no-ammo build. | Include ammo semantics in dominance partition/key; add a regression where knife and firearm have numerically dominated stats but distinct ammo feasibility. |
| **P1 — Confirmed discrepancy vs Wiki wording** | `src/features/build-optimizer/engine/combat.ts:82,153-166`; score use in `engine/optimize.ts` and `engine/war-build.ts` | Per-hit output is floored in one field but objective scoring uses unrounded expected damage. This may reorder close builds/rewards. | Resolve exact in-game rounding, then make all objective scoring/reward calculations use the correct distributional quantity. |
| **P1 — Confirmed missing modeled mechanics** | `adapter/player-state.ts:21`; `adapter/scenario.ts` company mapping; `engine/economy.ts:38-99` | Company engine/storage/upgrade state is dropped and not represented in daily profit; upgraded/limited-storage firms may be modeled incorrectly. | Add explicit company production/storage/automation model only after validating Wiki rules and live/controlled examples; retain provenance for every value. |
| **P1 — Confirmed input loss** | `adapter/player-state.ts:68-87,152-165`; `engine/war-build.ts:101,130`; `engine/sustainable.ts:127` | Profile item durability is retained but not passed to gear; standard war optimizer may assume durability 100/unlimited. Session damage/equipment cost can be overstated. | Propagate durability to the relevant session model and clearly distinguish unknown durability from default/full. Do not infer owned inventory from snapshot. |
| **P1 — Unverified high-impact formula** | `engine/combat.ts` hit calculation; `API/MECHANICS_VERIFICATION.md` | Critical damage multiplier convention and exact armor/dodge curves lack confirmed gameplay data. | Capture controlled combat observations spanning known stat values and compare predicted outcome distributions before changing formulas. |
| **P2 — Search approximation** | `adapter/market.ts:67-70`; `run.ts:69-75` | Candidate truncation after Pareto sorting can discard candidates by a cap; current result exhaustiveness describes retained candidates. | Report candidate counts and truncation in results; consider objective-aware pruning or wider cap after measuring configuration growth. |
| **P2 — Weakly documented categorical assumption** | `adapter/market.ts:56,65`; `adapter/player-state.ts:79`; `engine/war-build.ts:94` | “Only knife is ammo-free” is inferred from code/item semantics, not proven for all item codes; rarity-only options force ammo. | Use canonical item metadata if available; otherwise show the assumption and preserve unknown as unknown. |
| **P2 — Soft preference risk** | `engine/solver.ts:105-129` | Group Pareto pruning may discard preference-satisfying points before preferences are scored. | Add a brute-force comparison test with preferences and include preference satisfaction in pruning state or defer pruning where needed. |
| **P2 — Economic execution approximation** | `engine/economy.ts:54-99`; Wiki `02-economy.md:95-160,228-243` | Fractional taxes, recipe batches, inventories, storage, market liquidity and selected work are abstracted to continuous expected values. Net/day may not be realizable. | Label metrics as modeled estimates; progressively validate discrete production and actual market execution with observed scenarios. |
| **P3 — Visibility / provenance issue** | `view-model.ts`, UI result panels; `adapter/player-state.ts:150-168` | Stats and historical economy are retained but not predictive inputs; profile equipment details/durability may not be visible as imported context. | Show only fields that affect a result, and explicitly identify retained-but-not-used fields and assumptions in import review. |

## Missing Mechanics and Data

1. **Exact skill curve at levels 1–9:** Wiki publishes endpoint values and costs, not verified intermediate values.
2. **Exact unspent skill points:** profile exposes level and Prestige but no confirmed total/unspent balance. API Prestige is intentionally excluded from exact ledger. Needs Skills-page/API observation after Prestige.
3. **Combat outcome observations:** critical multiplier, damage rounding order, luck distribution, armor/dodge curves and effects on durability need controlled observed data.
4. **Battle context:** active side/eligibility, battle bonuses, applicable contracts and remaining reward/bounty budget are not derived automatically by the optimizer’s current data flow.
5. **Player equipment contract:** profile’s six slots strongly support current loadout, but API evidence does not establish complete owned inventory or durability semantics across all states. Owned inventory remains user-provided/unknown.
6. **Company state for economic prediction:** automation, storage, upgrades, inventories, input availability, tax and actual output/market sale execution need a complete, semantically verified snapshot.
7. **Market execution data:** offers are price points, not proof of sufficient volume or purchase fulfillment; a snapshot can change before action.
8. **Current consumables/state:** current health, hunger, ammo/food inventory, reset-free eligibility and active pill state are not fully API-derived.

## Test Coverage Assessment

Tests are broad for the implemented model: `tests/build-optimizer/engine.test.ts` covers skill cost/endpoints, point ledger, constraints, hit outcomes, ammo/rank/overflow, rewards, solver determinism/cap, and objectives; `war-build.test.ts` exercises equipment and a small brute-force comparison; `economy-hybrid.test.ts` checks economic formulas and grouped search; `adapter.test.ts` checks profile mapping, rank precedence and market parsing; `run.test.ts`, `ui.test.ts`, `pill.test.ts`, and `review.test.ts` cover adapters, inputs, pill phase behavior, and formula/document metadata.

**Confirmed limitation:** most oracle tests compare the optimizer against brute force using the same formula implementation. They establish search correctness within the model, not correctness against Age of Nations. Several fixtures are synthetic or captured API payloads, not gameplay outcome traces. The review tests that check Wiki tables still cannot validate undocumented intermediate skill values or undisclosed combat semantics.

Priority test gaps:

- Golden player/API parsing fixtures with provenance for Dev versus Production; tests must not imply fixture IDs/fields prove live availability.
- Skill level-by-level observations and point totals before/after Prestige, including a non-level-50 post-Prestige profile.
- Combat tests comparing predicted per-hit outcomes to recorded real battles for known gear/skills/rank/ammo/modifiers.
- Regression for Pareto pruning across knife/firearm semantics and for truncated candidate-set reporting.
- Company output observations across engine/storage upgrades, tax withholding, recipe batch boundaries and missing ingredients.
- Differential tests ensuring profile equipment durability reaches session calculations and partial snapshots do not silently become complete loadouts.
- Grouped solver versus brute force with soft preferences and each hybrid mode, plus boundary/cap cases.

## Prioritized Improvement Roadmap

### Phase 1 — Correctness guardrails and transparent optimality

**Scope:** regression-test and correct categorical market candidate dominance; make candidate truncation and search caps explicit in result status; test grouped preferences against brute force; preserve non-exhaustive status through UI/API boundaries. No game formula changes until evidence is collected.

**Success criteria:** adversarial small cases match brute force over the complete candidate set; outputs state what set was searched and whether any cap truncated it.

### Phase 2 — Controlled mechanics calibration

**Scope:** collect a small, provenance-tagged set of gameplay observations for skill values, critical damage, damage floors/luck, accuracy overflow, armor/dodge, ammo/rank ordering, and equipment durability. Reconcile with Wiki. Mark each formula documented, observed, estimated, or unknown in one source-of-truth registry.

**Success criteria:** each high-impact combat formula has a reproducible observation/test or remains visibly estimated; no unsupported formula is upgraded to confirmed.

### Phase 3 — Player state fidelity

**Scope:** resolve post-Prestige point ledger from authoritative Skills-page/API observations; pass profile equipment durability and completeness/provenance through applicable session models; distinguish current equipped gear, owned gear, and market offers in input state and results.

**Success criteria:** imported and manually supplied state can be compared field-by-field; unknown values remain unknown; player recommendations do not assume API loadout is full inventory.

### Phase 4 — Economic model fidelity

**Scope:** specify company inputs (engine/storage/upgrades, output, workers, inventories, tax); use observed examples to model automation, batch rounding and inventory feasibility; quantify price freshness/liquidity and avoid promising unrealizable daily net.

**Success criteria:** model reproduces representative company daily output/net from observed records within a declared tolerance and surfaces missing inputs.

### Phase 5 — User-facing explanation and calibration lifecycle

**Scope:** present current state vs recommendation, point/cost delta, binding constraints, contribution of each skill/gear item, data freshness, assumptions and confidence. Keep English/Arabic and RTL parity. Add a maintained golden observation corpus and regression process.

**Success criteria:** a player can identify why a build ranks first and which inputs are inferred or stale; localization and responsive states remain consistent.

### Phase 6 — Performance and expansion

**Scope:** profile real candidate counts and worst-case skill/gear combinations; then optimize allocations/pruning only if measured. Add new objectives or game mechanics only after the prior model and data contracts are stable.

**Success criteria:** measured runtime and memory targets are met while brute-force differential tests continue to certify exactness within declared domains.

## Audit Conclusion

The optimizer has a coherent, testable separation between adapter, pure model, search, and presentation, and its enumeration algorithms can be exact over declared finite domains. The strongest reliability risks are not a lack of search sophistication: they are uncalibrated game rules, omitted company/session state, a concrete categorical Pareto risk in market weapon pruning, and a mismatch between the Wiki’s per-hit floor and unrounded objective scoring. The next development work should first make search coverage and existing model behavior demonstrably correct, then collect game observations before altering high-impact formulas.
