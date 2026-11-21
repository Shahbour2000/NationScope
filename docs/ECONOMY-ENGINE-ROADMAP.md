# NationScope Economy Engine: Roadmap (authoritative)

Last updated: 2026-11-17 (Session 3). Status words: **Completed** = implemented AND tested/verified; **Partial**; **Not started**; **Blocked**.
Evidence labels: **[wiki]** stated in the game wiki, **[live]** seen in a real captured API response, **[inferred]** follows from several sources, **[assumption]** unverified default.

## 0. Repository state (Session 3 reconciliation)

- The uploaded `NationScope-main (4).zip` has **no `.git` folder**, so branch and commit SHA could not be read. No GitHub URL was provided, so GitHub itself was not inspected; the uploaded ZIP was treated as the latest state.
- That ZIP is **byte-identical** to the previous delivery applied on the original baseline (`diff -r` empty). So: all Economy Engine files were present, and there were **no newer changes** to merge.
- The Build Optimizer paths are still **absent** from this tree (only `src/lib/domain/player.ts` exists of the protected list). 14 files (player.ts + `src/features/builds` + `src/features/planner`) hash-verified identical before and after this session (`docs/economy-engine/protected-hashes-baseline.txt`, report in `docs/economy-engine/PROTECTED-HASH-REPORT.md`).
- If newer work exists on GitHub, it did not reach this session: re-send the ZIP with `.git` or the repo URL and diff against this delivery.

## 1. Where things stand

| Area | Status | Verification |
|---|---|---|
| Phase 0 audit | Completed | previous session + section 0 |
| Pure math core (`domain/`) | Completed | exact bigint; golden + property tests |
| Data layer (`data/context.ts`) | Completed | discovery chain, failure semantics, request budget |
| Opportunity detector (cross-product) | Completed | 19 tests on real market and trade fixtures |
| Recommendations (actionable) | Completed | unit tests on every rule |
| UI redesign (tabs, cards, charts, details) | Completed on fixtures and a synthetic mock | scripted real-browser check: 19 checks x 3 viewports pass |
| Live sampling script (Windows-ready) | Completed (script + tests with a fake fetch) | **not run against the real game** |
| Live API verification | **Blocked** | needs a run of the script from a machine that can reach the game |
| 7-day history | Partial: wired and charted, shape **unverified** | `readHistory` is tolerant; labelled "not yet verified" in the UI |
| Agents | Partial: formulas only, **gated** | still no base PP/hour and no endpoint (section 6) |

## 2. Task table

| # | Task | Status | Priority | Key files | Notes |
|---|---|---|---|---|---|
| 1 | Product ranking / value per PP | Completed | P1 | `domain/engine.ts`, `domain/opportunities.ts` | |
| 2 | Company profitability + break-even | Completed | P1 | `domain/economics.ts`, `view.ts` | |
| 3 | Salary scenarios (25/60, 50/75, 75/90, adjustable caps) | Completed | P1 | `domain/salary.ts` | |
| 4 | What-if simulator | Completed | P1 | `ui/CompaniesTab.tsx` | workers, price change, own wage primary; rest under "More options" |
| 5 | Cross-product opportunity detector | Completed | P1 | `domain/opportunities.ts` | visible best-bid depth only; ranking by earnable gold |
| 6 | Recommendations incl. capital, capacity, upgrades | Completed | P1 | `domain/recommendations.ts` | rule-of-thumb limits (30-day payback, 10% switch gain) labelled as such |
| 7 | Market analysis: VWAP, volume, volatility, trend, supply | Completed (trade-sample based) | P2 | `domain/market.ts` | last <=100 trades; all-items activity from one request |
| 8 | 7-day history chart | Partial | P2 | `data/context.ts`, `view.ts` | shape unverified; trades are the fallback; no number is computed from history |
| 9 | Automation / storage ROI | Completed | P2 | `domain/upgrades.ts` | |
| 10 | Live sampling script | Completed (unrun) | P1 | `scripts/aon-sample*.mjs`, `docs/economy-engine/LIVE-SAMPLING.md` | |
| 11 | Parsing tests on real captures | Blocked | P1 | `tests/economy-engine/live-fixtures.test.ts` | 7 tests are skipped until captures exist |
| 12 | Agents | Partial / gated | P4 | `domain/agents.ts` | |

## 3. Test counts (verified by running the suite, not copied from reports)

