# Critical Player Mechanics Verification

**Scope:** read-only investigation of player equipment, skill points after Prestige, and `rank.attackBonusPercent` for the Build Optimizer.

**Changes:** this report is the only file created for this phase. No application code, domain models, API client, UI, database, or existing documentation was changed. No tests or migrations were run.

**Live requests this phase:** none. The prior bounded live verification is recorded in [`LIVE_VERIFICATION.md`](LIVE_VERIFICATION.md): on 2026-11-07 it observed one `/players/{userId}` response and one `/players/{userId}/stats` response among other requests. A later `/game` request timed out. Repeating the same public profile response would confirm field presence, not resolve the semantic questions below.

## Evidence classification

- **Confirmed** — directly stated by the supplied Wiki, observed in a dated live response, or directly implemented in source. These evidence kinds are named separately where relevant.
- **Strongly supported** — the evidence points to this interpretation, but does not prove it.
- **Unverified** — available evidence cannot settle it.
- **Contradicted** — the current formula/claim conflicts with the supplied evidence. This does not automatically mean live-game behavior is settled if the Wiki text itself needs validation.

The supplied OpenAPI document has generic successful-response schemas and no component schemas. Its existence does not settle undocumented field semantics.

## 1. `player.equipment`

### Findings

| Conclusion | Status | Evidence |
|---|---|---|
| The live player response contains an `equipment` array. | **Confirmed — live observed** | The 2026-11-07 player response in [`LIVE_VERIFICATION.md`](LIVE_VERIFICATION.md) included this top-level field. The inspected entry shape was `{slot, itemCode, rarity, stats, durability}`; the response had five entries. |
| This is distinct from `/equipment` market offers. | **Confirmed** | The player response nests gear under a player profile. The separate `/equipment` response is an offer list containing fields such as `offerId`, `sellerId`, `itemId`, `price`, and `createdAt`. The live verification log records each route separately. |
| It represents player-associated gear rather than the public market. | **Strongly supported** | It is returned by `/players/{userId}` and uses slot/stat/durability fields. It is not shaped like the public offers response. |
| It is specifically the currently equipped loadout, rather than all owned inventory or another player gear view. | **Strongly supported, not confirmed** | In the Phase 3 development profile there is exactly one entry for each of the six Wiki equipment slots (chest, helmet, gloves, weapon, boots, pants), each with the item's live stats and remaining durability. This looks like a currently equipped loadout. The field has no documented semantic contract or equipped flag, so the API could still be a different player gear view. The prior production sample had five entries, showing the list can be partial or the account can have a slot empty. |
| It contains the complete set of owned items. | **Unverified, with no supporting evidence** | No pagination, inventory quantity, item IDs per owned item, or explicit inventory list semantics were recorded for this field. The public OpenAPI contains no `/inventory` endpoint. Absence of such a route in this reference does not prove the profile field cannot contain inventory data. |

### Current implementation

- `src/lib/domain/player.ts:9–17` accepts unknown profile properties using `.passthrough()`, but `parsePlayer` at lines 32–45 constructs a restricted return object and does not copy `equipment`.
- `src/features/build-optimizer/adapter/player-state.ts:116–118` therefore treats gear as unavailable unless supplied by the user. The comments that equipped gear is not exposed by any recorded endpoint are stale relative to the live field-presence observation, though the semantic uncertainty remains.
- `src/features/build-optimizer/adapter/import.ts:4–7, 17–27` fetches public equipment offers separately and `adapter/market.ts` turns those into candidate market items. Those offers must not be presented as player-owned or currently equipped items.

### What would resolve the meaning

Obtain an authoritative API contract or confirmation from the game/API owner; or compare the profile field with the player's Inventory UI in a controlled account that has distinct equipped and unequipped items. The comparison should include an empty slot, a broken item, and an item listed for sale if feasible. A repeat GET of the same public profile would not resolve this by itself.

## 2. Skill points after Prestige

### Findings

