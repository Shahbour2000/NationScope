# Phase 1 final development report

Scope: finish and polish the existing NationScope website (no new features), replace the remaining generic data-sheet pages with dedicated interfaces, make entity-id discovery automatic, keep the Build Optimizer untouched.
Baseline: the uploaded `NationScope-main (2).zip` (478 tests). The ZIP is cumulative for sessions 1 to 3.

## 1. Redesigned or improved routes

| Route | Result |
|---|---|
| `regions/[id]`, `regions/[id]/companies`, `regions/[id]/campaign` | Region profile (facts, resistance, deposit, buildings, neighbours, current battle); company cards with storage fill, product filter and sort; battle history with summary |
| `battles/[id]/contracts`, `/contracts` | Bounty cards with the battle's sides, empty/disabled states; mercenary auctions and contracts as cards with the full entry under Details |
| `companies/[id]` | Production and storage, ingredients, bonuses, upgrades with next-level cost, workers and hiring |
| `players/[id]/companies`, `players/[id]/stats` | Filterable company list (profile links to it); period tables with exact big numbers |
| `market/[id]` (redirects to orders), `/orders`, `/history`, `/trades` | Order book with spread and depth, price chart, trade statistics |
| `rankings/[board]/archive` (+ `?period&periodKey` on the board page) | Finished periods grouped by type; only boards that `GET /game` marks as archived are asked |
| `laws/[id]`, `elections/[id]` | Vote tally and pass rule, timeline, ballots, voters; candidates with results, rules, tie-break |
| `articles/[id]`, `newspapers/[id]` | Article page (text shown as plain text) with comments; newspaper page |
| `game` | The live rule tables: battle scoring, round-point stages, contracts, auctions, reputation, all 16 leaderboards, event types |
| All pages | Localised API error messages (English/Arabic), real 404s read "Not found", Arabic leaderboard names, tablet overflow fix, `/diagnostics?ids=1` |

Pages that already had dedicated interfaces were not redone. After this phase, no link in the site lands on the generic viewer; it remains only as a safety net for unlinked URLs.

## 2. Automatic entity-id discovery
`src/lib/diagnostics/discover.ts` reads ids from the list responses the app already loads, builds all ~44 ID-requiring documented endpoints, and `/diagnostics?ids=1` requests them (paged inside the request budget). It reports honest gaps (for example "no auction id found in GET /contracts"). Tested on real list fixtures and end to end against the mock API. `scripts/smoke-crawl.mjs` uses the same lists to visit every page type.

## 3. Verification actually performed
| Kind | Result |
|---|---|
| Unit / render tests | 63 files, **596 tests passed** (baseline 478; session 1 +30, session 2 +38, session 3 +50) |
| Typecheck, lint | `tsc --noEmit` clean; `eslint` clean |
| Production build | `next build` compiles successfully |
| API Reference conformance | 18 tests: every endpoint used by the new pages exists in the reference with only documented, in-range query parameters |
| Mock API (real captured samples/fixtures) | Server-rendered output read for the new pages in English and Arabic |
| Real browser (headless Chromium, production build, mock API) | 69 pages x {en, ar} x {mobile 390, tablet 820, desktop 1366}: horizontal overflow 0, console/page errors 0, Arabic pages `dir=rtl`; screenshots of game, company, law and region pages viewed; sorting (both directions) and text filters exercised |
| **Not done** | **Live API (unreachable from the sandbox). Human visual review of every page. iOS/Android devices.** |

Bugs found by the browser pass and fixed: unit members table widened the page at tablet width (visually hidden labels escaped the scroll container); one stylesheet rule that existed only in a dead file. The React hydration error #418 reported earlier was reproduced only with the serverless Chromium flags (`--single-process`, `--disable-web-security`); with ordinary flags there were none.

## 4. Response shapes that are not confirmed (need one live run)
The API Reference has no response schemas, so shapes come from saved samples and fixtures only. Pages built without a real response read fields by convention, fall back to "shown as returned" when the format is not recognised, and never invent fields.

| Endpoint | Basis | Risk |
|---|---|---|
| `GET /market/{item}/orders`, `/history` | none captured | order-book and history field names are conventions |
| `GET /market/{item}/trades` | assumed equal to the real global trade row | low |
| `GET /rankings/{board}/archive` | none captured | period key format (YYYY-MM-DD, YYYY-Www, YYYY-MM) inferred |
| `GET /players/{id}/stats` | top-level keys real; nested shapes not | read by period-key aliases; units not stated |
| `GET /articles/{id}`, `/newspapers/{id}` | article list row is real; text/comments/newspaper body not | text format unknown, shown as plain text |
| auctions, `myContracts`, `issuedContracts`, battle `myContract` | never captured populated | read by the vocabulary of `GET /game` `contractRules.auction` |
| region `upgrades`, `battle`, campaign `ownership` / `launchedFromHere`; company worker rows, open `offer` | never captured populated | tolerant readers |

Confirm them all with `/diagnostics?ids=1` on a deployment (see the integration guide).
One data observation for the owner: the wiki says a round awards 2 points from 79 combined points, while `GET /game` reports the stage threshold as 80. The game page shows the API value.

## 5. Modified files (17)
docs/CHANGELOG.md (+21), scripts/mock-api.mjs (+11), src/app/contracts/page.tsx (+8 -43), src/app/countries/[id]/page.tsx (+2 -2), src/app/diagnostics/page.tsx (+36 -2), src/app/error.tsx (+9 -8), src/app/page.tsx (+1 -1), src/app/players/[id]/page.tsx (+1 -1: one link), src/app/rankings/[board]/page.tsx (+7 -4), src/app/tournaments/[id]/page.tsx (+2 -2), src/components/ApiErrorState.tsx (+7 -7), src/i18n/messages.ts (+266 -0), src/lib/api/errors.ts (+40 -19), src/lib/data/economy.ts (+7 -0: one new loader, no existing calculation changed), src/lib/data/world.ts (+1 -1), src/lib/diagnostics/probe.ts (+34 -2), src/styles/polish.css (+7 -0).
Deleted: `src/app/contracts/contracts.module.css` (moved). New: 70 files (see `docs/phase1/cumulative.patch`).

## 6. Build Optimizer protection
The SHA-256 manifest of the 59 protected files (Build Optimizer feature, API routes, tool page, tests, docs, `src/lib/domain/player.ts`, `src/lib/data/build-import.ts`) was recorded before any change and re-checked before every delivery: **0 differences**. The new player pages use their own parsers; `player.ts` was not used or edited. Shared files that import it (`features/builds/skills.ts`, `lib/data/players.ts`) were not edited.

## 7. Economy Engine
Planned only (requirements not defined, not started, needs explicit approval). Nothing of it was implemented or pre-empted. See `docs/PROJECT-ROADMAP.md`, Phase 2.

## 8. Handoff
`docs/PROJECT-ROADMAP.md` holds the task table, known API limitations and the session log. Open items: the live confirmation above, a human visual review, device testing, and the optional deletion of four dead stylesheet copies.
