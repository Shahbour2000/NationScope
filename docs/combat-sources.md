# Combat and economy rules: sources and status

Confirmed by the game developer (relayed by the project owner, 2026-10-17):

| Rule area | Official source | Read by NationScope? |
|---|---|---|
| Hit damage, in order: attack, personal boosts, precision and graze, critical, luck spread, battle bonuses, bonus caps | Wiki "Battles" page | **No.** No Wiki URL was provided and none was found on the public site, the app page or the API docs. The stage ORDER is encoded in `src/features/planner/damage.ts`; no formula is. |
| Battle rules | `GET /api/v1/game` | No (not yet fetched). |
| Equipment data | `GET /api/v1/equipment`, `/equipment/floor` | No. |
| Market prices | `GET /api/v1/market` | No. |
| Production points, bonuses, wages | Wiki "Companies" and "Jobs" pages | No (URLs not provided). |
| Skill values per level | In-game Skills page | No (in-game only; not reachable by a web fetch). |

Nothing in the planner claims a verified formula. `runDamagePipeline` returns `incomplete` and lists the missing stage inputs until each stage supplies a rule with a `source`.

## To unblock (any one of)
1. Paste the exact Wiki URLs (Battles, Companies, Jobs) in a chat message; the assistant can then fetch them. Do not guess URLs.
2. Paste full Main URLs for `/game`, `/equipment`, `/equipment/floor`, `/market` and `/players/{id}/stats`.
3. For the Skills page, paste the per-level values as text.
