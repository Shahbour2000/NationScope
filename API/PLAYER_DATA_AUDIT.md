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