| Conclusion | Status | Evidence |
|---|---|---|
| Each player level gained grants 4 skill points. | **Confirmed — Wiki documented** | `Wiki/01-basics.md:137–151` says each new level grants four skill points. |
| Prestige occurs at level 50, removes 405,825 XP and drops the player to the level matching remaining XP. | **Confirmed — Wiki documented** | `Wiki/01-basics.md:262–269`. This document has not been independently verified against the live game during this phase. |
| At Prestige, all skill points are returned so they can be spent again; Prestige also grants 4 additional skill points. | **Confirmed — Wiki documented** | `Wiki/01-basics.md:267–269`. This indicates previously allocated points are refunded/reallocatable, not forfeited. The exact treatment of any already-unspent points is not separately described. |
| `4 × (current level − 1) + 4 × prestige` matches an actual post-Prestige example. | **Strongly supported for the observed state; general/lifecycle rule remains unverified** | Phase 3 development profile: level 50, Prestige 7. Applying the documented skill cost schedule to its current skill levels gives 224 invested points. The candidate formula also gives `4×(50−1)+4×7 = 196+28 = 224`. This exact match is strong corroboration for this player at level 50. It does not reveal the balance immediately after level loss, prove the result for other levels, or prove that this account has no additional unspent points. The Wiki wording about returning all points at Prestige still needs temporal reconciliation. |
| The API exposes a Prestige count. | **Confirmed — live observed in development and production** | The prior 2026-11-07 production sample had `prestige: 0`. The Phase 3 development profile and its stats both had `prestige: 7`. The supplied OpenAPI response schema does not enumerate these fields. The supplied ID returned 404 on production. |
| The API exposes exact earned or unspent skill-point totals. | **Unverified; not present in the inspected profile/stats response** | The development profile had `prestige`, `level`, and `skills`; stats had level/XP/Prestige/rank and activity fields. Neither response exposed an explicit total-earned or available/unspent point field. Skill levels yield the invested cost under the supplied cost schedule; they do not prove any residual balance. |

### Current implementation

- `src/features/build-optimizer/engine/skills.ts:56–64` labels the level-plus-Prestige formula as documented, while separately marking its level-drop interaction unverified. Phase 3 now provides an exact match for one level-50/Prestige-7 player's invested points, so the formula is better supported than the Phase 2 evidence allowed. It is still not independently confirmed across the post-Prestige level drop or other player states.
- `skills.ts:113–157` implements `4 × (level − 1) + 4 × prestigeCount`; when prestige is unknown it estimates a lower bound from current level and invested skill points.
- `src/features/build-optimizer/adapter/player-state.ts:86–99` says Prestige is not exposed and asks for it manually. The live sample shows that assumption is stale. But even after consuming the count, the ledger formula is not reliable until the post-Prestige retention rule is confirmed.
- `src/features/build-optimizer/engine/optimize.ts:77–78` has a lower-level fallback that calls `pointsEarned` with `prestigeCount ?? 0`; callers that do not provide a total can therefore use the formula with zero Prestige. The main adapter path has its own ledger and uncertainty messaging, but that does not validate the underlying formula.

### What would resolve the formula

Use the game’s pre-confirmation Prestige screen and Skills page, or a controlled account record immediately before and after Prestige, capturing: level, XP, each skill level, unspent points, total points available, Prestige count, and subsequent level-ups. At least one post-Prestige account is needed; the prior live sample had Prestige 0 and cannot test the interaction. A game/API owner explanation of whether points are preserved/refunded and how level-up points are counted would also resolve it.

Until then, the safest source for the optimizer’s budget is a direct observed unspent-point total from the Skills page (if the player provides it), or a direct earned-total value if one becomes available. Do not call the current formula exact for prestiged players.

## 3. `rank.attackBonusPercent`

### Findings

