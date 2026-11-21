# Capturing real API responses (Windows, macOS, Linux)

The Economy Engine's parsers for the player profile, order books, 7-day history and job offers were written without ever seeing the real responses. This script captures them so tests can check the parsers against reality.

**Needs:** Node.js 18 or newer (`node -v`), the repo checked out, internet access to `app.ageofnations.world`. No ids to look up: the script finds them from your player name.

## Run (Windows PowerShell, from the repo folder)
```powershell
node scripts\aon-sample.mjs --player "YourInGameName" --anonymize
npm test
```
macOS/Linux: `node scripts/aon-sample.mjs --player "YourInGameName" --anonymize`

Options: `--max-companies 3`, `--items concrete,steel` (extra items), `--out <folder>`, `--base <url>`. `--anonymize` replaces your name and ids and drops private-looking keys (email, discord, token, session, ip...). Public market, job and country data are kept as is.

## What it does
About 15-25 requests, at most one per 1.1 s (the API allows 60/min). Order: market, jobs, latest trades of all items, `/players/by-name/{name}` (then `/players/{id}` only if skills are missing), the player's companies, up to 3 company details, region, country, then orders, 7-day history and trades for each company item. Files go to `tests/fixtures/real/live/` with a `manifest.json` listing every request and its result.

## Errors
- HTTP **404** is the only "missing" result.
- **429** waits for `Retry-After` and retries (4 attempts); if it never clears it is reported as `rate_limited`, never as missing.
- Timeouts (15 s), network errors and 5xx are retried, then reported as what they are.
- If the player lookup fails for any reason other than 404 the run stops with `player-lookup-<reason>`: try again; it does not mean the name does not exist.
- Exit code 1 when any request failed.

## After a successful run
`npm test` runs `tests/economy-engine/live-fixtures.test.ts` (skipped when the folder is empty). It checks that the real responses parse: market rows, jobs with the allowed-wage band, a profile with a `production` skill, companies with recipe/taxes/upgrades, order books, history and trades. **Only after those tests pass on real captures may the roadmap mark the shapes "verified".** Please commit the captured folder (anonymised).
