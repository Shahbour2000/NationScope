# NationScope — Project Roadmap

Single source of truth for where development stands. A new conversation must be able to resume from this file alone.
Update it at the end of every session. **A task is Completed only after it has been verified** (see the verification legend).

- **Current phase:** Phase 1 — Website improvement (polish and finish the pages that already exist; no new features).
- **Overall Phase 1 progress:** all listed page tasks implemented and tested; remaining work is verification that needs the live API / a human visual review (see P1-12 and "Known API limitations"). None of the page work has been verified against the live API.
- **Last updated:** 2026-11-13 (session 3).
- **Delivery rule (owner, session 2):** NO intermediate ZIPs. Keep working in the same project; deliver ONE cumulative ZIP (all sessions, all new/modified files, deleted-file instructions, integration guide) when the whole Phase 1 is finished. Before it: review the full diff against the original baseline, run all tests, recheck protected hashes.

## Hard restrictions (apply to every session)

1. **Never modify the Build Optimizer / skill-building engine.** The owner develops it in a separate workspace.
   Protected: `src/features/build-optimizer/`, `src/app/api/build-optimizer/`, `src/app/tools/build-optimizer/`, `tests/build-optimizer/`,
   `src/lib/domain/player.ts`, `src/lib/data/build-import.ts`, `docs/build-optimizer-*.md`, `API/BUILD_OPTIMIZER_AUDIT.md`.
   High-risk shared files (read only, do not edit without asking): `src/features/builds/skills.ts`, `src/lib/data/players.ts`, `tests/players-data.test.ts`.
   If a website task seems to need a protected file: find another way; if none exists, document it and ask the owner.
   Verify before every delivery: SHA-256 manifest of the protected files unchanged (session 1: 59 files, 0 differences).
2. **Do not start the Economy Engine** (Phase 2) and do not change existing economic calculations in anticipation of it.
3. **Never invent API fields, endpoints, formulas or game mechanics.** Label derived/inferred values. Distinguish zero / unavailable / unknown / incomplete.
4. **Scope of Phase 1:** finish and polish what already exists. Do not redo pages that already have dedicated UI. Do not add new features.

## Verification legend

U = unit tests · R = server-render tests (renderToStaticMarkup, EN+AR) · M = run against the mock API (real captured samples, SSR output read) ·
L = real live API · V = visual browser check (screenshots, desktop/tablet/mobile). Only what is listed was done. No live-API (L) or visual (V) verification has been done yet.

## Phase 1 — Website improvement

### Audit result (corrects the first assessment)

The first assessment over-reported generic pages. After reading the routing: `parties/[id]`, `/contracts` and **all country sub-tabs**
(bank, embassies, revolution, announcements, government, laws, events…) have dedicated pages; `/contracts` only falls back to the generic viewer for
auctions / my contracts. Pages still on the generic `DataView` viewer (route → `[section]/[id]/[sub]`, `[section]/[id]`, `[section]`):

`players/[id]/stats`, `players/[id]/companies`, `market/[id]` (redirects to orders), `market/[id]/orders|history|trades`, `rankings/[id]/archive`,
`companies/[id]`, `laws/[id]`, `elections/[id]`, `articles/[id]`, `newspapers/[id]`, `game`, plus the auctions / my-contract blocks of contracts.
Not yet audited visually: everything else (Phase 1 task P1-12).

### Task tracker