| Conclusion | Status | Evidence |
|---|---|---|
| Rank grants an attack bonus on every hit. | **Confirmed — Wiki documented** | `Wiki/01-basics.md:231–246` says each military rank adds attack to every hit and lists thresholds and percentages. |
| API profile rank includes `attackBonusPercent`. | **Confirmed — live observed** | The prior live response included rank fields `code`, `minDamage`, `attackBonusPercent`, `index`, `next`. The corresponding stats response also had a rank object. The exact field is not described in the supplied OpenAPI schema. |
| It is a direct combat attack percentage, rather than a damage-history statistic. | **Strongly supported** | The field name and values align with the Wiki rank attack bonus table. The Wiki calls the rank effect “attack,” and the battle sequence applies rank with personal attack boosts. No API semantics text formally defines the field. |
| It applies after Attack skill plus weapon attack, together with personal bonuses, before accuracy/critical/luck and battle modifiers. | **Confirmed — Wiki documented; implementation aligned** | `Wiki/03-war.md:68–82` (section 1.6) specifies attack skill + weapon first, then sums ammo/stimulant/rank boosts, followed by accuracy and critical logic. `combat.ts:125–147` computes attack skill, adds weapon/accuracy overflow, multiplies by additive ammo+rank percentage, then applies outcome critical and battle multipliers. |
| It applies only to skill, or only to weapon, or as an independent multiplier after final rounded damage. | **Contradicted by the Wiki’s stated order** | The supplied battle sequence places rank among boosts after skill+weapon attack and before the hit outcomes. This describes a modifier on the combined attack base. The exact engine implementation is still subject to calibration/verification of game rounding and any undocumented stacking rules. |
| The percentage is already included in `damage.total`. | **Unverified; no evidence it is** | `damage.total` is a lifetime damage accumulator used by Wiki to determine rank. Neither the profile sample nor OpenAPI says the value is a current per-hit statistic containing the rank bonus. Do not infer inclusion from the presence of both fields. |
| The local rank table numerically conflicts with the Wiki. | **Not contradicted by supplied values** | `src/features/build-optimizer/engine/ranks.ts:4–14` reproduces the Wiki damage thresholds and percentages, including the 12% top rank. Exact API value/table comparison was observed only for the one live profile’s rank, not every tier. |
| The optimizer currently double-counts rank by using both the API field and local table. | **Contradicted by current data flow** | `parsePlayer` drops `attackBonusPercent`; the adapter uses one rank value derived from `rank.code`/damage or a user override. The live API value is not currently passed through, so the rank is not double-counted. |
| The current optimizer underestimates rank bonus because it ignores `attackBonusPercent`. | **Not established; no systematic underestimate demonstrated** | `player-state.ts:102–108` maps recognized rank code to the local table, and falls back to lifetime damage thresholds. Those table values match the supplied Wiki. The direct API field is unused, but the current path can still produce the same number. It could diverge if the API value and local table differ, rank codes are unrecognized, or the Wiki/table is outdated. |

### Current calculation trace

1. `parsePlayer` keeps only `rank.code` (`src/lib/domain/player.ts:32–45`); it discards `rank.attackBonusPercent`.
2. `buildPlayerState` maps that code using `rankFromCode`, with `rankFromDamage` based on lifetime damage as fallback (`adapter/player-state.ts:101–108`). The local table is in `engine/ranks.ts:4–25`.
3. The selected bonus is put into combat input in `adapter/scenario.ts:82–85, 133` (or an explicit user override can take precedence in `player-state.ts:105`).
4. `computeHit` creates `attackBase = effectiveAttackSkill + weaponAttack + accuracyOverflow` at `engine/combat.ts:125–128`; then default additive stacking computes `1 + (ammoPct + rankPct)/100` at lines 130–144.
5. The resulting base `A` feeds graze/clean/critical outcomes; the critical multiplier and battle multiplier are applied afterward at lines 146–154. Rank therefore scales the attack base and consequently scales the damage of each outcome; it does not directly change critical chance or critical-damage stat.

`player-state.ts:105–106` currently marks a bonus sourced from the local rank table as source `api` whenever the rank code came from API. The rank code is API-sourced, but the percentage is locally derived; this provenance label is inaccurate. It is not a numeric double count, but it can obscure where the value came from.

## Consolidated current-vs-evidence view

| Data/mechanic | Current optimizer behavior | Evidence-based status |
|---|---|---|
| Player equipment | Drops profile `equipment`; prompts for manual gear; imports public market offers as alternative candidates | API player field confirmed, semantics unverified. Market offer distinction confirmed. |
| Prestige count | Treats as unavailable/manual and calculates point budget from the current level plus optional manual count | API field is live-observed in both environments (value 7 in dev, 0 in prior prod sample), but current parser drops it. Candidate formula matches the dev P7 level-50 invested allocation exactly; post-level-drop and unspent balance remain unverified. |
| Available skill points | May derive from total earned minus invested, or use manual available/total overrides; no direct API field observed | Exact total not proven from profile fields alone. |
| Rank bonus | Uses local table via rank code or damage; sends one percentage to combat and additively combines with ammo by default | Wiki application order supports current placement. API direct percent is ignored. No demonstrated numerical error from that omission for known ranks. |

## Recommended changes (not implemented)

