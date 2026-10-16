# Game data audit (Build Planner prerequisites)

Last checked: 2026-10-15. Sources: OpenAPI at dev.ageofnations.world/api/docs/json, and one live Main response.

| Item | Status |
|---|---|
| Main `GET /api/v1/units` | **Verified live** (JSON array; fields in `src/lib/domain/units.ts`; real sample in `tests/fixtures/main/units.sample.json`). |
| All other endpoints | Documented in the spec with generic `object` responses and **no field lists**. Not yet inspected on Main. |
| `/game` | Spec says: server time, ruleset version, battle and contract rules, leaderboard ids, history event types. **Skill rules are not mentioned.** |
| Skill levels, costs, effects | **Not documented.** |
| Equipment stats / effects | **Not documented** (spec: "weapons and armour offered by players", filters slot/rarity/sort). |
| Player profile fields (skills, energy, hunger, buffs) | **Not documented**, unverified. |
| Owned equipment | **No endpoint in the spec.** Likely not public; manual entry would be needed. |
| Damage formula | **Not documented.** |
| Money | Documented: integer strings in 1/10,000 gold (handled exactly with BigInt). |

## How to unblock
The assistant's fetch tool can read URLs that appear in a chat message. Paste the full Main URLs for `/game`, `/equipment`, `/equipment/floor`, `/market`, `/market/{itemCode}/orders` and one `/players/{userId}` (e.g. `usr_w6np9esu52k84j3j`, owner of unit "Arthur Reign"), or enable `app.ageofnations.world` in the sandbox network allowlist. Then: capture fixtures, write schemas, and only then wire a *verified* ruleset into `src/features/planner`.

## Mechanics investigation log (2026-10-15)

| Source | Result |
|---|---|
| `https://app.ageofnations.world` (game app) | Reachable by the assistant's fetch tool, but it only returns page metadata (it strips scripts), so **bundle URLs and source maps could not be discovered or read**. |
| `https://ageofnations.world/` (marketing site) | Read in full. Describes features only. It exposes item image names (`tank`, `steel`, `rifle`, `jet`, `helmet4`, `chest4`, `sniper`, `case2`, `grain`, `bread`, `oil`, `concrete`) and says gear matters ("better gear wins rounds, and losing it hurts") and that paid plans give no combat advantage. **No skills, stats, caps or formulas.** Image names are not confirmed item codes or slots. |
| Web search for guides/wikis | Only unrelated games were returned. No public rules page found. |
| OpenAPI spec | No skill, equipment-stat, hunger/energy or damage-formula documentation (see table above). |

**Conclusion:** no verified skill, equipment or damage formula exists in anything the assistant could read. Nothing was inferred, because no observations were available yet.

## Inference path (when data is available)
`src/features/planner/evidence.ts` is the gate for any candidate formula. It marks a formula `verified` only if it reproduces every observation (within tolerance), has at least `minSamples` samples, and every claimed input varies across `minDistinct` values. Close-but-inexact fits are capped at `estimate`. `controlledPairs` / `marginalEffect` isolate one input at a time from observations that differ only in that input. Observations can come from `/battles/{id}` (rounds, damage, latest hits) and `/players/{id}` once their fields are inspected.