| ID | Task | Priority | Status | Files / sections | Depends on | Verification | Remaining issues |
|---|---|---|---|---|---|---|---|
| P1-01 | `regions/[id]` region profile (replaces generic) | High | Completed (U, R, M) | `src/app/regions/[id]/page.tsx`, `features/regions/RegionOverview.tsx`, `RegionHeader.tsx`, `lib/domain/region-detail.ts`, `lib/data/regions.ts` | — | U+R(EN/AR)+M; no V, no L | Biome/climate/facility vocabularies are only known for sampled values (others shown humanized, untranslated in Arabic). `upgrades` and `battle` have never been captured populated. |
| P1-02 | `regions/[id]/companies` | High | Completed (U, R, M) | `features/regions/RegionCompaniesView.tsx` | P1-01 | U+R+M; no V, no L | A company's open `offer` shape is undocumented, so only a "Hiring" badge is shown (no wage). |
| P1-03 | `regions/[id]/campaign` | High | Completed (U, R, M) | `features/regions/CampaignView.tsx` | P1-01 | U+R+M | `ownership` and `launchedFromHere` never captured populated: read loosely, unreadable rows only counted. Need a sample from a region with history. |
| P1-04 | `battles/[id]/contracts` | High | Completed (U, R, M) | `app/battles/[id]/contracts/page.tsx`, `features/wars/BattleContractsView.tsx`, `BountyCard.tsx`, `lib/domain/contracts.ts` | — | U+R+M (empty-case sample only) | Populated battle-scoped response never captured (bounty `battle` assumed optional). Auction and `myContract` fields undocumented: shown through the generic table with an explanatory note. |
| P1-05 | `/contracts` shares `BountyCard` | Medium | Completed (U, R, M) | `app/contracts/page.tsx`, `features/wars/contracts.module.css` (moved from `app/contracts/`) | P1-04 | Same markup, covered by BountyCard render test; no V | Auctions / my contracts / issued still generic (no sample). |
| P1-06 | `market/[id]` item pages: orders (order book), history, trades (replace 3 generic pages; `/market/[id]` redirects to orders) | High | Implemented (U, R, M for trades) | `app/market/[id]/**`, `features/market/MarketItemViews.tsx`, `lib/domain/market-item.ts`, `lib/data/market-item.ts` | — | U+R(EN/AR); trades also M with real rows. Orders/history readers only tested on SYNTHETIC shapes | Per-item **orders and history responses never captured**: read by field-name conventions and fall back to "shown as returned" when unrecognised. Trades assume the global-trade row shape. Must be checked against the live API (`/diagnostics?ids=1`). |
| P1-07 | `players/[id]/stats` | High | Implemented (U, R) | `app/players/[id]/stats/page.tsx`, `features/players/StatsView.tsx`, `lib/domain/player-stats.ts`, `lib/data/player-stats.ts` | — | U+R on SYNTHETIC nested shapes | Nested `damage/work/trade/companies` shapes never captured; read by period-key aliases, falls back to as-returned. Units not stated by the API (labelled). Own parser: `lib/domain/player.ts` untouched. |
| P1-08 | `players/[id]/companies` (+ profile links to it) | High | Completed (U, R-via-CompanyCards, M) | `app/players/[id]/companies/page.tsx`, `lib/data/economy.ts` (`getPlayerCompaniesAll`), `app/players/[id]/page.tsx` (one link added) | — | U (data loader), M (SSR EN+AR with real company rows) | Response shape assumed equal to the other company lists (live check returned an empty page only). |
| P1-09 | `rankings/[id]/archive` (+ board page opens archived periods via `?period&periodKey`) | Medium | Implemented (U, R) | `app/rankings/[board]/archive/page.tsx`, `features/rankings/ArchiveView.tsx`, `lib/domain/ranking-archive.ts`, `app/rankings/[board]/page.tsx`, `lib/data/world.ts` | — | U+R on SYNTHETIC shapes | Archive response never captured. Only `daily` (YYYY-MM-DD), `weekly` (YYYY-Www) and `monthly` (YYYY-MM) key formats are inferred; the real key format must be confirmed. |
| P1-10 | `companies/[id]` company profile | Medium | Completed (U, R, M) | `app/companies/[id]/page.tsx`, `features/companies/CompanyProfile.tsx`, `lib/domain/company-detail.ts`, `lib/data/company-detail.ts` | — | U+R(EN/AR) on the real capture; M | Worker list entries, open `offer` and `boost` never captured (tolerant). Bonus source codes `destiny` / `ethics.product` are translated by interpretation of the wiki, others shown humanized. |
| P1-11 | `laws/[id]`, `elections/[id]`, `articles/[id]`, `newspapers/[id]`, `game`, auctions/contracts blocks of `/contracts` and battle contracts | Medium | Implemented (laws, elections, game: Completed with U+R+M on real captures; articles, newspapers, auctions: SYNTHETIC-shape tests) | `features/politics/{LawDetailView,ElectionDetailView}.tsx`, `features/news/NewsViews.tsx`, `features/game/GameRulesView.tsx`, `features/wars/MercenaryList.tsx`, `lib/domain/{law-detail,election-detail,news-detail,game-rules,contracts}.ts`, pages under `app/{laws,elections,articles,newspapers,game}` | — | Law/election/game: U+R(EN/AR)+M+real browser. Articles/newspapers/auctions: U+R (synthetic) | Article text and newspaper detail never captured (article list row is real); auction/contract entries never captured (read by the vocabulary of GET /game `contractRules.auction`, rest under Details). |
| P1-12 | Site-wide review: links, RTL, hard-coded text, tables, CSS classes, responsive, real-browser checks, filters/sorting | High | Mostly done (automated); human review pending | `scripts/smoke-crawl.mjs`, `scripts/lib/crawl-urls.mjs`, `src/styles/polish.css`, `src/lib/api/errors.ts`, `src/components/ApiErrorState.tsx`, `src/app/error.tsx`, `src/features/rankings/boardLabels.ts` | P1-01..11 | See session 3 log: link audit, RTL CSS audit, hard-coded text audit, table audit, CSS-class audit, crawler (69 pages x EN/AR), real Chromium audit (69 pages x EN/AR x mobile/tablet/desktop: no overflow, no console/hydration errors) | No human visual review of every page; no iOS/Android device test; list-page filter/sort interactions were not re-tested beyond existing unit tests; real API not reachable. |
| P1-14 | Automatic entity-id discovery (owner requirement) | High | Completed (U, M) | `lib/diagnostics/discover.ts`, `lib/diagnostics/probe.ts` (`discoverAndProbe`), `app/diagnostics/page.tsx` (`?ids=1`), `tests/discover.test.ts` | — | U on the real list fixtures; M end to end against the mock API (all ids found; mock lacks detail fixtures so many detail calls 404) | Real live run not possible from the sandbox. Run `/diagnostics?ids=1` (needs `NATIONSCOPE_DIAGNOSTICS=true`) on a deployment to capture the shapes of every endpoint. Mock-only quirk: discovery picks the most developed country (`ss` in fixtures), whose country-scoped lists the mock does not serve. |
| P1-15 | Localised API error messages + 404 vs "Something went wrong" | High | Completed (U, M, browser) | `lib/api/errors.ts` (`isApiError`, `describeError(error, texts)`), `components/ApiErrorState.tsx` (now async, reads the page locale), `app/error.tsx`, `messages.errors` | — | `tests/errors-i18n.test.ts`; screenshots of the Arabic rate-limit state | Cause of the old behaviour: `instanceof ApiError` was false across duplicated dev bundles, so real 404s showed the generic message on some pages. Now matched by name and shape. Every error message was English-only; now EN/AR. |
| P1-16 | Request construction checked against the API Reference | Medium | Completed (U) | `tests/api-reference-conformance.test.ts` | — | 18 tests: path exists in the reference, query params documented, min/max/enum respected | Cannot check response shapes (the reference has none). |
| P1-17 | Arabic names for leaderboards | Low | Completed (U, R) | `features/rankings/boardLabels.ts`, ranking board/archive/game pages | — | `tests/game-rules.test.ts` | Names for boards the wiki does not list are plain translations. |
| P1-13 | Stale docs and stray files | Low | Partially done | `docs/CHANGELOG.md`, `docs/PROJECT-ROADMAP.md`; stray `src/app/{companies,diagnostics,economy,search}/globals.css` (not imported anywhere; only one rule from them was still needed and was moved to `polish.css`) | — | Verified by script | The four stray CSS files are dead copies; deletion is optional and NOT done (owner to confirm). `Nav.tsx`, `ApiStatusPanel.tsx`, `inspect.ts` no longer exist (verified). 4 CSS classes are used without any rule (`bl-label`, `builds`, `jobs-stats`, `side-title-text`): probably intentional hooks; check visually. |

