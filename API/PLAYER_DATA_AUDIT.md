# Player Response Audit — API to Build Optimizer

## Evidence and scope

On 2026-11-07, a read-only live request to `/api/v1/players/{userId}` returned a profile with the fields listed below. A separate request to `/players/{userId}/stats` returned a stats object. This is a dated observation for one public profile, not a complete API contract. The supplied OpenAPI response schema is generic and does not enumerate these fields.

## Fields observed on the live player profile

The profile's top-level keys included:

`id`, `username`, `staffBadge`, `avatarUrl`, `bannerUrl`, `nameStyle`, `bio`, `deleted`, `isSelf`, `countryId`, `homeRegionId`, `regionId`, `level`, `xp`, `xpLevelStart`, `xpNextLevel`, `prestige`, `rank`, `damage`, `economy`, `equipment`, `presence`, `skills`, `badges`, `roles`, `party`, `unit`, `referrals`, `premium`, `joinedAt`, `history`, and `serverTime`.

Relevant nested fields observed:

| Field | Observed shape | Interpretation status |
|---|---|---|
| `prestige` | Integer; `0` in the inspected sample | Live observed. Whether it completely resolves the optimizer's point ledger after prestige-level drops still needs a verified rule. |
| `rank` | `code`, `minDamage`, `attackBonusPercent`, `index`, `next` | Live observed. `attackBonusPercent` is a direct API value; current NationScope parser drops it. Confirm its exact combat scope and stacking against game rules before wiring it into calculations. |
| `skills` | Array of `{code, level, maxLevel}`; 15 rows in this one response | Live observed and matches current parser's recognized entry shape. Number of rows is sample-specific; unsupported/extra codes must remain handled. |
| `economy` | `lifetime`, `recent`, `companies`; activity windows, shifts, units produced, wages and market aggregates | Live observed. These appear to be player activity statistics, not company production capacity or current job assignment. Exact field meanings need API/game confirmation. |
| `equipment` | Array; observed row `{slot, itemCode, rarity, stats, durability}`; five rows in sample | Live observed. **Unverified semantics:** do not call it equipped gear or owned inventory until the API/game semantics are confirmed. It is distinct from `/equipment`, whose `offers` are sale listings. |

The `/players/{userId}/stats` response separately exposed `id`, `username`, `countryId`, `level`, `xp`, `prestige`, `rank`, `damage`, `work`, `trade`, `companies`, `joinedAt`, and `serverTime` in the tested response.

## Status update (Batch 5, 2026-11-12)

The sections "What `parsePlayer` retains", "Fields ignored by `parsePlayer`" and "What reaches Build Optimizer today" below describe the code **as audited on 2026-11-07** and are **stale**: `parsePlayer` now keeps `prestige`, `rank.code/attackBonusPercent/minDamage`, `economy` and the `equipment` rows (row-by-row validation, rejected rows kept as issues), and the adapter consumes them (`src/lib/domain/player.ts`, `adapter/player-state.ts`, `adapter/equipment-snapshot.ts`). They are kept for history. The current behaviour and the validation done in Batch 5 are in the final section of this file.

## What `parsePlayer` retains

Implementation: [`src/lib/domain/player.ts`](../src/lib/domain/player.ts).

The Zod profile schema uses `.passthrough()`, so unknown properties do not cause parse failure. But `parsePlayer` constructs a new `PlayerProfile` and explicitly selects only:

- `id`, `username` (renamed to `name`), `avatarUrl` (validated media URL), `countryId`, `level`;
- `damage.total/day/week/month`;
- valid `skills` rows limited to `code`, `level`, `maxLevel`;
- `presence.online` and `presence.lastActiveAt`;
- a restricted `unit` reference (`id`, `name`, `role`) and `party` reference (`id`, `name`, `role`);
- `rank.code` as `rankCode`;
- `joinedAt`.

All other fields are discarded when the new object is returned, even though the validation schema passed them through.

## Fields ignored by `parsePlayer`

For the live profile fields relevant to this audit, `parsePlayer` currently drops:

- `prestige`;
- all rank details except `rank.code`, including `rank.attackBonusPercent`, thresholds/index/next rank;
- the full `economy` object;
- the `equipment` array;
- `xp`, `xpLevelStart`, `xpNextLevel`;
- `homeRegionId`, `regionId`;
- `staffBadge`, `bannerUrl`, `nameStyle`, `bio`, `deleted`, `isSelf`, `badges`, `roles`, `referrals`, `premium`, `history`, `serverTime`.

Some ignored fields are irrelevant to the optimizer. Others—Prestige, rank bonus, and possibly equipment—are directly relevant and were previously described in the optimizer adapter as unavailable. That statement is stale relative to the live sample and current parser behavior.

## What reaches Build Optimizer today

`parsePlayer` output is the source for the feature's `ProfileLike` adapter in `src/features/build-optimizer/adapter/player-state.ts`. The optimizer currently receives profile level, skill rows, damage, rank code, country, unit/party display references, and basic profile identity. It does **not** receive the profile's `prestige`, direct rank bonus, `economy`, or `equipment` fields because the domain parser removed them upstream.

Current behavior downstream:

