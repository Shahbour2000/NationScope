# Shared files changed by the Economy Engine (cumulative)

Only two existing files were ever modified (both in Session 2, unchanged in Session 3):

## 1. `src/app/layout.tsx` (+1 line)
- **Why:** sidebar entry. **Change:** after the `/economy` item, `{ href: "/economy/engine", label: n.economyEngine, icon: "chart" },`.
- **Side effects:** one more link in the Economy group. If the other branch edits this list, re-add the line. The existing `/tools/build-optimizer` entry is untouched.

## 2. `src/i18n/messages.ts` (+2 inline additions)
- **Why:** typed nav labels. **Change:** `economyEngine: "Economy Engine"` (EN) and `economyEngine: "محرك الاقتصاد"` (AR) next to `economyOverview`.
- **Side effects:** none at runtime; a conflicting edit on that same line needs a manual merge.

## Session 3
No shared file was modified. `src/app/economy/engine/page.tsx` (new in Session 2) now **imports** `getDisplay` / `itemName` (entities display helpers) to pass localised product names; `ui/parts.tsx` imports `RemoteImage`, `itemIconSrc`, `Icon`. Imports only.
New non-shared files: `scripts/aon-sample.mjs`, `scripts/aon-sample-core.mjs`, `scripts/aon-sample-core.d.mts`, `scripts/economy-engine-browser-check.mjs`, `scripts/economy-engine-mock.mjs` (extended).