### Known API limitations (document, do not work around)

- The OpenAPI reference has no response schemas (all `200` bodies are generic objects). Shapes come only from saved samples (`API/samples`, `tests/fixtures/real`) and one dated live check (2026-11-07).
- No saved response (pages built with tolerant readers + as-returned fallback, to be confirmed by the first live run): `market/{item}/orders|history`, per-item `trades`, `rankings/{board}/archive`, `players/{id}/stats` (nested), `contracts/auctions/{id}`, articles, newspapers, tournament detail.
- Fixed in session 3: upstream 404s showing "Something went wrong" (see P1-15). React hydration error #418 seen in earlier sessions: reproduced only with the serverless Chromium flags (`--single-process`, `--disable-web-security`); with ordinary Chrome flags 0 errors across 69 pages x EN/AR x 3 viewports on a production build.
- Region detail: `upgrades`, `battle` empty in the sample. Region campaign: `ownership`, `launchedFromHere` empty. Battle contracts: only the empty case captured.
- No endpoint returns region names for all regions, biome/climate vocabularies, or localized facility names.
- API limits: 60 requests/minute/IP, 30 s server cache.

## Phase 2 — NationScope Economy Engine

- **Objective:** improve and expand the website's economic services and analytics.
- **Status:** Planned — requirements not yet defined.
- **Dependencies:** to be determined after the requirements discussion.
- **Implementation:** Not started; requires explicit owner approval. No formulas, architecture or scope decided. Existing economic calculations stay untouched.
- Existing economic pages and integration points (for the future discussion only): `/economy`, `/market`, `/companies`, `/company-stats`, `/jobs`, `/equipment`, `/equipment-floor`; `features/economy/analytics.ts`; `lib/data/economy.ts`.

