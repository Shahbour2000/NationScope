# Player build classification (War / Eco / Hybrid): investigation and method

**Status: PROVISIONAL.** Implemented in `src/features/builds/classify.ts`, tested in `tests/build-classify.test.ts`. The thresholds and the skill mapping are a proposal, not official Age of Nations rules, and the UI says so.

## 1. What the API exposes (verified)
`GET /players/{id}` returns `skills`: an array of `{ code, level, maxLevel }` with 15 codes: energy, stamina, health, hunger, attack, companies, entrepreneurship, production, criticalChance, criticalDamages, armor, precision, dodge, lootChance, management (stamina reported maxLevel 0 in the sample). It also returns `damage {total, day, week, month}`, `presence`, `unit`, `party`, `rank`, `equipment`, `economy`, `badges`, `history`.
It does **not** return: current health or hunger values, buff/debuff state, a skill-reset cooldown, or any "build" label.

## 2. Is there an official rule?
No. Neither the API reference nor any project document defines which skills are "economic" or "military", nor an Eco/War threshold. The mapping used here is the one supplied in the task; skill names alone do not prove what a skill does, so it stays flagged as unverified.

## 3. Method (deterministic)
- Eligible skill: `maxLevel` finite and > 0, `0 <= level <= maxLevel`; first entry per code wins; everything else is ignored (no division by zero).
- `progress = level / maxLevel * 100`; **War score** = mean over eligible War skills (attack, criticalChance, criticalDamages, armor, precision, dodge, health, lootChance); **Eco score** = mean over eligible Eco skills (production, entrepreneurship, companies, management). Energy, stamina and hunger are shared and are **not scored** (no double counting). Equal weights. Scores rounded to 2 decimals before comparing.
- Order (first match wins, mutually exclusive): **Insufficient data** (fewer than 4 eligible War or 2 eligible Eco skills; this minimum is my addition) -> **War** (war >= 60 and war - eco >= 15) -> **Eco** (eco >= 60 and eco - war >= 15) -> **Hybrid** (both >= 50 and |difference| < 15) -> **Unclassified**.
- Only skills are used: never damage, equipment, badges, jobs, companies or trade volume.
- Organisation counts use unique player ids; ids whose profile is not loaded or failed are reported as "not loaded / unavailable", never as zero or as a build.

## 4. Finding from real data (important)
One real level-22 player (attack 5, critical chance 5, critical damage 4, armor 5, precision 4, dodge 5, health 4, loot chance 4; production 4, entrepreneurship 1, companies 0, management 0; max levels assumed 10 in the fixture) scores **War 45.0 / Eco 12.5**. That is clearly war-leaning, but the proposed absolute floor of 60 makes it **Unclassified**. Skill levels depend on player level, so absolute thresholds will leave most mid-level players unclassified. Options for you to decide: (a) keep the thresholds, (b) lower the floor (e.g. 40) or (c) classify by share of invested levels (war levels / (war + eco levels)) instead of fractions of maximum. All thresholds live in `BUILD_RULES` so changing them is a one-line edit plus test updates.

## 3b. What is still needed to make it reliable
1. Several captured `/players/{id}` responses for players at different levels (a clear eco player, a clear war player, a hybrid) with real `maxLevel` values.
2. The game's own definition of which skills count as economy vs combat, and whether skill points (not levels) have different costs per level.
3. Your decision on threshold style (a, b or c above).

## 5. Performance
Profiles are fetched per member, so counts are bounded: at most 24-30 new profile requests per page render (4 in parallel), results cached 10 minutes per server instance (failures 1 minute), the API client's own 30 s cache and 40 requests/minute limiter still apply. Large groups therefore fill in over several visits and the panel says how many players are classified, pending or unavailable. Country and alliance panels use the first 100 returned ACTIVE citizens per country.
