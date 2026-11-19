# NationScope Economy Engine: Roadmap (authoritative)

Last updated: 2026-11-17 (Session 2). Status words: **Completed** = implemented AND tested/verified; **Partial**; **Not started**; **Blocked**.
Evidence labels: **[wiki]** stated in the game wiki, **[live]** seen in a real captured API response, **[inferred]** follows from several sources, **[assumption]** unverified default.

## 1. Where things stand

| Area | Status | Verification |
|---|---|---|
| Phase 0 audit (repo, baseline, ID discovery, skills endpoint) | Completed (live sampling Blocked) | see §3 |
| Pure math core (`domain/`) | Completed | 78 tests, golden values hand-checked against real fixtures |
| Data layer (`data/context.ts`) | Completed | 12 tests incl. discovery chain, failure semantics, request budget |
| View model (`view.ts`) + EN/AR text | Completed | 11 tests incl. EN/AR parity |
| Page `/economy/engine` + what-if UI | Completed against fixtures/synthetic mock | real-browser check EN desktop, EN tablet, AR phone: no console errors, no horizontal overflow, RTL, slider changes profit |
| Live API verification | **Blocked** | the build sandbox cannot reach app.ageofnations.world (see §7) |
| Agents | Partial: pure model + tests, UI **gated** (`AGENTS_ENABLED=false`) | needs base PP/hour and API endpoints |
| History endpoint (7-day candles) | Not started | response shape never captured |
| Opportunity detector across all products / alerts | Not started | |

## 2. Task table

| # | Task | Status | Priority | Files | Depends on | Remaining / notes |
|---|---|---|---|---|---|---|
| 1 | Product ranking by value per PP | Completed | P1 | `domain/engine.ts` (`rankProducts`), `ui/EngineView.tsx` | recipes, `/market` | uses best bid (instant) and best ask/last (patient); ingredients at best ask |
| 2 | Company profitability + break-even | Completed | P1 | `domain/economics.ts`, `domain/engine.ts` | company detail, skills | per-day plan from workers x shifts x PP |
| 3 | Salary scenarios (25/60, 50/75, 75/90) + adjustable cap | Completed | P1 | `domain/salary.ts` | `/jobs` | anchors on NET wages; explanation codes localised |
| 4 | What-if simulator | Completed | P1 | `ui/EngineView.tsx`, `view.ts` | 1-3 | workers, own PP, sell model, absorption share, output price shift, cap sliders, custom wage, capital |
| 5 | Absorption, supply, oversupply | Partial | P2 | `domain/market.ts` | trades | per loaded company item only (not whole ranking); based on the last <=100 trades |
| 6 | Automation / storage ROI | Completed | P2 | `domain/upgrades.ts` | company detail `upgrades[].next` | storage ROI is informational by design |
| 7 | Trend, volatility | Partial | P3 | `domain/market.ts` | trades | no market-opportunity detector yet |
| 8 | Capital-aware recommendations | Partial | P3 | `domain/engine.ts` (`affordablePP`) | user input | wallets are private, capital is typed by the user |
| 9 | Agents | Partial / gated | P4 | `domain/agents.ts` | game release | see §6 |
| 10 | 7-day history (candles) | Not started | P3 | | shape of `/market/{item}/history` | VWAP currently uses recent trades only |
| 11 | Live fixtures for orders/history | Blocked | P2 | | network access | |

## 3. Phase 0 findings (evidence)

