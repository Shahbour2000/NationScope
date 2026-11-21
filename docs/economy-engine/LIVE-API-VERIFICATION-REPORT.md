# Live API verification report

**Verdict: NOT live-verified in this delivery.** The build environment cannot reach `app.ageofnations.world`; no real response was captured this session.

## Verified (real captured responses already in the repo)
| Data | Evidence |
|---|---|
| `/market` rows (best ask/bid, quantities, last) | `tests/fixtures/real/market.json`; used by golden tests |
| `/jobs` offers: gross/net/tax per point, `allowedWage {min,max,median}` | `jobs.json`; all 46 offers re-derive their net and tax in a test |
| `/market/trades` (all items): item, qty, price, time | `market-trades.json`; drives the activity sample |
| `/companies/{id}`: recipe, `bonuses`/`bonusTotal`, taxes, store (`points`, `capacity`), upgrades with next-level costs | `company-detail.json` (from the repo's API samples) |
| `/countries/{id}` taxes (income, market, selfWork, production) | `country-eg.json` |
| `/players/{id}` skills `[{code, level, maxLevel}]` | `API/PLAYER_DATA_AUDIT.md`, `player-skills.json` (hand-transcribed) |

## NOT verified
| Data | Status |
|---|---|
| `/players/by-name/{name}` body | never captured; parser accepts a bare profile or `{player: ...}`; falls back to `/players/{id}` |
| `/market/{item}/orders` | never captured; `readOrderBook` is tolerant; UI says when only the best bid is usable |
| `/market/{item}/history` | never captured; parsed leniently, drawn as a chart labelled "format not yet verified", **no figure is computed from it** |
| `offer` object on a company with a posted job | sample had `offer: null`; `offerGross` read only if `grossPerPoint` exists |
| Production-point scale, skill table, bonus on engine PP, employer-pays-gross | inferred / assumed (UI tags "Inferred"/"Assumed") |
| Agents | no endpoint, no base output |

## How to verify
Run `scripts/aon-sample.mjs` (see `LIVE-SAMPLING.md`), then `npm test`. The 7 skipped tests in `live-fixtures.test.ts` become the proof. Skipped tests are reported as skipped, never as passed.
