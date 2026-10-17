# Data audit: endpoints, pages and verification status

Source of truth: the production OpenAPI spec (`https://app.ageofnations.world/api/docs/json`, read 2026-10-17; 65 paths, all response bodies typed only as a generic JSON object). Base: `https://app.ageofnations.world/api/v1` (configured in `src/lib/config/environments.ts`). Status as of this milestone.

**Verified** = a real Main response was read and a schema/test was written from it. **Generic** = the page renders whatever JSON comes back (fields shown as received, nothing assumed); the response shape has NOT been inspected by the build environment, so no field is relied on. Link targets in generic pages are heuristics (ID prefixes `usr_`, `mu_` were observed on Main; key-name suffixes such as `countryId` are guesses).

| Endpoint | Page(s) | Status | Known gaps |
|---|---|---|---|
| `GET /units` | `/units`, Overview tile + top-5 table | **Verified** (`src/lib/domain/units.ts`, `tests/fixtures/main/units.sample.json`) | No `/units/{muId}` shape yet; `countryId` is a code, names need `/countries`. |
| `GET /units/{muId}` | `/units/{id}` | Generic | Members, treasury, damage history unknown. |
| `GET /countries`, `/countries/{id}` | `/countries`, `/countries/{id}` | Generic | Field names unknown (population, development, treasury...). |
| `/countries/{id}/citizens` (limit<=100, offset<=10000), `/government`, `/government/history`, `/elections`, `/parties`, `/laws`, `/bank`, `/revolution` | tabs on `/countries/{id}/...` | Generic | Congress seats, vote counts unknown. |
| `/alliances`, `/alliances/{id}` | `/alliances`, `/alliances/{id}` | Generic | Member list field unknown. |
| `/regions`, `/regions/{id}`, `/regions/{id}/companies`, `/regions/{id}/campaign` | `/regions...` | Generic | |
| `/battles` (limit<=100), `/battles/{id}`, `/battles/{id}/contracts` | `/battles...` | Generic | Overview counts active battles, capped at 100 (shown as `100+`). |
| `/wars` | `/wars`, Overview tile | Generic | |
| `/contracts` | `/contracts` | Generic | `/contracts/auctions/{id}` has no page yet. |
| `/market`, `/market/{item}/orders`, `/history` (168h), `/trades` (50) | `/market`, `/market/{item}/...` | Generic | Rows link to `/market/{id|code|itemCode}`; item-code field name unverified. Money (1/10,000 gold strings) is shown raw, not yet formatted. |
| `/equipment` (limit<=60, offset), `/equipment/floor` | `/equipment`, `/equipment-floor` | Generic | Stats fields unknown. |
| `/jobs`, `/history`, `/articles`, `/articles/{id}`, `/tournaments`, `/tournaments/{id}` | matching routes, Overview tiles/events | Generic | `/history` cursor paging not wired. |
| `/players/{id}`, `/parties/{id}`, `/elections/{id}`, `/laws/{id}`, `/companies/{id}`, `/newspapers/{id}`, `/rankings/{board}` | `/players/{id}` etc. | Generic | No list pages exist for these (no list endpoints); reached via links or search. Ranking board ids come from `/game`, which has no page yet. |
| `/search` | `/search?q=` (top-bar form) | Generic | No live dropdown; needs a verified result shape. |
| `/game` | `/api/health` only | Used for health | Rules content not shown. |

Overview tile counts use `listOf()`: a top-level array, or an object with exactly one array property. Otherwise the tile says "Response shape not recognised yet" rather than guessing. Counts are list lengths, not official statistics.

## Next verification step
Capture real responses for the generic endpoints (paste full URLs into chat so the assistant can fetch them, or set `NATIONSCOPE_DIAGNOSTICS=true` on the deployment and open `/diagnostics?all=1`), then replace each generic page with a typed view built from the real fields, one section at a time.


## Production spec update (2026-10-17)

Endpoints added to the registry and pages from the production spec (all **Generic** unless noted):

| Endpoint | Page | Documented content (from spec text only) |
|---|---|---|
| `/countries/{id}/summary` | Country overview tab | Profile, government members, active wars and battles, open laws, elections, announcements, embassies in one call. |
| `/countries/{id}/government/members` | `members` tab | Documented example shape: `{ members: [{ label, username, ... }] }`; description adds role label, level, party, since. Only `members`, `label`, `username` are named by the spec. |
| `/countries/{id}/announcements`, `/embassies` (`mutual` flag), `/wars`, `/battles`, `/units`, `/history` | tabs (`events` = history) | |
| `/countries/{id}/companies`, `/companies/stats`, `/companies`, `/companies/stats` | tabs, `/companies`, `/company-stats` | Companies richest first: money and steel invested, upgrade levels, workers, owner. Filters countryId/regionId/ownerId/itemCode, sort invested/workers/level/newest, limit<=100, offset<=10000. Stats: companies, invested, workers, owners per product. |
| `/players/{id}/stats`, `/players/{id}/companies`, `/players/by-name/{username}`, `/players?ids=` (<=25) | player tabs; builders ready | Stats: level, rank, damage/work/trade (all time, today, week, month), company worth; wallets are private. |
| `/alliances/{id}/laws`, `/laws` (catalog) | alliance tab, `/laws` | Catalog: each law code with parameters and voting rules. |
| `/rankings/{board}` (+`/archive`) | `/rankings/playerDamage`, overview block | Board ids are listed in `/game` `leaderboards[].id`; `playerDamage` is the spec's own example. |
| `/game` | `/game` | Server time, ruleset version, battle and contract rules, leaderboards, history event types. Contents not yet read by the build environment. |

Spec facts used: money is a string in 1/10,000 gold; times are ISO 8601 UTC; CORS allows any origin; 60 req/min/IP; 30 s cache. Which fields carry money is not stated, so values are shown raw (formatting needs field names from real responses).

Still not read by the build environment (no network route from the sandbox and no sample pasted): every response except `/units`.
