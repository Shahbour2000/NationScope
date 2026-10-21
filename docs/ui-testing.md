# UI testing (real browser)

The unit tests (`npm test`) cover logic. Layout, RTL and interaction were checked with a real headless Chromium using the scripts in `scripts/`:

```bash
npm i --no-save puppeteer-core @sparticuz/chromium      # not saved to package.json
node scripts/mock-api.mjs 4060 &                         # real captured responses, offline
AOW_MAIN_API_ORIGIN=http://127.0.0.1:4060 npm run build && AOW_MAIN_API_ORIGIN=http://127.0.0.1:4060 npm start -- -p 3150 &
BASE=http://localhost:3150 node scripts/ui-audit.mjs     # overflow, direction, broken images, tap targets, JS errors
BASE=http://localhost:3150 node scripts/ui-interact.mjs  # pins, drawer, parliament, RTL
```
Env for the audit: `VIEWS=mobile,tablet,desktop`, `LOCALES=en,ar`, `PAGES=/,/countries`, `SHOTS=/,/wars` (screenshots to `/tmp/shots`). Viewports: 390x844 (touch), 768x1024, 1280x800.

Not covered: real devices (iOS Safari, Android Chrome), real network image loading (the sandbox cannot reach the game's image hosts, so image fallbacks were exercised instead), very large Congresses (layout is unit-tested up to 150 seats, visually checked at 10).
