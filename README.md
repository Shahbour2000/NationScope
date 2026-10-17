# NationScope

Independent analytics dashboard for [Age of Nations](https://ageofnations.world). This is the **foundation milestone**: configuration, a typed API client, a data-access layer, and a minimal status shell. No analytics features yet.

## Run

```bash
cp .env.example .env.local   # then review the values
npm install
npm run dev                  # http://localhost:3000
npm run typecheck && npm run lint && npm test && npm run build
```

`GET /api/health` reports the selected environment and whether the upstream API answered.

## Environments

All environment definitions live in `src/lib/config/environments.ts` (origins and the single `/api/v1` prefix) and are validated in `src/lib/config/env.ts`.

| Variable | Purpose |
|---|---|
| `NATIONSCOPE_API_ENV` | `main` (default) or `development`. Switching needs no code change. |
| `AOW_MAIN_API_ORIGIN` / `AOW_DEV_API_ORIGIN` | Origin only, no path. Defaults: `https://app.ageofnations.world` (Main, confirmed) and `https://dev.ageofnations.world`. |
| `AOW_API_PATH_PREFIX` | Default `/api/v1`. Joined once by `buildApiUrl`; an origin or path that repeats it is rejected. |
| `AOW_API_TIMEOUT_MS`, `AOW_API_MAX_REQUESTS_PER_MINUTE`, `AOW_CACHE_TTL_MS`, `AOW_STALE_MAX_AGE_MS` | Tuning. |
| `NATIONSCOPE_ALLOW_DEV_API_IN_PRODUCTION` | Production refuses the dev API unless `true`. |
| `NATIONSCOPE_DIAGNOSTICS` | `true` enables `/diagnostics`. Keep `false` on public deployments. |

Rules enforced in code and tests: Main is the default; each environment uses only its own origin (a failing Main is an error, never a switch to Development); the header always shows the active environment.

## Verifying endpoints (`/diagnostics`)

Documented endpoints are not assumed to exist on Main. With `NATIONSCOPE_DIAGNOSTICS=true`, `/diagnostics` shows per-endpoint availability (16 parameter-free endpoints) and an explorer for any documented path (structure summary plus raw JSON). Use it to confirm each endpoint and capture real responses before writing schemas.

## Deploy (Vercel Hobby, non-commercial use only)

1. Push this folder to a GitHub repo owned by a personal account.
2. Import it in Vercel (Next.js is detected). No env vars are required for Main.
3. Optionally add `NATIONSCOPE_DIAGNOSTICS=true` temporarily to inspect the API, then remove it.
4. Open `/api/health` on the deployed site; it should report `"ok": true` and environment `main`.

## Pages

| Route | What it shows |
|---|---|
| `/` | Overview: independent tiles (counts from list responses; real units totals), top units, latest world events. |
| `/units` | **Verified real data** from Main `/units`: sortable, filterable directory. |
| `/countries`, `/alliances`, `/regions`, `/battles`, `/wars`, `/contracts`, `/market`, `/equipment`, `/equipment-floor`, `/jobs`, `/history`, `/articles`, `/tournaments` | Generic list pages (real data, fields as returned). |
| `/{section}/{id}` and `/{section}/{id}/{tab}` | Generic detail and sub-pages (country government, citizens, parties, laws, bank...; battle contracts; market order book/history/trades). Includes `players`, `parties`, `elections`, `laws`, `companies`, `units`. |
| `/search?q=` | Global search (top bar form). |
| `/tools/build-planner` | Planner status and engine (no game formulas verified). |
| `/diagnostics` | API explorer, only with `NATIONSCOPE_DIAGNOSTICS=true`. |

See `docs/data-audit.md` for what is verified versus generic. Desktop has a collapsible sidebar; below 48rem the sidebar becomes a drawer and tables become stacked cards. Responsive behaviour was written to CSS rules but **not visually tested** (no browser in the build environment); please check on a phone.

Country pages use the documented one-call `/countries/{id}/summary` as the Overview tab and add tabs for profile, government members, government, citizens, elections, parties, laws, announcements, embassies, bank, companies, company statistics, units, wars, battles, world events and revolution. Alliances have a laws tab; players have stats and companies tabs. Economy pages: market (order book, history, trades), equipment offers, equipment floor, companies, company statistics, jobs.

Planner engine: `skills.ts`, `equipment.ts`, `evidence.ts` and `damage.ts` (the developer-confirmed stage order; each stage must supply a sourced rule, otherwise the result is `incomplete`). See `docs/combat-sources.md`.

## Add a feature
1. Add the endpoint builder to `src/lib/api/endpoints.ts` (validated ids/query bounds).
2. For a generic page, add a section to `src/features/explorer/catalog.ts` and (optionally) a nav item in `src/app/layout.tsx` plus labels in `src/i18n/messages.ts` (EN and AR).
3. For a typed page: add a zod model in `src/lib/domain/`, a function in `src/lib/data/`, a feature folder under `src/features/`, and a route in `src/app/`; put a real response in `tests/fixtures/main/` and test the parsing.

## Layout

```
src/lib/config/env.ts     validated config, environment selection
src/lib/api/              client (timeout, retry+jitter, Retry-After, TTL cache,
                          in-flight dedupe, flagged stale-on-error), limiter, errors,
                          endpoints, schemas, per-process instance
src/lib/data/             data-access layer: the ONLY place UI code gets API data
src/lib/money.ts          exact BigInt money (1/10,000 gold)
src/lib/domain/           validated domain models (units)
src/features/explorer/    generic JSON views, section catalog, link inference (pure logic tested)
src/features/overview/    overview tiles
src/features/units/       table logic (pure) + client table
src/features/planner/     skills.ts, equipment.ts (pure optimizer engine, game formulas are inputs) and evidence.ts (gate that decides whether a formula is verified, estimate or unsupported)
src/i18n/                 EN/AR dictionaries and locale helpers
src/lib/diagnostics/      shape inspector and probe (used by /diagnostics)
src/components, src/app   UI shell: loading, empty, error, retry states
tests/                    vitest
```

UI components never call `fetch`. Add a feature by adding a function in `src/lib/data/`, a schema in `src/lib/api/schemas.ts` and an endpoint builder in `endpoints.ts`.

## Known limits

- The OpenAPI spec types every response as a generic object, so schemas only assert "JSON object" until real responses are captured as fixtures. Do not read fields from `UnverifiedPayload`.
- Cache and rate limiter are per server process (serverless instances do not share them). The upstream limit is 60 req/min per IP; the default budget is 40.
- Not verified against the live API from the build sandbox (no network route to the game hosts). Only `/units` has a verified shape. Search, overview, countries, players, etc. are NOT built; they need real responses (see `docs/game-data-audit.md`). Global search is not built yet for the same reason.
- Fonts are system fonts; i18n/RTL is not wired yet (logical CSS properties are already used).
