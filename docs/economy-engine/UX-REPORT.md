# UI/UX changes report

**Goal:** a user opens the page and immediately sees what to produce, whether their companies make money, what wage to offer, and what an upgrade is worth, without reading formulas.

## Before -> after
| Before (Session 2) | After |
|---|---|
| One long page: data-quality block, ranking table, controls grid with 10+ inputs, full scenario table, long caveats | Two tabs: **Best products** and **My companies**; details collapsed |
| Technical wording ("net of market tax", "binding", "VWAP") in headings | Short labels ("Safe / Balanced / Attractive", "profit/day", "Pays back in 83 days") |
| Raw table of numbers per scenario | Three selectable **wage cards** (wage per point, profit/day, bar), one "Per day at this wage" panel with reasons |
| No visuals | Product icons (game item icon with a generic fallback, never a broken image), value meters, **profit-by-wage chart** with the three choices marked, **price sparkline**, green/red profit dots on company cards |
| Many warnings and paragraphs | One **recommendation banner** set (max 4) in plain language, coloured good/info/warn/bad |
| Evidence chips everywhere | One small "Data: Live" chip (details on tap) plus chips only where they matter (Inferred recipe, skill assumed) |

## Layout
1. **Best products:** filters (All / Raw / Made / Hide thin markets / I can afford), capital box, top 6 cards (rank, icon, value per point, meter, buyers and potential earnings, warning chips with tooltips), then "All products" table in an expandable section.
2. **My companies:** company cards (status dot, item, +/- profit per day) -> detail: banners, wage cards, "What if..." (workers, price change, try a wage; everything else under "More options"), profit-by-wage chart, market card (sparkline, average price, units/day, supply, trend, swings), upgrade cards, and "Details and assumptions" (stored PP, bonus, skill, full comparison table, what is not certain).
3. Colours: green = profit/gain, red = loss/not viable, amber = warnings and inferred values, neutral = information. Never colour alone: every state also has text.

## Responsive / RTL
Cards use `auto-fill` grids; tables scroll inside their own container; logical CSS properties give correct Arabic RTL; tap targets >= 32 px (checked); charts have `aria-label`s; tabs use `role=tab` / `aria-selected`; pills use `aria-pressed`.

## Browser verification (scripted: `scripts/economy-engine-browser-check.mjs`, Chromium)
English desktop 1280, English tablet 768, Arabic phone 390 (RTL). 19 checks each, all passed: direction, no JS/console errors, no horizontal overflow on both tabs, wage cards switch the detail panel, price slider / workers slider change results, custom wage result appears, sell-mode select, details expand, charts labelled, opportunity cards, Raw/Made filters change the list, hide-thin keeps results, product table, no broken images, no text under 11 px, tap targets.
**Limits:** the run uses repository fixtures plus a synthetic mock for by-name/orders/history (the game host is unreachable from the build sandbox); item icons could not load from the game CDN there, so the generic fallback icon is what was seen: real icons were **not** visually verified.
