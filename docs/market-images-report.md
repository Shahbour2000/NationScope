# Market / Economy item images — technical report

Status date: 2026-11-10 (updated; first version 2026-11-08). Scope: item icons shown on Market, Economy, Companies, Jobs and Equipment pages.

## 1. Summary (read this first)

**No HTTP status for any item image has been observed.** The environment this report was prepared in cannot reach `ageofnations.world`, so every statement about whether an image loads is **unverified**. What *is* verified comes from NationScope's source code and the real captured API responses (`tests/fixtures/real`).

Verified (code / fixtures):

1. NationScope builds every item icon URL the same way: `https://ageofnations.world/items/<itemCode>.webp` (`ITEM_ICON_BASE` in `src/lib/config/environments.ts`, `itemIconSrc()` in `src/lib/media.ts`). `<itemCode>` is copied verbatim from the API field `itemCode`; nothing is lower-cased, renamed or mapped.
2. The API responses carry **no image field** for items (no `iconUrl`/`imageUrl`/`icon`), and `GET /game` has no asset manifest either. So the URL pattern is an assumption, not something the API states.
3. The repository's own audit (`docs/data-audit.md`) says the pattern was observed on the game's public site for only **12 codes**: bread, case2, concrete, grain, jet, oil, rifle, sniper, steel, tank. All 12 are lowercase words, optionally followed by a digit. **None of the 6 camelCase codes has ever been verified.**
4. No NationScope-side blocker was found: no Content-Security-Policy / `img-src` restriction (`next.config.ts` only sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`), codes pass the `^[A-Za-z0-9_-]{1,40}$` check, and a failed image already degrades to a generic icon (`RemoteImage`) instead of a broken image.
5. The `<img>` is requested with `referrerPolicy="no-referrer"` and no `crossorigin` attribute, so CORS does not apply; hotlink protection that *requires* a Referer would, however, reject such requests (hypothesis H4).

Unverified hypotheses (ranked by how well they fit "some images load, some do not"):

| # | Hypothesis | Why it is plausible | Belongs to | How to confirm |
|---|---|---|---|---|
| H1 | Assets for camelCase codes are stored under a different name (e.g. `cookedfish.webp`, `cooked-fish.webp`) or the path is case-sensitive | All 12 verified codes are lowercase; all 6 camelCase codes are unverified | Game/API developer (or NationScope once the real naming is known) | Run `scripts/check-item-icons.mjs` and compare the failing codes with the table below |
| H2 | Equipment icons are keyed differently from the equipment `itemCode` | Verified equipment codes are only `helmet4` and `chest4`; the fixture has `helmet1-3`, `chest1-3`, `gloves2-3`, `boots2-3`, `pants2-3`, `gun`. Weapons `rifle`/`sniper` are verified but `gun` is not | Game/API developer | Same script |
| H3 | Some assets do not exist on the host (items added to the API before their artwork) | Typical for newer items | Game developer | HTTP 404 on the exact URL |
| H4 | The host rejects requests without a Referer (hotlink protection) | NationScope sends `no-referrer` | NationScope (switch the image referrer policy) or the host (allow cross-origin embedding) | If a failing URL loads when opened directly in a browser but not inside NationScope, this is the cause |
| H5 | The host answers 200 with an HTML page for unknown paths (SPA fallback), which an image tag cannot decode | Common for SPA hosting | Game developer | The script flags 200 responses whose Content-Type is not an image |

## 1b. Verification attempt on 2026-11-10 (what was and was not established)

| Check | Result | Meaning |
|---|---|---|
| DNS / HTTP to `https://ageofnations.world/items/tank.webp` and `https://app.ageofnations.world/api/v1/game` | `curl: (6) Could not resolve host` for both | The environment has no route to the game's hosts. **No HTTP status for any image or live API response was obtained.** |
| `node scripts/check-item-icons.mjs` over all 45 item codes found in the real API responses | 45 network errors (`ENOTFOUND`), 0 HTTP responses | Says **nothing** about whether the images exist. The script now reports network errors separately from HTTP failures so this cannot be misread as "45 missing images". |
| Same script against a local stand-in server (3 codes served, 1 returns HTML with 200, rest 404) | 3 OK, 42 HTTP failures; the 200/`text/html` response is flagged as non-image | Confirms the script's classification logic only. It is not evidence about the game. |
| Scan of all 44 real API samples in `API/samples` for image-like fields (icon, image, asset, sprite, thumb, picture, logo, avatar, media) | Only `avatarUrl` (players) and `logoUrl` (parties/countries) exist; **no item sample has any image field** | Verified, not assumed: the API gives NationScope no item image reference, so the `/items/<code>.webp` pattern remains an assumption. |
| Official OpenAPI reference | No asset manifest, no item catalogue, no image description | Same conclusion. |

Still unknown (needs a machine that can reach the host, or the game developer): which of the 45 codes return a real image, which return 404, and whether any return an HTML fallback. Nothing in the app guesses alternative file names.

## 2. What the developer / maintainer should run

From any machine with internet access:

```
node scripts/check-item-icons.mjs                         # Markdown table: code, URL, HTTP status, Content-Type
node scripts/check-item-icons.mjs --codes newItem,other   # add codes that are not in the fixtures
```

Forward the resulting table together with sections 3 and 4. For H4, also open one failing URL directly in a browser tab and say whether it loads there.

Information still needed from whoever reported the problem: **which specific items show no image**, on which page, and a screenshot or the browser Network tab entry (status of the failing `.webp` request). Without that we cannot say which hypothesis applies.

## 3. Categories

| Category | Codes | Requested URL | Verified status | Most likely cause (unverified) | Fix belongs to | Recommended action |
|---|---|---|---|---|---|---|
| camelCase codes | coffeeBeans, cookedFish, fuelCell, heavyAmmo, lightAmmo, woodenCase | `/items/<code>.webp` (code unchanged) | not observed | H1 or H3 | Undetermined | Run the script. If these fail while lowercase codes load, publish the real file names, or an icon field per item (section 4) |
| Numbered equipment | boots2, boots3, chest1, chest2, chest3, gloves2, gloves3, helmet1, helmet2, helmet3, pants2, pants3 | `/items/<code>.webp` | not observed | H2 / H3 | Game/API developer | Say whether equipment art is per itemCode, per slot+tier or per rarity, and expose it |
| Weapon `gun` | gun | `/items/gun.webp` | not observed | H2 | Game/API developer | Confirm the asset name for `gun` |
| Other lowercase codes not yet verified | ammo, coca, cocain, espresso, fish, iron, lead, limestone, livestock, paper, petroleum, scraps, steak, uranium, wood | `/items/<code>.webp` | not observed | H3 / H4 | Undetermined | Run the script |
| Observed once on the public site | bread, case2, concrete, grain, jet, oil, rifle, sniper, steel, tank (only some appear in the API fixtures) | `/items/<code>.webp` | seen on the public site per docs/data-audit.md, not re-checked | n/a | n/a | Use as the control group when running the script |

## 4. Recommended API change (cleanest fix, independent of the cause)

Add an explicit, stable image reference to item data so clients never guess file names, for example `iconUrl: "/media/items/cooked-fish.webp"` on each row of `GET /market`, on equipment offers, and in a catalogue endpoint. NationScope already accepts `/media/...` paths on the API origin (`mediaSrc`) and would use the field immediately.

## 5. What NationScope will not do

It will not try alternative spellings (lower-casing, kebab-case, suffixes) at runtime. That would be guessing identifiers, would multiply failing requests, and could show the wrong picture.

## Appendix — every item code seen in the real API responses (45)

| Item code | URL NationScope requests | Name style | Seen on public site (docs) | Has bundled display name | Seen in |
|---|---|---|---|---|---|
| ammo | https://ageofnations.world/items/ammo.webp | lowercase | no | yes | company-stats,jobs,market |
| boots2 | https://ageofnations.world/items/boots2.webp | has digit | no | no | equipment-offers |
| boots3 | https://ageofnations.world/items/boots3.webp | has digit | no | no | equipment-offers |
| bread | https://ageofnations.world/items/bread.webp | lowercase | yes | yes | company-stats,jobs,market |
| case1 | https://ageofnations.world/items/case1.webp | has digit | no | yes | market |
| case2 | https://ageofnations.world/items/case2.webp | has digit | yes | yes | market |
| chest1 | https://ageofnations.world/items/chest1.webp | has digit | no | no | equipment-offers |
| chest2 | https://ageofnations.world/items/chest2.webp | has digit | no | no | equipment-offers |
| chest3 | https://ageofnations.world/items/chest3.webp | has digit | no | no | equipment-offers |
| coca | https://ageofnations.world/items/coca.webp | lowercase | no | yes | companies,company-stats,market |
| cocain | https://ageofnations.world/items/cocain.webp | lowercase | no | yes | company-stats,jobs,market |
| coffeeBeans | https://ageofnations.world/items/coffeeBeans.webp | camelCase | no | yes | company-stats,market |
| concrete | https://ageofnations.world/items/concrete.webp | lowercase | yes | yes | companies,company-stats,jobs,market |
| cookedFish | https://ageofnations.world/items/cookedFish.webp | camelCase | no | yes | company-stats,market |
| espresso | https://ageofnations.world/items/espresso.webp | lowercase | no | yes | company-stats,market |
| fish | https://ageofnations.world/items/fish.webp | lowercase | no | yes | company-stats,market |
| fuelCell | https://ageofnations.world/items/fuelCell.webp | camelCase | no | yes | market |
| gloves2 | https://ageofnations.world/items/gloves2.webp | has digit | no | no | equipment-offers |
| gloves3 | https://ageofnations.world/items/gloves3.webp | has digit | no | no | equipment-offers |
| grain | https://ageofnations.world/items/grain.webp | lowercase | yes | yes | company-stats,jobs,market |
| gun | https://ageofnations.world/items/gun.webp | lowercase | no | yes | equipment-offers |
| heavyAmmo | https://ageofnations.world/items/heavyAmmo.webp | camelCase | no | yes | companies,company-stats,market |
| helmet1 | https://ageofnations.world/items/helmet1.webp | has digit | no | no | equipment-offers |
| helmet2 | https://ageofnations.world/items/helmet2.webp | has digit | no | no | equipment-offers |
| helmet3 | https://ageofnations.world/items/helmet3.webp | has digit | no | no | equipment-offers |
| iron | https://ageofnations.world/items/iron.webp | lowercase | no | yes | companies,company-stats,jobs,market |
| jet | https://ageofnations.world/items/jet.webp | lowercase | yes | yes | companies,company-stats,jobs |
| lead | https://ageofnations.world/items/lead.webp | lowercase | no | yes | companies,company-stats,jobs,market |
| lightAmmo | https://ageofnations.world/items/lightAmmo.webp | camelCase | no | yes | companies,company-stats,jobs,market |
| limestone | https://ageofnations.world/items/limestone.webp | lowercase | no | yes | companies,company-stats,jobs,market |
| livestock | https://ageofnations.world/items/livestock.webp | lowercase | no | yes | company-stats,jobs,market |
| oil | https://ageofnations.world/items/oil.webp | lowercase | yes | yes | company-stats,market |
| pants2 | https://ageofnations.world/items/pants2.webp | has digit | no | no | equipment-offers |
| pants3 | https://ageofnations.world/items/pants3.webp | has digit | no | no | equipment-offers |
| paper | https://ageofnations.world/items/paper.webp | lowercase | no | yes | company-stats,market |
| petroleum | https://ageofnations.world/items/petroleum.webp | lowercase | no | yes | companies,company-stats,jobs,market |
| rifle | https://ageofnations.world/items/rifle.webp | lowercase | yes | yes | company-stats |
| scraps | https://ageofnations.world/items/scraps.webp | lowercase | no | yes | market |
| sniper | https://ageofnations.world/items/sniper.webp | lowercase | yes | yes | company-stats |
| steak | https://ageofnations.world/items/steak.webp | lowercase | no | yes | company-stats,market |
| steel | https://ageofnations.world/items/steel.webp | lowercase | yes | yes | companies,company-stats,jobs,market |
| tank | https://ageofnations.world/items/tank.webp | lowercase | yes | yes | company-stats |
| uranium | https://ageofnations.world/items/uranium.webp | lowercase | no | yes | market |
| wood | https://ageofnations.world/items/wood.webp | lowercase | no | yes | companies,company-stats,market |
| woodenCase | https://ageofnations.world/items/woodenCase.webp | camelCase | no | yes | market |
