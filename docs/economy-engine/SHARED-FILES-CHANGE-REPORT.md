# Shared files changed by the Economy Engine

Only two existing files were modified. Everything else is new and lives under `src/features/economy-engine/`, `src/app/economy/engine/`, `tests/economy-engine/`, `scripts/economy-engine-mock.mjs`, `tests/fixtures/real/company-detail.json`, `docs/`.

## 1. `src/app/layout.tsx` (+1 line)
- **Why:** the new page needs a sidebar entry.
- **Change:** after the `/economy` item, added `{ href: "/economy/engine", label: n.economyEngine, icon: "chart" },`.
- **Side effects:** one more link in the Economy group. Depends on key (2). If the other branch changes this nav list, re-add the line. The existing `/tools/build-optimizer` entry is untouched.

## 2. `src/i18n/messages.ts` (+2 inline additions)
- **Why:** nav labels live in the typed message catalogue (EN and AR must match).
- **Change:** added `economyEngine: "Economy Engine"` and `economyEngine: "محرك الاقتصاد"` next to `economyOverview` in the English and Arabic nav objects.
- **Side effects:** none at runtime. Merge note: both additions are on the same line as `economyOverview`, so a conflicting edit there will need a manual merge.

## Not touched
`src/lib/domain/player.ts`, `src/features/builds/**`, `src/features/planner/**` (SHA-256 verified identical), the API client/cache/limiter, `src/app/economy/page.tsx`, all i18n except the two keys, all CSS in `globals.css`. The engine reuses `@/lib/api/*` and `@/lib/domain/market-item` by import only. Engine text lives in its own file (`ui/text.ts`) to avoid growing the shared catalogue.