1. **Do not auto-use `player.equipment` yet.** First confirm whether it is equipped-only, owned inventory, or a mixed view. Then model its semantics explicitly and keep it separate from market offers.
2. **Reconcile the Prestige ledger with the actual Skills page.** Preserve the current caution about unknown points; remove any “exact” claim for a post-Prestige total until the account-level behavior is demonstrated. Prefer an explicit observed available-points input if the game exposes it to the player and no API field exists.
3. **Prefer the server-reported rank percentage as the runtime value once parsed**, while retaining the local table as a documented fallback and consistency check. The dev API returned General/+8%, exactly matching the Wiki and local table. Keep only one rank value in combat input and surface any mismatch rather than silently choosing one.
4. **Correct provenance labels** so a percentage computed from a local table is `derived`, not `api`.
5. **Calibrate rank stacking against a controlled hit or authoritative game rule** before changing additive/multiplicative behavior. Current ordering matches the Wiki, while damage rounding and other combat conventions remain separate uncertainties.
6. Add anonymized fixtures for: no equipment, partial loadout, multiple owned items in one slot, nonzero Prestige, and rank values near thresholds. Test parsing and ledger behavior against the source snapshots, not only against the same formula implementation.

## Priority before expanding player-data integration

1. **Resolve the post-Prestige level-drop balance and unspent total** from an in-game record. The current formula is strongly supported at level 50 / Prestige 7, but the API exposes no explicit points balance and the history does not record point totals at Prestige time.
2. **Establish `player.equipment` semantics and completeness** against inventory UI or API-owner documentation.
3. **Model rank bonus provenance and precedence:** decide whether the live percentage or local table is authoritative, and prevent any future double source.
4. **Document live response schemas and variation** across multiple player states (Prestige 0/nonzero, empty/partial gear) before widening the shared player domain model.

No additional API requests were necessary in this phase; existing live observations established field presence but did not resolve the remaining semantic questions.

## Phase 3 addendum — development and production comparison

This addendum supersedes Phase 2 conclusions where the additional player evidence changes their strength. It does not change the earlier historical record or the implementation.

### API requests performed

Read-only GET requests made on 2026-11-07:

| Environment | Endpoint | Result |
|---|---|---|
| Development (`dev.ageofnations.world`) | `GET /api/v1/players/{suppliedId}` | 200; response date `Sat, 07 Nov 2026 12:56:38 GMT`. Returned level 50, Prestige 7, General/+8%, six equipment entries, skills, and seven Prestige history rows. |
| Development | `GET /api/v1/players/{suppliedId}/stats` | 200; response date `Sat, 07 Nov 2026 12:56:39 GMT`. Confirmed Prestige 7 and the same General/+8% rank. No skill-point total or available-points field appeared in the response keys. |
| Production (`app.ageofnations.world`) | `GET /api/v1/players/{suppliedId}` | 404 `NOT_FOUND`, `Player not found`. This ID is not available on the queried production API at verification time. No production stats request was made after the profile 404. |

The first development requests were repeated once because a local response-summary script failed after fetching; the retry above captured both successful responses. Thus five GET attempts were made in total (two development endpoints twice, one production profile request once). No write request was made.

### Equipment reassessment

The development response had exactly six entries, one for every Wiki slot: chest, helmet, gloves, weapon, boots, and pants. Each entry included `slot`, `itemCode`, `rarity`, `stats`, and `durability`; the six entries had low remaining durability. That one-per-slot structure, combined with the Wiki statement that a player wears one item per slot, makes **currently equipped loadout the strongly supported interpretation**.

It is not fully confirmed: the response has no `equipped` boolean or item identifier/status field, and the OpenAPI document has no schema or description for this property. The Wiki also describes the Equipment tab as containing both equipped items and owned gear. Therefore:

- `player.equipment` is strongly supported as a snapshot of the six equipped slots.
- It is **not** evidence of the complete owned inventory; there may be additional unequipped items not returned.
- The public `/equipment` endpoint remains a distinct market-offer list (`offerId`, `sellerId`, `itemId`, price and listing data). It is not ownership or equipped state.
- The production profile sample from the earlier Phase 1 check contained five equipment rows. This could mean one empty slot or a different response state; it prevents treating six rows as mandatory or assuming all slots are populated.

The most useful remaining confirmation is comparison with the same player's Inventory UI or an API-owner statement, especially when that player owns an unequipped duplicate of an equipped slot item.

### Prestige and skill-point reassessment

