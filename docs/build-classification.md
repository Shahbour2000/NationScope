# Player build classification (War / Eco / Hybrid)

**Status: NationScope's own analytical classification, not an official in-game rating.** Code: `src/features/builds/classify.ts` (pure, no I/O), grouping helper `src/features/builds/skills.ts`, tests `tests/build-classify.test.ts`. The UI states this wherever a build is shown.

## 1. Data used (verified API fields)
`GET /players/{id}` returns `skills`: `[{ code, level, maxLevel }]`. Nothing else is used (no damage, equipment, jobs, companies or trade). The API exposes no build label, no skill costs and no skill-to-category mapping.

## 2. Skill mapping (PROVISIONAL, unverified)
- Combat: attack, criticalChance, criticalDamages, armor, precision, dodge, health, lootChance.
- Economy: production, entrepreneurship, companies, management.
- Neutral (never counted): energy, stamina, hunger.
The game documents no mapping; this one was supplied by the project owner. It lives in `BUILD_RULES` and is a one-line change.

## 3. Formula
A skill is valid if `maxLevel` is finite and > 0 and `0 <= level <= maxLevel`; the first entry per code wins; everything else is ignored.
- `fill(category) = sum(level) / sum(maxLevel)` over the category's valid skills (real maxima, never an assumed 10).
- `warShare = fill(war) / (fill(war) + fill(eco)) * 100`, `ecoShare = 100 - warShare`.
- **War** if `warShare >= 70`; **Eco** if `ecoShare >= 70`; otherwise **Hybrid**. The threshold is inclusive and compared by cross-multiplication on unrounded values, so a displayed 70.00 can never flip a player that is really below 70.
- There are exactly three build kinds. "Unclassified" no longer exists anywhere.

### Why this denominator
The denominator is the player's observed investment in classifiable skills only, not a theoretical maximum. Each category is normalised by its own capacity because the categories differ in size (8 combat vs 4 economy skills): a raw point share would make Eco >= 70% impossible for a high-level player, and a fully maxed player would look War-heavy. With capacity normalisation a fully maxed player is exactly 50/50 Hybrid, and the result does not depend on player level.

### Why 70%
70/30 means one side's fill is at least about 2.3x the other's. It is a reference value, tested only against one hand-transcribed level-22 player (War 78.26%, fixture `tests/fixtures/real/player-skills.json`, maxLevel assumed 10). It should be validated against real War, Eco and Hybrid profiles.

## 4. Data states (not build categories)
A result has `kind = null` and an `availability` when no reliable calculation is possible:
- `incomplete`: fewer than 4 valid combat or 2 valid economy skills (design decision).
- `no_investment`: no levels in combat or economy skills.
No score is fabricated in these cases.

## 5. Group statistics (units, countries, alliances, parties)
Counts use unique player ids: **classified** (war + eco + hybrid), **pending** (profile not loaded yet) and **unavailable** (request failed, or incomplete / no-investment data). `total = classified + pending + unavailable`. Pending and unavailable are never build types. A "partial count" note is shown whenever either is non-zero.

## 6. Performance and limits
At most 24 new profile requests per render (4 in parallel), results cached 10 minutes per server instance (failures 1 minute); the API client's own cache and 40 requests/minute limiter still apply, so large groups fill in over several visits. Country and alliance panels use only the first 100 returned ACTIVE citizens per country, so those counts are a sample, not a full census (not yet addressed in the UI beyond the partial note).