## Session log

### Session 1 — 2026-11-11
- **Completed (verified U+R+M):** P1-01..P1-05. New: region profile, regional companies (product filter + sort via links, no client JS), region battles, battle contracts, shared `BountyCard`.
- **Partially completed:** none.
- **Not done / remaining:** P1-06..P1-13.
- **Blocked:** P1-06, P1-07, P1-09 are only partly blocked: they can be built against tolerant parsers but real response captures are needed to be accurate (see limitations). P1-04 auctions need a populated sample.
- **Verification actually run:** `tsc --noEmit` clean; `eslint` clean; `vitest` 52 files / 508 tests passing (30 new in `tests/region-pages.test.ts`, mixing real samples and clearly labelled SYNTHETIC cases); dev server + mock API (real samples) with EN and AR: pages answered 200 and rendered the expected content. Protected-file SHA-256 manifest: 0 differences. **Not done:** live API (L), visual/browser (V) — no browser in the sandbox.
- **Side effects:** `scripts/mock-api.mjs` gained region and battle-contract sample routes (test aid only). `src/app/contracts/contracts.module.css` moved to `src/features/wars/contracts.module.css`.
- **Next:** P1-08 (player companies: reuse existing company schema/cards), P1-10 (company profile, real sample exists), then P1-06/07/09 once captures are supplied.
- **Decisions needed from the owner:** (1) real response captures for `market/{item}/orders|history|trades`, `rankings/{board}/archive`, `players/{id}/stats` (a full JSON body each, with the request URL); (2) a populated `battles/{id}/contracts` and a region with ownership history, if available.

