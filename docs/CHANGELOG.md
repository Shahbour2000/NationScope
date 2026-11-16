# Changelog

## Phase 1, session 3: laws, elections, articles, newspapers, game rules, mercenary auctions, error localisation
- New dedicated pages: `laws/[id]`, `elections/[id]`, `articles/[id]`, `newspapers/[id]`, `game` (live rule tables), mercenary lists on `/contracts` and battle contracts.
- All API error messages are now localised (English/Arabic); real 404s read "Not found" everywhere (module-identity bug in `instanceof ApiError` fixed).
- Arabic leaderboard names; the archive page asks only boards that `GET /game` marks as archived.
- Fixed tablet-width overflow on the unit members table.
- Real-browser audit: 69 pages x en/ar x mobile/tablet/desktop, no overflow, no console errors. The hydration error #418 noted in earlier sessions was caused by the test browser's flags, not by the app.
- 50 new tests (596 total); `scripts/smoke-crawl.mjs` visits every page type in both languages.

## Phase 1, session 2: companies, markets, players, rankings archive, id discovery
- New dedicated pages: `companies/[id]`, `players/[id]/companies`, `players/[id]/stats`, `market/[id]/orders|history|trades` (with `/market/[id]` redirecting to orders), `rankings/[board]/archive` (the board page now opens archived periods through `?period&periodKey`).
- Responses never captured before are read by convention and shown as returned when unrecognised (market orders/history, player stats, ranking archive).
- Automatic entity-id discovery for diagnostics: `/diagnostics?ids=1` (paged).
- 38 new tests; mock API serves more routes from real fixtures.

