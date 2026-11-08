# Live API Verification Log

## Verification session

- **Date:** 2026-11-07
- **Target:** `https://app.ageofnations.world/api/v1`
- **Method:** read-only GET requests; no writes or authenticated mutations.
- **Volume:** 20 GET attempts; 19 returned HTTP 200 and one timed out. This was a bounded sample, not a full endpoint sweep.
- **Evidence:** HTTP response date headers were approximately `Sat, 07 Nov 2026 12:32 UTC`; a player payload's `serverTime` was approximately `2026-11-07T12:34:32Z`.
- **Freshness caveat:** the API reference says responses may be cached for 30 seconds. A successful response confirms live endpoint reachability at that time, not that every field was generated at the exact request instant.

## Requests and outcomes

| Request | Outcome | What it established |
|---|---|---|
| `GET /game` | Timeout at 15 s | No response shape verified in this session. A saved game sample exists. |
| `GET /countries` | 200 | Country list shape and discoverable IDs. |
| `GET /search?q=Egypt` | 200 | Search groups and player/country/region/unit discovery IDs. |
| `GET /countries/{discoveredCountryId}` | 200 | Country detail and relationships. |
| `GET /countries/{discoveredCountryId}/parties` | 200 | Party list and Party IDs. |
| `GET /countries/{discoveredCountryId}/units` | 200 | Unit list and Unit IDs. |
| `GET /regions/{discoveredRegionId}` | 200 | Region detail fields. |
| `GET /regions/{discoveredRegionId}/companies` | 200 | Regional companies and Company IDs. |
| `GET /battles?status=active&limit=1` | 200 | Battle list shape and a current Battle ID. |
| `GET /players/by-name/{nameFromSearch}` | 200 | Name-to-Player-ID resolution. |
| `GET /players/{discoveredPlayerId}` | 200 | Player profile fields including `prestige`, `rank.attackBonusPercent`, `economy`, `skills`, `equipment`. |
| `GET /players/{discoveredPlayerId}/companies` | 200 | Player-company page shape; this example returned an empty list. |
| `GET /players/{discoveredPlayerId}/stats` | 200 | Player stats fields including work/trade/company aggregates. |
| `GET /parties/{partyIdFromCountryList}` | 200 | Party ID follow-up works for the tested ID. |
| `GET /units/{unitIdFromCountryList}` | 200 | Unit ID follow-up works for the tested ID. |
| `GET /battles/{battleIdFromBattleList}` | 200 | Battle ID follow-up works and returned detailed battle fields. |
| `GET /companies/{companyIdFromRegionList}` | 200 | Company ID follow-up works and returned production/upgrades/worker fields. |
| `GET /market` | 200 | Market item codes, bid/ask quantities and prices. |
| `GET /equipment?slot=weapon&limit=1` | 200 | Equipment offers include seller/item/listing IDs and sale data. |

IDs were discovered from earlier responses during this same session; no ID from a saved fixture was treated as guaranteed valid. The exact IDs and player identity are intentionally omitted from this reusable report.

## Limits of this verification

The live sample is not a complete schema contract. It does not verify all routes, all query values, pagination completion, edge cases, error bodies, authentication/privacy variations, or game semantics. In particular, `/game` did not return within the timeout, and `player.equipment` semantics remain unverified. The OpenAPI reference's generic response schemas remain a major limitation.