- **Prestige:** the adapter marks prestige unavailable unless supplied by the user. Its skill-point ledger can use a lower bound; it does not consume the live profile field.
- **Rank:** the adapter maps rank code to a locally defined rank/bonus table or derives a rank from damage. It does not use the directly observed `attackBonusPercent`.
- **Skills:** recognized skill codes and levels are mapped into optimizer levels. Unmapped codes are warned about. The optimizer computes invested points from its cost table; available/earned points are not directly supplied by the profile parser.
- **Economy:** the importer separately requests `/players/{id}/stats` and flattens its raw response into `PlayerState.stats`, but the field names are not modeled as a typed player economy domain object. The profile-level `economy` object is dropped. The optimizer's company/job model is primarily driven by company, market, and user-entered scenario data, not those activity aggregates.
- **Equipment:** the profile array is dropped. The importer separately loads `/equipment` offers for six slots; these become candidate market gear, not current player gear. Current equipped gear is manual/unknown in optimizer state. Do not conflate these sources.

## Potential value after semantic confirmation

1. **Prestige:** could remove unnecessary manual input and improve available point estimates, provided the game rule for point retention after level loss is confirmed.
2. **Rank attack bonus:** could replace a locally reconstructed value with a current server-reported value, provided its applicability and stacking order are confirmed.
3. **Skills:** already useful; preserve tolerant parsing and add diagnostics for missing, duplicate, invalid, or newly introduced skill codes.
4. **Economy activity:** can explain recent work/trade patterns or support player-facing context. It should not be mistaken for a forecast of future company profit or current resources.
5. **Equipment:** if confirmed to mean currently equipped gear, could improve current-build comparison and remove manual entry. If it means owned inventory, it may instead support eligible gear choices. Until clarified, neither interpretation should drive recommendations.

## Questions to resolve before implementation

- What is the authoritative meaning and completeness rule for `player.equipment`? Are rows equipped items, owned inventory, or another view? How are empty slots and durability represented?
- Does `prestige` in profile/stats represent lifetime count, current count, or another quantity, and what is the exact skill-point total after prestige reduces player level?
- Is `rank.attackBonusPercent` the final active bonus or a component that still interacts with battle context? How does it stack with ammunition, stimulant, country/unit bonuses, and caps?
- Are player `economy` aggregates cumulative, rolling, stale-cache-sensitive, and currency-normalized? Which are useful to the optimizer's intended objective?

No code or domain types were changed during this audit phase.

## Batch 5 validation (2026-11-12): availability matrix and data-handling record

**Evidence limits (read first).** No network access in this session, so nothing was re-captured. The repository contains **no raw `GET /players/{id}` or `/players/{id}/stats` response**: the only profile-shaped fixture is `tests/fixtures/real/player-skills.json`, which says in its own `note` that it is hand-transcribed (not verbatim) with assumed `maxLevel` values. The profile field shapes used by the tests come from the 2026-11-07 observation recorded above and are **synthetic** (`tests/fixtures/synthetic/player-equipment-market-cases.json`, `_meta.kind = "SYNTHETIC"`). Market and offer cases use the recorded 2026-10-17 captures (`tests/fixtures/real/market.json`, `equipment-offers.json`, `equipment-floor.json`).

| Data | API provides | Adapter behaviour (verified by test) | Status |
|---|---|---|---|
| Identity (`id`, `username`, `countryId`) | yes | read; `countryId` null stays null | observed |
| `level` | yes (number) | whole number >= 1 used; 0 / negative / fractional / non-finite -> **unavailable + warning** (was: crash); > 50 kept with a warning | fixed Batch 5 |
| `skills[{code,level,maxLevel}]` | yes, 15 rows in one capture | mapped; out-of-range level -> not used; **conflicting duplicate codes -> that skill unknown** (was: first row won silently); identical duplicates silent; unknown codes warned | fixed Batch 5 |
| `prestige` | yes (0 in the capture) | shown, **not** used for the point ledger (post-Prestige total unverified); null stays null | Unverified rule |
| Skill points (earned / available) | **no** | derived lower bound unless the user supplies a total or the available points; never assumed exact | not exposed |
| `rank.code`, `attackBonusPercent`, `minDamage` | yes | API bonus used when it matches the Wiki table for lifetime damage; otherwise the Wiki value with a warning | observed |
| `damage.total/day/week/month` | yes (digit strings) | kept as strings; null stays null | observed |
| `equipment[]` | yes, 5 rows in one capture | six-slot snapshot: present / missing (unknown, never empty) / invalid / duplicate; negative stats **invalid** (was: accepted); unknown slot names kept, not mapped; only a complete six-slot snapshot becomes a loadout | meaning (equipped vs owned) still Unverified |
| Equipment durability | yes (per row) | kept as reported; 0 is not used by Sustainable; outside 0-100 warns | observed |
| Current health / hunger, Pill state, reset cooldown | **no** | unavailable; optimizer assumptions stated | not exposed |
| Inventory stocks (bullets, food, lead) | **no** | user input only | not exposed |
| `economy` | yes | retained as history, not a forecast input | observed |
| `/players/{id}/stats` | yes | flattened raw; **no fixture and no typed schema** | uncaptured |
| Market rows (`/market`) | yes | `bestAsk`/`bestBid`/`last` -> gold; null, zero, negative or malformed -> **unknown, never a free price** (was: 0 became a free price); all 28 recorded rows have `currency = "money"` and the importer only requests the global market | fixed Batch 5 |
| Equipment offers (`/equipment`) | yes, paged (`nextOffset`) | the importer reads the **30 cheapest offers per slot** and ignores later pages: coverage is now recorded and stated in the result notes | limitation, disclosed |