## Phase 1, session 1: region and battle-contract pages
- New dedicated pages replacing the generic data viewer: `regions/[id]` (facts, resistance, deposit, buildings, neighbours), `regions/[id]/companies` (storage fill, product filter, sort), `regions/[id]/campaign` (battle history with summary), `battles/[id]/contracts` (bounties with the battle's sides, empty/disabled states, auctions shown as returned).
- `/contracts` now uses the shared `BountyCard` (`src/features/wars/`); its stylesheet moved with it.
- 30 new tests (`tests/region-pages.test.ts`); `scripts/mock-api.mjs` serves the new routes from saved samples.
- Roadmap added: `docs/PROJECT-ROADMAP.md`. It also corrects the earlier audit: parties, `/contracts` and every country sub-tab already had dedicated pages.
- Not verified: live API, browser/visual rendering.

## Active battles, percentage-based builds, richer player page
- Overview: Active Wars KPI removed; one Active Battles section (live count + up to 6 ongoing battles) sits under the hero; the lower duplicate is gone. "Ongoing" = status `active`, no `endedAt`, no `winner`, round not finished (`src/features/wars/state.ts`, also used by the Battles page and Wars table). Score text no longer wraps (`white-space: nowrap`).
- Build classification rewritten: War / Eco / Hybrid by capacity-normalised share of combat vs economy skill investment, 70% threshold (inclusive). "Unclassified" removed everywhere; missing data is a separate state. Group counts now report classified / pending / unavailable. See `docs/build-classification.md`.
- Player page: monthly damage, Combat/Economy % bars, Activity panel, grouped skills with levels and maximums (neutral skills collapsed), optional Companies list from `/players/{id}/companies` (response shape assumed, hidden on failure).
- Tests: rewritten classifier tests, new `tests/battle-state.test.ts`, `loadBuilds` null-result semantics.
- Not done: Companies/Economy/Market/Equipment/Rankings/History redesigns, hydration #418 investigation, mobile/Arabic audit results, alliance/country 100-citizen sampling limit. Nothing was verified against the live API (unreachable from the sandbox).

## Redesign pass (reference image), search, battles, builds
- Visual direction from the reference: panels with soft gradients, KPI tiles with tinted icon squares, ranked rows (rank chip, identity, flame value), event list, hero with a generated globe (`public/brand/hero-globe.svg`), segmented-style header. Applied through shared CSS, `RankList`, `ProfileHeader` and the new Overview.
- Overview rebuilt: hero + 4 KPIs (countries, active wars, alliances, active citizens), top countries / top players by damage, latest events, world at a glance. Long names use one-line truncation with the full name in `title`.
- Search: live suggestions (`/api/suggest`, `SearchBox`): partial / middle-of-name / Arabic-folded matching, exact match first, ambiguous names kept, keyboard (arrows, Enter, Escape), outside click, loading / empty / error / partial states, stale-response protection, phone-safe panel. Countries, alliances and units are matched locally from cached lists; players and parties come from `/search`.
- Country tabs: removed "Government Members" and the duplicate "Profile" tab (redirect pages keep old links working).
- Battles: new `/battles/{id}` (sides, round score, current/final round points toward the target, damage split, totals, rounds, top damage dealers per side). Verified against a real response; no fabricated progress.
- Unit profile rethought: header + KPIs, top weekly contributors, build mix, member table with a Build column, collapsed unit details. Joined column removed (low value).
- Players: typed `/players/{id}` (header, daily/weekly/lifetime damage, build badge, War/Eco score bars, strongest skills).
- Build classification (provisional) and organisation build mix on unit, country, alliance and party pages. See `docs/build-classification.md`.
- Re-delivered `globals.css` profile-header/member-table block and the `RemoteImage` hydration gating that were missing from the merged project.
- Known open items: rare React hydration warning #418 (about 1 in 18 loads) under heavy image failures in the sandbox; the `countryDamage` ranking board has no fixture so its panel was only tested in its error state; Eco/War thresholds need your decision (see doc).

## Military unit profile
- New typed `/units/{id}` page built from the verified response: shared `ProfileHeader`, KPI row (members/capacity, online now, unit and weekly damage, tournament wins), HQ and dormitory panel, members by country, weekly damage by member, sortable member table (phone sort control + stacked cards), tournaments, and a "Data not provided by the API" panel. Pin button included.
- Eco/War build, buff/debuff, health, hunger, daily damage, skill-reset and damage-by-target-country are NOT shown: the API response has none of these fields (see `docs/unit-data-coverage.md`).
- Country names truncate in bar rows with the full name in `title`; the `RemoteImage` fallback swap is gated until hydration finishes.
- Known open item: in stress tests with many failing images (the sandbox could not reach image hosts) React logged hydration error #418 in about 1 of 18 production page loads (0 of 14 in dev mode); React recovers by re-rendering on the client and the page works. Not reproduced with real images; not root-caused.

## Brand, mobile, RTL, pins, government (this release)
- New brand: logo mark and icons from the supplied artwork, navy/purple/blue/cyan design tokens, live wordmark.
- Real national flags everywhere countries appear (bundled `flag-icons`); images fall back cleanly, including images that fail before hydration.
- Mobile: touch targets >= 44px, sort control replaces table headers on phones, equipment-floor table scrolls instead of overflowing, hidden drawer no longer focusable, bottom-sheet pin menu (top bar `backdrop-filter` removed because it trapped fixed children).
- Arabic: fixed a 122px horizontal overflow on phones (search box could not shrink next to longer Arabic labels); environment badge moved into the drawer on phones.
- Pins: store, hook, button, menu, tests, EN/AR strings.
- Government and Congress page: leadership, party-grouped hemicycle, member list, policies.
- Country header tabs with counts; shared `countryTabs`; market calculation explanations.
- Tests: pins, flags, hemicycle layout, translations parity; browser scripts and a fixture-backed mock API.
- Removed: `src/app/icon.svg` (replaced by `icon.png`). Earlier releases removed `Nav.tsx`, `ApiStatusPanel.tsx`, `lib/data/inspect.ts`; delete them if still present.

## Known limitations
- Player, unit, battle, party and market-item detail pages are still generic views (no real samples yet).
- No price history or stored trends; no production/profit/wage formulas; Build Planner has no verified game formulas.
- Real-device testing (iOS/Android) was not done; the browser checks used headless Chromium.
- Pins are per browser/device. Congress seat positions are a visual arrangement, not game data.
- Item icons assume `ageofnations.world/items/{code}.webp` for all items (verified for a dozen).
