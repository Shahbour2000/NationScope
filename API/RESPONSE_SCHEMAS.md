# Response Schema Notes

This document records fields visible in the supplied samples and the limited live checks from 2026-11-07. It is not a generated or authoritative API schema. OpenAPI 3.0.3 version 1 has no component response schemas; most `200` responses are generic objects with `additionalProperties: true`.

## Saved sample shapes

| Response family | Example top-level fields | Nested/relationship fields observed | Sample source |
|---|---|---|---|
| Game rules | `serverTime`, `rulesetVersion`, `battleRules`, `contractRules`, `leaderboards`, `historyTypes` | Rule-specific structures are present but need version-aware validation. | `samples/game/Game information.txt` |
| Search | `query`, `players`, `countries`, `regions`, `units`, `parties`, `alliances`, `articles`, `total` | Search result entries contain IDs and display labels; query is required by OpenAPI. | `samples/game/Global search.txt` |
| Country list/detail | `countries`; detail `id`, `name`, `capitalRegionId`, regions, taxes, government, alliance, wars | Country references link regions, Party, Alliance and other countries. | `samples/countries/` |
| Country parties/units | `countryId`, `parties`; units as array | Party `id`, leader ID; unit `id`, owner ID, region ID. | `Country parties.txt`, `Country units.txt` |
| Region detail | `id`, `name`, `countryId`, `coreCountryId`, biome/climate, deposit, upgrades, battle, companies, neighbors | Company IDs and country IDs. | `samples/regions/Region details.txt` |
| Company list/detail | List `total`, `limit`, `offset`, `companies`; detail `id`, `itemCode`, `regionId`, `countryId`, `owner`, `production`, `bonuses`, `upgrades`, `workers`, `offer` | Owner includes player ID/name; offer includes wage/slots/minimum requirements. | `samples/companies/` |
| Market | Array of `itemCode`, `currency`, `bestAsk`, `askQty`, `bestBid`, `bidQty`, `last` | Money values are strings in 1/10,000 gold per OpenAPI description. | `samples/market/Market prices.txt` |
| Equipment offer | Live example: `offers`, `nextOffset`, `minLevel` | Each offer included `offerId`, seller/item IDs, itemCode, rarity, slot, stats, durability, price, createdAt. | No saved offer sample; live observed. Listing semantics are explicit in route/context. |
| Battle list/detail | List array with `id`, type/status, region/countries/units; detail includes `rounds`, `ticks`, totals, leaderboards, `recentHits`, `rules` | References to war, region, attacker/defender countries and military units. | `samples/battles/` |
| Country history | `items`, `nextCursor` | Event-specific fields vary. | `samples/countries/Country history.txt` |
| Laws/elections | Proposal detail includes `id`, `scope`, `scopeId`, `lawCode`, `proposerId`, status/vote/times; elections include `id`, kind, countryId, partyId, candidates, outcome | Proposal IDs are distinct from law catalogue codes. | `samples/politics/`, `samples/laws/`, `samples/elections/` |
| Jobs/contracts | Job response includes `viewer`, `energyCost`, `allowedWage`, `offers`; contract response includes rules/bounties/auctions/my contracts | IDs may refer to companies, players, battles or auctions. | `samples/jobs/`, `samples/contracts/` |

## Live player shape observed

`GET /players/{userId}` returned top-level fields including `id`, `username`, `countryId`, `level`, `xp`, `xpLevelStart`, `xpNextLevel`, `prestige`, `rank`, `damage`, `economy`, `equipment`, `presence`, `skills`, `party`, `unit`, `history` and others. In the inspected response:

- `rank` had `code`, `minDamage`, `attackBonusPercent`, `index`, `next`.
- `damage` had `total`, `day`, `week`, `month` (money-like damage values represented as strings in that sample).
- `economy` had `lifetime`, `recent`, `companies`; lifetime/recent included shifts, production, wages and market buy/sell aggregates.
- `equipment` was an array whose observed entry had `slot`, `itemCode`, `rarity`, `stats`, `durability`.
- `skills` was an array of `{code, level, maxLevel}` in the inspected response.
- `presence` had `lastActiveAt`, `online`.

The live sample proves those fields appeared for one public player at one time. It does not prove every field is always present, that null/empty behavior is stable, or the exact meaning of `equipment`.

## Types and response handling

Use `RESPONSE_SCHEMAS` as an evidence index only. Before treating a field as a product contract, capture multiple representative responses and define a runtime schema that explicitly handles nullable/optional fields, arrays, money strings, enum drift, and pagination. Preserve unrecognized fields in diagnostics where safe, but do not let untyped data silently drive calculations.
