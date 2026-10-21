# Changelog

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
