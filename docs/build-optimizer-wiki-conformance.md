# Build Optimizer - Wiki conformance record

Source hierarchy used for this record: (1) the Age of Nations Wiki files (`01-basics`, `02-economy`, `03-war`, `04-politics`, `05-community`) are authoritative for game mechanics; (2) the project specification and audit documents guide the implementation; (3) the API documentation and recorded responses say which data exists, never how a mechanic works; (4) the source code is the thing being checked; (5) synthetic fixtures are test aids only.

No formula in this project is labelled **Verified**: that label is reserved for in-game observation. **Documented** means the Wiki states it.

## Implemented per the Wiki

| Mechanic | Wiki source | Implementation | Test |
|---|---|---|---|
| Damage pipeline: skill attack + weapon attack, then personal boosts, accuracy, crit, luck, battle bonuses, round down | 03-war §1.6 | `engine/combat.ts` `computeHit` | `wiki: hit pipeline` |
| Ammo, stimulant (Pill) and rank bonuses are **summed** and applied to (skill + weapon) attack | 03-war §1.6 step 2; 01-basics §3.5-3.6 | `computeHit` (`personalMultiplier`) | `wiki: personal boosts are summed` |
| Round down, minimum damage 1; the per-hit score is the weighted sum of rounded outcomes | 03-war §1.6 step 7 | `computeHit` (`expected`; `expectedUnrounded` is diagnostic only) | `wiki: rounding and minimum damage` |
| Luck: +-10 % **range** | 03-war §1.6 step 5 | `minPerHit` / `maxPerHit` | `wiki: luck range only` |
| Accuracy = clean-hit chance, graze 50 %, crit only on clean hits, crit adds the crit-damage percentage | 03-war §1.6 steps 3-4; 01-basics §2.4 | `computeHit` | `wiki: hit pipeline`, `wiki: critical damage adds a percentage` |
| Accuracy / crit chance cap 100; excess = +3 Attack / +3 Critical Damage per point | 01-basics §2.4 | `computeHit` | `wiki: accuracy and crit chance stop at 100...` |
| Firearm without ammo adds nothing and does not wear; knife needs none | 01-basics §3.5 | `computeHit`, `adapter/equipment-snapshot.ts` (`AMMO_EXEMPT_ITEM_CODES`) | `wiki: a firearm without ammunition...` |
| Battle bonuses capped at +100 %, penalties at -50 % | 03-war §1.7 | `battleModifierPct` | `wiki: battle bonus caps` |
| Rank bonus by lifetime damage; the API percentage may not redefine it | 01-basics §2.6 | `adapter/player-state.ts` | `rank thresholds...`, `wiki: an API rank bonus that disagrees...` |
| Skill costs, endpoints, unlock levels, reset cost | 01-basics §2.4-2.5 | `engine/skills.ts` | existing `review.test.ts` |
| Ammo %, food %, rarity ranges, crate odds, recipes | 01-basics §2.3, §3.3-3.5, §4.4; 02-economy §1.2 | engine constants | `ammunition and food`, `rarity stat ranges`, `Field Crate odds and recipes` |
| Durability: 100 at start, 1 per hit, dodge protects armor, broken at 0 | 01-basics §3.4 | `engine/loadout.ts`, `engine/sustainable.ts`; profile durability seeds Fixed Gear in `run.ts` | `profile durability reaches the Sustainable model...` |
| Weapons without ammo never dominated away (Pareto pruning) | 01-basics §3.5 | `adapter/market.ts` | `pareto-ammo.test.ts` |

## Wiki is silent or ambiguous - kept explicitly unresolved

| Item | What the Wiki says | What the engine does |
|---|---|---|
| Luck distribution | only the +-10 % range | no distribution assumed; the central figure uses luck 1.0 and says so (`combat.luck.distribution`, Unverified) |
| Where excess accuracy enters the pipeline | "becomes Attack" | counted as Attack in step 1 (`combat.overflow.order`, Unverified, flagged only when overflow occurs) |
| Earned points after Prestige | +4 per Prestige, points returned, level drops | API Prestige is displayed, never folded into the total; the ledger is a lower bound unless the user supplies a total (`skills.pointsEarned.prestigeInteraction`, Unverified) |
| Skill values between level 0 and 10 | only the two endpoints | linear interpolation, labelled Estimated |
| Armor / dodge point -> percentage | "armor reduces by the protection percentage", thresholds 45 / 36 | 1 point = 1 %, labelled Estimated (`combat.sustain`) |
| Health reserve before a hit | "hits you could afford are counted" | engine reserve of 10 health, labelled as an engine assumption |
| Meaning of the profile `equipment` array | not a Wiki matter (API data) | treated as a possibly partial snapshot; missing slots are unknown, never empty |

## Corrections made against the Wiki in this phase

1. The Pill was modelled as an Attack-skill-only modifier outside the personal-boost sum. The Wiki lists the stimulant among the summed personal boosts, so it now enters the sum. An earlier owner description of the old model is recorded in `combat.booster`; there is no switch back.
2. Scoring used unrounded damage. It now uses the Wiki's round-down / minimum-1 outcomes.
3. The critical multiplier was labelled Unverified. The Wiki ("extra damage", "adds the critical damage percentage") documents `1 + critDamage/100`.
4. A cheaper, stronger firearm no longer removes an ammo-free weapon from the candidates.
5. An API rank percentage that disagrees with the Wiki rank table no longer wins; a warning is shown and the user may override.
