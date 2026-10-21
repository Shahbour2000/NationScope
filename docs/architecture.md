# Architecture

```
src/app/                 Routes (Next.js App Router). Each page: fetch via src/lib/data, render with features/components.
src/components/          Shared UI: AppShell (sidebar/drawer/top bar), Logo, Icon (lucide), Tabs, Pager, Info, MobileSort, states.
src/features/
  entities/              Country flag, item icon, avatar, player chip, status badge, money, date, metric, source label (+ display context)
  charts/                Dependency-free SVG charts: BarList, LineChart, Sparkline, Progress
  economy/               Pure calculations (market spread, VWAP, jobs, floor matrix, company shares, alliance totals) + overview sections
  government/            Hemicycle layout engine (pure), Parliament client component
  pins/                  Pin store (pure), usePins (localStorage), PinButton, PinMenu
  countries|wars|market|units|overview|explorer/   Page-specific components and logic
src/lib/
  config/                environments.ts (origins, /api/v1 prefix, image sources), env.ts (validated config)
  api/                   client (timeout, retry, Retry-After, cache, dedupe, limiter), endpoints (validated builders), errors
  domain/                zod models written from real responses (world.ts, economy.ts, units.ts), directory (ids -> names)
  data/                  Data-access layer: the only place pages get API data
  flags.ts, media.ts, format.ts, money.ts   Flag paths, safe image URLs, formatting, exact BigInt money
src/i18n/                messages.ts (EN + AR, type-checked against each other), locale helpers
public/brand|flags/      Logo assets and bundled flags
tests/                   Unit tests (+ tests/fixtures/real = real captured API responses)
scripts/                 Browser audit/interaction scripts and a fixture-backed mock API
```

## Data flow
`page.tsx` -> `lib/data/*` (calls `lib/api` client, validates with `lib/domain` zod schemas, per-row `safeParse`) -> typed rows -> `features/*` components. Display context (`features/entities/display.server.ts`) resolves ids to names (countries from `/countries`; regions from country profiles, else a humanized id) and passes plain data to client components.

## Add an entity page or feature
1. Endpoint builder in `src/lib/api/endpoints.ts` (validated ids/query bounds).
2. Zod model in `src/lib/domain/` from a real response; put the response in `tests/fixtures/real/` and test the parsing.
3. Function in `src/lib/data/`; pure calculations in `src/features/<feature>/` with tests.
4. Route in `src/app/`; reuse `entities`, `charts`, `Tabs`, `Info`, `PinButton`; add strings to **both** dictionaries in `src/i18n/messages.ts` (TypeScript fails the build if one is missing).
5. Add a nav item in `src/app/layout.tsx` and a row in `docs/data-audit.md`.