### Session 2 — 2026-11-12
- **Owner decisions applied:** discover ids automatically (never ask for ids); use the API Reference + samples + app code; no new features; one cumulative ZIP at the end only.
- **ID-discovery audit:** before this session nothing discovered ids. The app obtains ids only by navigation (list endpoints render links); `/diagnostics` could probe only parameterless endpoints. Added `discoverIds` (pure, from list responses: countries, regions, battles, market, game, ranking, companies, units, alliances, articles, tournaments, contracts, country parties/laws/elections), `idProbes` (every ID-requiring documented endpoint, ~44) and `discoverAndProbe` (paged, 14 probes per page, inside the request budget). Reports honest skips when no id exists (e.g. no auctions). Tested on real fixtures (7 tests) and end to end against the mock.
- **Completed (U/R/M as listed in the table):** P1-08 player companies, P1-10 company profile, P1-14 id discovery.
- **Implemented, awaiting live confirmation of response shapes:** P1-06 market item pages, P1-07 player stats, P1-09 ranking archive.
- **Remaining:** P1-11, P1-12 (site-wide review incl. browser), P1-13 (stale docs).
- **Verification run at end of session:** `tsc` clean, `eslint` clean, `vitest` 57 files / 546 tests passing, protected SHA-256 manifest 0 differences. Mock-API SSR checks (EN+AR) for company profile, player companies, market trades, discovery. No live API, no browser.
- **Side effects:** `scripts/mock-api.mjs` serves more routes (test aid only; rows are real fixture data, flagged in comments).
- **Next:** P1-11 (laws, elections, articles, newspapers, game, auctions), then P1-12 review and the cumulative ZIP.
- **Needs from the owner:** nothing blocking. Optional: on the deployed site open `/diagnostics?ids=1` and send the shape summary for the unconfirmed endpoints when convenient.

### Session 3 - 2026-11-13
- **Owner decisions applied:** continue without asking for ids; verify against the API Reference; fix the 404 behaviour; clarify test counts; keep everything in the working project; ONE cumulative ZIP at the very end.
- **Test-count clarification (my earlier report was wrong):** baseline 478 -> session 1: 508 (+30) -> session 2: 546 (+38, not 46: discover 7, player-companies 3, company-profile 7, market-item 12, archive+stats 9) -> session 3: 596 (+50: law/election 11, news 6, game 5, mercenary 4, errors-i18n 4, api-reference-conformance 18, discover +2).
- **Completed:** P1-11 (laws, elections, articles, newspapers, game, auctions), P1-15, P1-16, P1-17, most of P1-12.
- **Real-browser verification (new):** headless Chromium (installed outside the repo from npm) against a production build with the mock API. Full matrix: 69 pages x {en, ar} x {mobile 390, tablet 820, desktop 1366}: horizontal overflow 0, console/page errors 0, Arabic pages `dir=rtl`. Screenshots of the game, company, law and region pages were viewed. One real bug found and fixed: the unit members table made the page 160-203 px wider than the screen at tablet width (visually hidden status labels escaped the table scroll container; fix in `polish.css`).
- **Other fixes:** orphaned `.ctl-panel > header` style moved to a live stylesheet; "1 Points" -> "1 pts" on the game page; diagnostics table wrapped for scrolling.
- **Not verified:** live API (unreachable), human visual review of every page, real devices. Pages whose response shape was never captured are listed under P1-06, P1-07, P1-09, P1-11 and still need one live `/diagnostics?ids=1` run.
- **Protected files:** SHA-256 manifest of the 59 protected files: 0 differences. `players/[id]/page.tsx` got one link; `lib/domain/player.ts` untouched.
- **Delivery:** cumulative diff reviewed against the baseline (70 new, 17 modified, 1 deleted; all modifications additive or tiny), `next build` passes, final report and integration guide written (`docs/phase1/`). ONE cumulative ZIP delivered at the end of Phase 1.
- **Next (new conversation):** run `/diagnostics?ids=1` on a live deployment, confirm the unconfirmed shapes (final report section 4), human visual review; then the owner decides the Economy Engine requirements discussion.
