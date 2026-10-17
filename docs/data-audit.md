# Data audit: endpoints, pages and verification status

Base: `https://app.ageofnations.world/api/v1` (configured in `src/lib/config/environments.ts`). Status as of this milestone.

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
