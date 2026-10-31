# Phase 4 – API coverage for the requested features

Method: the live API (`app.ageofnations.world`) was **not reachable** from the build sandbox, so nothing here was verified live.
Findings come from the repository's recorded real responses (`tests/fixtures/real/*`), its zod schemas and
`docs/data-audit.md`. Re-check each "Unsupported" row against the live OpenAPI document before treating it as final.

| Requested feature | Status | Basis |
|---|---|---|
| Foreign Affairs Minister in Government tab + Arabic | **Done** | Role list was hardcoded; `ministerForeignAffairs` also lacked a translation key |
| Political appointments on the player timeline | **Partial** | `GET /countries/{id}/government/history` has `userId, role, startedAt, endedAt, endReason, source`. Only the player's *current* country is queried; earlier countries, and offices beyond the API's 200-row cap, are not covered |
| Account-created timeline event | **Supported if present** | `joinedAt` on `/players/{id}`; shown only when the field is returned |
| Combat milestones (best day / week / battle, war bounty) | **Unsupported** | No per-player battle or daily-damage history endpoint is recorded. Needed: a player damage-history endpoint (daily rows with date + damage) and per-player battle hits |
| Economic milestones | **Unsupported** | No per-player economic history. Needed: a player trade / wage / company-event history |
| Player health / hunger (current + max) | **Unsupported** | `/players/{id}` returns skill levels only; current health/hunger values are not in any recorded response. Needed: `health.current`, `health.max`, `hunger.current`, `hunger.max` |
| Unit member health / hunger bars + aggregates | **Unsupported** | Same fields are missing from the unit and member responses |
| Buff / Debuff status and remaining time | **Unsupported** | No active-buff, debuff or expiry timestamp in recorded responses. Needed: `buff.active`, `buff.endsAt`, `debuff.active`, `debuff.endsAt` per player |
| Monthly buff calendar | **Unsupported** | Needs a buff **event history** (one timestamp per buff received); current status alone cannot reconstruct past days |
| Daily damage chart (weekly/monthly + average line) | **Unsupported** | Only aggregate `day/week/month/total` damage is exposed. Needed: daily damage rows per player |
| Build-distribution pie over time | **Unsupported** | Only the current skills are known; there is no skill history or stored snapshot. Needed: dated skill snapshots (or a skill-change log) |

No placeholder, estimated or evenly-distributed values were added for any unsupported item.