- Repo baseline: Next.js app, 399 tests, typecheck, lint, production build all green before any change.
- **Protected files in this ZIP:** of the paths you listed only `src/lib/domain/player.ts` exists. `src/features/build-optimizer/`, `src/app/api/build-optimizer/`, `src/app/tools/build-optimizer/`, `tests/build-optimizer/`, `src/lib/data/build-import.ts`, `docs/build-optimizer-*.md`, `API/BUILD_OPTIMIZER_AUDIT.md` are **not present** (the ZIP is a baseline without the other session's work). `src/app/layout.tsx` already links `/tools/build-optimizer`. SHA-256 of `player.ts` plus every file in `src/features/builds` and `src/features/planner` (14 files) were recorded before changes (`docs/economy-engine/protected-hashes-baseline.txt`) and verified unchanged at delivery.
- **Production skill source [live per API/PLAYER_DATA_AUDIT.md]:** `GET /players/{userId}` (and, by the same profile shape, `/players/by-name/{username}`) returns `skills: [{code, level, maxLevel}]`. Production is code `production`; Business/initiative is `entrepreneurship`; energy `energy`; Leadership `management`; company slots `companies`. The engine reads these with its own parser (`domain/skills.ts`), independent of the protected `player.ts`. If a by-name body lacks skills, the id profile is requested once. The by-name response itself was never captured; both bare and `{player: ...}` shapes are accepted.
- **ID discovery:** `/market` (item codes) -> name typed by the user -> `/players/by-name/{name}` (id, regionId, countryId) -> `/players/{id}/companies` (ids) -> `/companies/{id}` (recipe, bonuses, taxes, upgrades, store) -> `/regions/{regionId}` (controlling country) -> `/countries/{id}` (market tax) -> `/market/{item}/orders` and `/trades`. No ID is ever asked from the user. Failed requests are classified: only HTTP 404 means "missing"; rate limits, timeouts and network errors never do.
- **Confirmed from real samples:** `/jobs` gives `allowedWage {min,max,median}` and per-offer `grossPerPoint/netPerPoint/taxPerPoint`; worker net = gross minus floored tax (checked on all 46 captured offers by a test). `/companies/{id}` already includes `bonuses[]` and `bonusTotal` (additive: 10 + 8 = 18 in the sample), `production.pointsPerUnit`, `production.needs`, `production.tax`, `incomeTax`, and `upgrades[].next` with exact steel/construction costs and next-level stats.
- **Resolved wiki questions:** daily hiring and worker limits are 1,000,000 in the sample (no practical cap). The third upgrade is the **break room** (effect undocumented, not modelled). Company bonuses are additive in the API's own total.
- **Inferred:** points in the API are scaled by 10,000 (capacity 4,000,000 vs storage level 2 = 400 PP); production per shift is linear between level 0 (10) and level 10 (50).

## 4. Formulas (all gold in 1/10,000, exact bigint)

1. `VPP = ( P x (1 - t_prod) x (1 - t_market) - inputs per unit ) / PP per unit` (break-even gross wage per PP).
2. `units = floor(PP / ppu)`; after production tax `floor(units x (1 - t_prod))` (fraction carry ignored, noted).
3. Plan: `labour = wage x PP_hired`; `ingredients = units_produced x inputs`; `revenue` from the sell model; `profit = revenue - market tax - labour - ingredients`; `margin = profit / net revenue`; `break-even price = (labour + ingredients) / (units_sold x (1 - t_market))`, rounded up.
4. Sell models: **instant** walks the bid book best-first (shortfall = unsold); **patient** sells at best ask (or last) capped by `market units/day x your share`.
5. Wage scenario: `anchor_net = percentile(competing net wages)`; `gross = smallest gross whose floored-tax net reaches anchor`; `wage = min(gross, cap% x VPP)`; clamped to the game's allowed band; "not viable" if even the lowest legal wage exceeds the cap.
6. Worker income per shift = `PP per shift x (1 + bonus) x net wage`.
7. Automation payback = `(steel x ask + construction x ask) / (extra PP/day x VPP)`.
8. Affordable PP = `capital x ppu / (wage x ppu + inputs per unit)`.

## 5. Known limits and open questions

- Bonus effect on engine PP and own-work PP is unverified (engine PP assumed bonus-free).
- Employer assumed to pay the gross wage (the API only shows gross and net).
- Worker loyalty bonus is not included; competitor bonuses are unknown, so per-PP wage percentiles do not account for them.
- Orders/history response shapes were never captured; parsers are tolerant and the UI says when only the best bid was usable.
- Item-code mapping inferred (not wiki-identical): livestock, coca, steak, ammo, heavyAmmo, cocain (stimulant), espresso (coffee). Marked "Inferred" in the ranking.
- Equipment is not modelled (random stats, separate market, exempt from production tax).
- Supply thresholds (7 days / 1 day) are NationScope heuristics, labelled as such.

## 6. Agents (gated)

Documented: unlock level 5, slots 6/9/12, skill 1-10 with +10% output per level, specialist 100/60/40 % vs all-rounder 70 %, wage per hour, hirer pays per working hour, country agent tax (default 10 %), 24 h deposit, 3 unpaid hours end the contract, agent places 2/4/6 by company level.
**Not documented:** base PP per hour, bonus/storage interaction, the agent-tax law in the law catalogue, any API endpoint. `domain/agents.ts` implements the formulas with base output as an explicit input and `AGENTS_ENABLED = false`; there is no UI yet. Activation needs: base output, endpoints, then a UI panel reusing `maxHourlyWage`, `wagePerPP`, `hourlyNet`.

## 7. Blockers and decisions for you

1. **Live verification (blocked):** run the game API sampling from a machine that can reach `app.ageofnations.world`: `/players/by-name/{name}` (confirm `skills`), `/market/{item}/orders`, `/market/{item}/history`, `/companies/{id}` with a posted job offer (`offer` shape). Save them to `tests/fixtures/real/` and add parsing tests. Until then all ranges marked Inferred stay.
2. Decide whether to treat competitor company bonuses (needs one `/companies/{id}` per offer) as worth the request budget.
3. Provide agent base output when known.

## 8. Session log

**Session 1 (2026-11-16):** documents-only research, first roadmap.
**Session 2 (2026-11-17):** repo received. Done: Phase 0 audit; baseline (399 tests); hashes; domain, data, view, UI, text, tests (78 + 12 + 11 new = 101 new tests; 477 total); real-browser check with offline mock; shared-file edits (2 lines in 2 files); reports. Partial: agents (no UI), absorption only for loaded items. Blocked: live sampling. Next steps: (1) run live sampling and add fixtures, (2) wire `/market/{item}/history`, (3) cross-product opportunity detector, (4) activate agents when documented.
