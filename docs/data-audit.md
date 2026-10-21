# Data audit (real production samples, captured 2026-10-17)

Source of truth: 38 real responses from `https://app.ageofnations.world/api/v1`, stored in `tests/fixtures/real/` (arrays truncated to 60 rows) and parsed by the models in `src/lib/domain/`. Endpoints that returned bad requests were omitted by the project owner and are not assumed unavailable.

**Typed** = a page built from the real fields with tests. **Generic** = no real sample yet, rendered by the generic viewer (technical fields hidden, entity ids resolved to names).

| Endpoint (sample) | Page | Status | Fields used | Missing / unknown |
|---|---|---|---|---|
| `/countries` | `/countries`, directory for every flag/name | Typed | name, scheme (colour), regions, coreRegions, coreHeld, capitalRegionId, capitalHeld, development, citizens, activeCitizens, alliance, enemyCountryId, specializedItem, incomeTax, marketTax | **No flag image field.** Countries use their in-game colour token. |
| `/countries/{id}/summary` | `/countries/{id}` | Typed | profile (regions with names, taxes, treasury, government holders, ruling party + effects, wars, alliance, pacts, enemy, developmentHistory), battles, embassies, elections.finished | Open laws/announcements shown only as links to tabs. |
| `/countries/{id}/citizens` | `/countries/{id}/citizens` | Typed | username, avatarUrl, level, homeRegionId, regionId, lastActiveAt, active | |
| `/countries/{id}/government` + `/government/members` | `/countries/{id}/government` | Typed | members: role, userId, username, avatarUrl, level, party, startedAt; government: congressSeats, rulingParty, active.choices | **No seat numbers**: the hemicycle is a visual arrangement grouped by party; vacant seats = congressSeats - members |
| `/countries/{id}/government/history`, `/elections`, `/parties`, `/laws`, `/bank`, `/revolution`, `/embassies`, `/wars`, `/battles`, `/units`, `/history` | country tabs | Generic (samples exist) | shown as returned | Typed views not written yet. |
| `/wars` | `/wars` | Typed | countryA/B, declaredBy, status, declaredAt, endedAt, proposalId (link only), activeBattles, finishedBattles | duration is calculated |
| `/battles` | `/battles` | Typed | type, status, regionId, attacker/defender country, rounds, round points/damage, bounty, startedAt, nextTickAt | `/game` battleRules.pointsToWinRound used for progress bars |
| `/alliances` | `/alliances`, `/alliances/{id}` | Typed (detail built from list + countries + wars) | name, scheme, status, leaderCountryId, members, development, sharePercent, damageBonusPercent, createdAt | `/alliances/{id}` shape not captured |
| `/regions` | region labels only | Typed ids | id, countryId | **No region names in this endpoint.** Names come from country profiles; otherwise the id suffix is humanized ("iq-mosul" -> "Mosul"). |
| `/units` | `/units` (+ overview) | Typed | all fields | `/units/{id}` not captured (generic) |
| `/market` | `/market`, `/economy` | Typed | bestAsk, askQty, bestBid, bidQty, last | spread and ask-vs-last are calculated; **quantities are for the best price level only** |
| `/market/trades` | `/economy` | Typed | itemCode, price, qty, createdAt | volume-weighted average is calculated over the sample returned |
| `/market/{item}/orders|history|trades` | `/market/{item}` | Generic | | no samples, so no price-history chart yet |
| `/equipment` | `/equipment` | Typed | itemCode, slot, rarity, stats, durability, price, sellerName, createdAt | no ownership data |
| `/equipment/floor` | `/equipment-floor`, `/economy` | Typed | slot, rarity, low, offers | |
| `/companies`, `/companies/stats`, `/countries/{id}/companies/stats` | `/companies`, `/company-stats`, `/economy` | Typed | name, owner, itemCode, regionId, countryId, levels, workers, investedSteel, level; totals, byItem | profit/production/wages are not exposed here |
| `/jobs` | `/jobs`, `/economy` | Typed | itemCode, company, location, slots, minLevel, incomeTax, gross/net/taxPerPoint, allowedWage, energyCost | |
| `/rankings/{board}` | `/rankings/{board}` | Typed | rank, name, subject type/id, country, avatar, value | only `playerDamage` captured; money-valued boards unverified |
| `/game` | rankings tabs, battle rules | Partly typed | leaderboards[].id/label, battleRules.pointsToWinRound | other rules not displayed yet |
| `/history`, `/articles` | `/history`, `/articles` | Typed | type, at, summary, countryIds; title, excerpt, author, newspaper | |
| `/laws` (catalog), `/contracts`, `/tournaments` | `/laws`, `/contracts`, `/tournaments` | Generic (samples exist) | | |
| `/players/{id}` (+stats/companies), `/parties/{id}`, `/elections/{id}`, `/laws/{id}`, `/companies/{id}`, `/articles/{id}`, `/battles/{id}`, `/units/{id}`, `/regions/{id}`, `/alliances/{id}`, market item endpoints | detail pages | Generic | | no samples supplied |

## Images
- **Players, units, parties, company owners:** relative `/media/...` paths from the API, joined to the API origin (`src/lib/media.ts`, only `/media/` paths accepted).
- **Items:** `https://ageofnations.world/items/{itemCode}.webp`, a pattern observed on the game's public site for tank, steel, case2, helmet4, rifle, oil, bread, grain, concrete, jet, chest4, sniper (`ITEM_ICON_BASE` in `src/lib/config/environments.ts`). It is assumed for other codes; a missing file falls back to a generic icon.
- **Countries:** the API and the public site provide no flag asset, so NationScope bundles standard national flags (MIT `flag-icons`, `public/flags`, game id `uk` -> `gb`). A missing flag falls back to a colour token (the country's `scheme`) with its code.
- Companies have no logo field in the samples.

## Calculations (never presented as API facts)
Marked in the UI with Calculated / Estimate badges: market spread, ask-vs-last, volume-weighted trade price, median/average net pay, company shares, alliance totals, war duration, core control percent, round damage split. All money stays BigInt (1/10,000 gold). See `src/features/economy/analytics.ts` and `tests/real-data.test.ts`.

## Not available / not built
- **Price history charts:** `/market/{item}/history` was not sampled; NationScope stores no history. A snapshot collector (Supabase or similar) would be needed for long-term trends and is not built.
- **Production, profit, wages formulas:** need the Wiki rules (URLs not provided).
- Player, unit and battle detail pages remain generic until their responses are captured.