The development profile reports level 50 and Prestige 7. Its valid skill levels map to these point costs under the supplied Wiki schedule and the current `COST_BY_LEVEL` table:

| Skill | Level | Invested points |
|---|---:|---:|
| Health | 7 | 22 |
| Hunger | 7 | 22 |
| Attack | 8 | 30 |
| Critical chance | 9 | 39 |
| Critical damage | 8 | 30 |
| Armor | 9 | 39 |
| Accuracy (`precision`) | 8 | 30 |
| Dodge | 5 | 11 |
| Loot chance | 1 | 1 |
| Energy, company slots, business, production, leadership | 0 | 0 |
| **Total invested, excluding non-optimizable `stamina`** |  | **224** |

The candidate total formula gives `4 × (50−1) + 4 × 7 = 224`. Thus this response gives a **strongly supported consistency check** for the formula at the observed level/prestige combination. Since the profile does not expose total-earned or unspent points, it does **not** prove that the player's available balance is zero; zero is only implied if the formula is correct and those are all current skill allocations.

The history contains seven events with summaries “Reached prestige 1” through “Reached prestige 7.” They are ordered and support that the API's Prestige count corresponds to a sequence of Prestige events. The event records contain no old/new level, XP delta, skill allocation, refunded points, available points, or point-total snapshot. Their closely spaced timestamps do not establish actual progression timing; the environment and event pattern may be a development/test state.

This reconciles the Phase 2 evidence partially: the Wiki's “all skill points are returned” wording can mean allocations are refunded/reallocatable, while the current formula can still match the total budget at a later level-50 state. But the current profile is already back at level 50 after seven Prestige events; it does not reveal the budget immediately after the level drop. The formula is no longer classified as generally contradicted; it is **strongly supported for this example, unverified across the Prestige transition**.

### Rank reassessment

The development API reports `rank.code: "general"`, `minDamage: 50,000,000`, and `attackBonusPercent: 8`; its `next` rank is Warlord at 200,000,000 / 12%. The Wiki table in `01-basics.md:231–246` and NationScope's local table in `engine/ranks.ts:4–14` both assign General 8% and Warlord 12%. The development response therefore confirms an exact value match for General.

The current source path remains unchanged: `parsePlayer` retains only rank code (`src/lib/domain/player.ts:32–45`), and the optimizer maps the code to local table percentage (`adapter/player-state.ts:101–108`). `combat.ts:125–147` applies the resulting rank percentage additively with ammo to skill + weapon + accuracy-overflow attack, before hit outcome critical damage and battle multiplier. For the tested General rank this produces no observed undercount or double-count. The direct API percentage should become the preferred runtime value after integration, with the local table retained as fallback and a consistency check—not applied in addition to it.

The API fields `rank.attackBonusPercent` and cumulative `damage.total` are separate values in the response. There is no evidence that lifetime damage already includes a current modifier a second time; damage is the historical rank-progress metric. This remains an absence-of-evidence conclusion, not a formal API guarantee.

### Production comparison

The supplied development player ID returned 404 on production at the time checked. Therefore no claim is made that the development player's Prestige 7 state, equipment, skills, or General rank exists on production. The prior Phase 1 production sample was a different player and had Prestige 0; it is not a valid substitute for this comparison.

### Exact next implementation phase recommended

**Phase 4 — Typed Player Snapshot Integration (narrow scope, after approval):**

1. Add typed profile fields and runtime validation for `prestige` and `rank.attackBonusPercent`; propagate their provenance to the optimizer. Use API rank percentage as the single runtime input, retain local ranks for fallback/diagnostics, and never double-apply it.
2. Add a separate typed `playerEquipmentSnapshot` matching the observed six-slot shape. Do not call it complete inventory. Based on current evidence it may be presented as “profile-reported slot equipment” with a confidence note; only feed it into the optimizer as equipped gear after Inventory UI/API-owner confirmation.
3. Keep the skill-point calculation behavior unchanged in that phase. Add the development profile as a sanitized fixture and verify the 224-point cost sum and equality to the candidate formula. Do not infer available points from that equality.
4. Add a follow-up evidence gate for a profile observed immediately after Prestige at its reduced level, including the Skills-page unspent count. Only then decide whether the existing formula needs a change.
5. Keep development and production fixtures/configuration clearly separated; do not use the supplied development ID as a production fallback.

No implementation work was performed in Phase 3. Approval is required before starting Phase 4.
