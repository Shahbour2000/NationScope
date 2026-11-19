# Economy Engine: final development report (Session 2)

## Delivered
Page `/economy/engine?player=<name>` (EN/AR, RTL, responsive) backed by a pure, exact-arithmetic TypeScript engine.
- **Product ranking** by value per production point (instant vs patient), with thin-book and inferred-mapping flags.
- **Company analysis** for every company of the player (found automatically): break-even wage, three approved wage scenarios (25th/50th/75th percentile of competing NET wages, capped at 60/75/90 % of break-even; caps adjustable), profit, margin, break-even price, worker income per shift/day, reasons in plain language, order-book-based revenue and unsold-unit warnings.
- **What-if**: workers, own PP, sell model, market share, output price change, caps, custom wage, capital.
- **Market facts**: 7-day VWAP (from the trade sample), units/day, supply state, volatility, trend.
- **Upgrade returns**: automation payback from exact next-level costs; storage cost and whether the store is actually filling.
- **Agents**: pure formulas, gated, no UI.
- Every figure family carries an evidence tag (Live, Cached, Stale cache, Your input, Wiki rule, Inferred, Assumption); overall confidence is the weakest critical input.

## Architecture decisions
- New code in `src/features/economy-engine/{domain,data,ui}` plus `view.ts`. Domain is framework-free and uses bigint gold and basis points; floats are used only for analytics (volatility, trend, supply days).
- **No `src/app/api/economy/` route was created (change from the plan).** The page loads data on the server and the client what-if re-runs the same pure functions on JSON-safe data, so a proxy API would add requests and code for no benefit. The route folder can be added later if a public endpoint is wanted.
- The page lives at `/economy/engine` because `/economy` already exists (left untouched).
- Own EN/AR text file instead of editing the shared message catalogue (only the nav key was added there).
- Own skills parser, so nothing imports protected files. Existing API client, cache, limiter, error model and market parsers are reused by import.

## Verification (all on the final tree)
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint .` | clean |
| `npm test` | 55 files, **477 tests passed** (baseline 399; +78 new) |
| `npm run build` | succeeds, no warnings from the engine |
| Golden tests | wage tax on all 46 real `/jobs` offers; concrete VPP from real `/market` prices (hand-computed); upgrade costs from the real company sample; hand-checked plan (1,000 PP limestone) |
| Property tests | gross-for-net minimality; profit monotone in wage and equals revenue minus costs; scenario wages ordered and under their cap |
| Parsing/error/partial | skills duplicates/invalid rows, missing shapes, rate-limit vs 404 vs timeout, one failed company detail, empty portfolios, missing prices |
| Request budget | <= 2 market/jobs + 3 player + N companies + 2 tax + 2 per distinct item; default 6 companies |
| EN/AR | key parity, placeholder parity, Arabic coverage test; browser run in Arabic |
| Browser (puppeteer + Chromium, offline mock) | EN 1280, EN 768, AR 390: no console errors, no horizontal overflow, `dir=rtl` for Arabic, price slider changed profit (-4.40 to 77.83) |
| Protected hashes | 14 files (player.ts, features/builds, features/planner) identical before/after |

## Not verified / limits (read before trusting numbers)
- **No live API access from the build environment.** Fixtures are the repository's real captured responses; the by-name profile, order-book and history shapes were never captured. The browser run used a synthetic mock (`scripts/economy-engine-mock.mjs`) for those three.
- Inferred rules: PP scale (x10,000), linear skill table, engine PP bonus-free, employer pays gross, no loyalty bonus.
- A stale `fullAt` forecast bug was found by the browser run and fixed with a test.
- Agents are not usable until the game documents base output and endpoints.

## Integration
1. Unzip over the repository root (paths are repository-relative). Two existing files change: `src/app/layout.tsx`, `src/i18n/messages.ts`. No files are deleted.
2. `npm ci && npm run typecheck && npm run lint && npm test && npm run build`.
3. Open `/economy/engine?player=<in-game name>`.
4. Offline demo: `node scripts/mock-api.mjs 4060 & node scripts/economy-engine-mock.mjs 4061 & AOW_MAIN_API_ORIGIN=http://127.0.0.1:4061 npm run dev`.