| | Files | Tests |
|---|---|---|
| Original baseline (clean ZIP) | 52 | **399** |
| Previous delivery (Session 2) | 55 | 477 = 399 + **78** new (domain 55, data layer 12, view model/localisation 11) |
| This delivery | 58 | **519** = 399 + **120** new; 512 pass, **7 skipped** (live fixtures) |

**Discrepancy resolved:** the Session 2 roadmap said "78 domain + 12 data + 11 view = 101". That was wrong: 78 was the **total** of the three engine files (55 + 12 + 11). The total 477 was correct. New in Session 3: opportunities 19, sampler 11, live fixtures 7 (skipped), view model +5 = 42 (78 + 42 = 120).

## 4. Phase 0 findings (evidence)

- Repo baseline: Next.js app, 399 tests, typecheck, lint, production build all green before any change.
- **Protected files in this ZIP:** of the paths you listed only `src/lib/domain/player.ts` exists. `src/features/build-optimizer/`, `src/app/api/build-optimizer/`, `src/app/tools/build-optimizer/`, `tests/build-optimizer/`, `src/lib/data/build-import.ts`, `docs/build-optimizer-*.md`, `API/BUILD_OPTIMIZER_AUDIT.md` are **not present** (the ZIP is a baseline without the other session's work). `src/app/layout.tsx` already links `/tools/build-optimizer`. SHA-256 of `player.ts` plus every file in `src/features/builds` and `src/features/planner` (14 files) were recorded before changes (`docs/economy-engine/protected-hashes-baseline.txt`) and verified unchanged at delivery.
- **Production skill source [live per API/PLAYER_DATA_AUDIT.md]:** `GET /players/{userId}` (and, by the same profile shape, `/players/by-name/{username}`) returns `skills: [{code, level, maxLevel}]`. Production is code `production`; Business/initiative is `entrepreneurship`; energy `energy`; Leadership `management`; company slots `companies`. The engine reads these with its own parser (`domain/skills.ts`), independent of the protected `player.ts`. If a by-name body lacks skills, the id profile is requested once. The by-name response itself was never captured; both bare and `{player: ...}` shapes are accepted.
- **ID discovery:** `/market` (item codes) -> name typed by the user -> `/players/by-name/{name}` (id, regionId, countryId) -> `/players/{id}/companies` (ids) -> `/companies/{id}` (recipe, bonuses, taxes, upgrades, store) -> `/regions/{regionId}` (controlling country) -> `/countries/{id}` (market tax) -> `/market/{item}/orders` and `/trades`. No ID is ever asked from the user. Failed requests are classified: only HTTP 404 means "missing"; rate limits, timeouts and network errors never do.
- **Confirmed from real samples:** `/jobs` gives `allowedWage {min,max,median}` and per-offer `grossPerPoint/netPerPoint/taxPerPoint`; worker net = gross minus floored tax (checked on all 46 captured offers by a test). `/companies/{id}` already includes `bonuses[]` and `bonusTotal` (additive: 10 + 8 = 18 in the sample), `production.pointsPerUnit`, `production.needs`, `production.tax`, `incomeTax`, and `upgrades[].next` with exact steel/construction costs and next-level stats.
- **Resolved wiki questions:** daily hiring and worker limits are 1,000,000 in the sample (no practical cap). The third upgrade is the **break room** (effect undocumented, not modelled). Company bonuses are additive in the API's own total.
- **Inferred:** points in the API are scaled by 10,000 (capacity 4,000,000 vs storage level 2 = 400 PP); production per shift is linear between level 0 (10) and level 10 (50).

## 5. Formulas (all gold in 1/10,000, exact bigint)

1. `VPP = ( P x (1 - t_prod) x (1 - t_market) - inputs per unit ) / PP per unit` (break-even gross wage per PP).
2. `units = floor(PP / ppu)`; after production tax `floor(units x (1 - t_prod))` (fraction carry ignored, noted).
3. Plan: `labour = wage x PP_hired`; `ingredients = units_produced x inputs`; `revenue` from the sell model; `profit = revenue - market tax - labour - ingredients`; `margin = profit / net revenue`; `break-even price = (labour + ingredients) / (units_sold x (1 - t_market))`, rounded up.
4. Sell models: **instant** walks the bid book best-first (shortfall = unsold); **patient** sells at best ask (or last) capped by `market units/day x your share`.
5. Wage scenario: `anchor_net = percentile(competing net wages)`; `gross = smallest gross whose floored-tax net reaches anchor`; `wage = min(gross, cap% x VPP)`; clamped to the game's allowed band; "not viable" if even the lowest legal wage exceeds the cap.
6. Worker income per shift = `PP per shift x (1 + bonus) x net wage`.
7. Automation payback = `(steel x ask + construction x ask) / (extra PP/day x VPP)`.
8. Affordable PP = `capital x ppu / (wage x ppu + inputs per unit)`.

9. **Opportunity:** `headroom = VPP(instant) - median allowed wage`; `absorbable PP = best-bid units x PP/unit`; `plan PP = min(capacity, absorbable)`; `daily profit = headroom x plan PP` (0 when headroom <= 0); `start cost = wage x plan PP + plan PP x inputs / PP-per-unit`. Only the best bid level is visible for all items, so revenue beyond it is deliberately not counted.
10. **Market activity:** one `/market/trades` sample (latest <=100 trades of all items) gives units/day per item only when it has >=20 trades spanning >=1 h; otherwise "unknown".
11. **Recommendations:** offer the balanced wage if profitable (else first profitable scenario, else "not profitable"); warn on unsold units, capital shortfall (`affordable PP < planned PP`), binding storage; suggest another product only if its value/PP is >=10% higher; automation is "quick" at <=30 days payback (both NationScope rules of thumb).

## 6. Known limits and open questions

- Bonus effect on engine PP and own-work PP is unverified (engine PP assumed bonus-free).
- Employer assumed to pay the gross wage (the API only shows gross and net).
- Worker loyalty bonus is not included; competitor bonuses are unknown, so per-PP wage percentiles do not account for them.
- Orders/history response shapes were never captured; parsers are tolerant and the UI says when only the best bid was usable.
- Item-code mapping inferred (not wiki-identical): livestock, coca, steak, ammo, heavyAmmo, cocain (stimulant), espresso (coffee). Marked "Inferred" in the ranking.
- Equipment is not modelled (random stats, separate market, exempt from production tax).
- Supply thresholds (7 days / 1 day) are NationScope heuristics, labelled as such.

## 7. Agents (gated)

Re-checked in Session 3 (repo, API reference, fixtures, wiki): **no** base PP/hour, **no** agent endpoint, no agent tax law in the law catalogue. Documented: unlock level 5, slots 6/9/12, skill 1-10 with +10% output per level, specialist 100/60/40 % vs all-rounder 70 %, wage per hour, hirer pays per working hour, country agent tax (default 10 %), 24 h deposit, 3 unpaid hours end the contract, agent places 2/4/6 by company level.
**Not documented:** base PP per hour, bonus/storage interaction, the agent-tax law in the law catalogue, any API endpoint. `domain/agents.ts` implements the formulas with base output as an explicit input and `AGENTS_ENABLED = false`; there is no UI yet. Activation needs: base output, endpoints, then a UI panel reusing `maxHourlyWage`, `wagePerPP`, `hourlyNet`.

## 8. Blockers and decisions for you

1. **Run the live sampler** (needs a machine that can reach the game): `node scripts\aon-sample.mjs --player "YourName" --anonymize` (Windows: `docs/economy-engine/LIVE-SAMPLING.md`), then `npm test`. Until it runs, orders/history/by-name/offer shapes are **unverified**, the 7 live tests stay skipped, and no live-verification claim is made.
2. Send the repo with `.git` or its URL if newer GitHub work exists.
3. Agents: needs base output and endpoints from the game.
4. Decide whether competitor company bonuses (one `/companies/{id}` per offer) are worth the request budget.

## 9. Session log

**Session 1 (2026-11-16):** documents-only research, first roadmap.
**Session 2 (2026-11-17):** Phase 0, domain, data layer, first UI, 78 tests, cumulative ZIP.
**Session 3 (2026-11-17):** repo reconciliation (identical to Session 2, no .git); test-count correction; opportunity detector, recommendations, series helpers; all-items trades and history wired into the data layer; Windows-ready sampling script with fake-fetch tests; UI redesigned (two tabs, product cards with icons, wage cards, profit-by-wage chart, price sparkline, expandable details); scripted browser verification (19 checks x EN desktop, EN tablet, AR phone); reports; cumulative ZIP verified on a clean baseline and on the uploaded ZIP.
Remaining: live verification, history shape, agents, optional competitor-bonus adjustment, per-item deep order books for the opportunity list.
