# Military unit data coverage (GET /units/{id})

Verified against a real Main response on 2026-10-22 (`tests/fixtures/real/unit-detail.json`, unit "Arthur Reign"). Model: `src/lib/domain/unit-detail.ts`. Calculations: `src/features/units/profile.ts` (pure, tested).

| Metric on the page | Status | Source / formula |
|---|---|---|
| Name, description, status, country, region, join policy, logo | API-provided | `name`, `description`, `status`, `countryId`, `regionId`, `joinPolicy`, `logoUrl` |
| Members "8 / 10" | API-provided | `members[]` length, `capacity` (also `upgrades.dormitories.stats.members`) |
| Headquarters / dormitory level, max, attack bonus, capacity, next level | API-provided | `upgrades.headquarters`, `upgrades.dormitories` (bonus unit not documented, shown unitless) |
| Unit total damage, weekly damage, tournament wins | API-provided | `stats.totalDamage`, `stats.weeklyDamage`, `stats.tournamentWins` |
| Member role, level, country, joined | API-provided | `members[].role/level/countryId/joinedAt` |
| Member weekly and lifetime damage | API-provided | `members[].weeklyDamage`, `members[].totalDamage` |
| Online now, last active | API-provided | `members[].presence.online`, `presence.lastActiveAt` ("x ago" is calculated at request time) |
| Members by country | Calculated | count of `members[].countryId` |
| Weekly damage bars | Calculated | member weekly / largest listed member weekly |
| Eco / War build | **Unavailable** | no skill-point fields in the response; classification rule also unknown |
| Buff / debuff state and time left | **Unavailable** | not in the response |
| Health, hunger | **Unavailable** | not in the response |
| Daily damage | **Unavailable** | only weekly and lifetime exist; no daily series |
| Skill-reset cooldown | **Unavailable** | not in the response |
| Damage by target country (today / week) | **Unavailable** | not in the response |

## Verified quirks (do not "fix" by summing)
- Sum of members' `totalDamage` (7,442,863) differs from `stats.totalDamage` (6,435,341); sum of members' `weeklyDamage` (2,245,787) differs from `stats.weeklyDamage` (2,027,018). The API reports them separately, so the page shows both and never derives one from the other.
- The boundaries of the "weekly" window are not documented.
- Member damage values are integer strings; all arithmetic uses BigInt.

## Samples that would unlock the missing metrics
1. `GET /players/{userId}` and `/players/{userId}/stats` for a unit member (skills, buff/debuff, health, hunger, daily damage, reset cooldown, if exposed at all).
2. A battle or ranking response that attributes unit damage to target countries (none seen so far).
3. The game rule for classifying a skill-point distribution as Eco or War.
