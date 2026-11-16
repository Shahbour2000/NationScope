# Integration guide: Phase 1 cumulative package

This ZIP contains **every change of Phase 1 (sessions 1 to 3) relative to the project you uploaded** (`NationScope-main (2).zip`). It is one package: do not apply any earlier session on its own.

Contents: 70 new files, 17 modified files, 1 file to delete. All files sit at their original repository paths. Nothing outside `src/`, `tests/`, `docs/` and `scripts/` is touched. `package.json` and the lockfile are unchanged: **no new dependencies, no `npm install` needed.**

## 1. Before you start
1. Commit or stash your current work, then create a branch, for example `git switch -c phase1-website-polish`.
2. If you changed any of the 17 modified files locally since the baseline, read section 4 first.

## 2. Apply
1. Extract the ZIP into the project root, overwriting existing files. (It will ask to overwrite the 17 modified files; answer yes.)
2. Delete the one file listed in `docs/phase1/DELETED-FILES.txt`:
   `src/app/contracts/contracts.module.css` (its content moved to `src/features/wars/contracts.module.css`).
3. Optional, not done by this package: four dead copies of the stylesheet exist and are imported by nothing (`src/app/companies/globals.css`, `src/app/diagnostics/globals.css`, `src/app/economy/globals.css`, `src/app/search/globals.css`). The only rule from them that the site still needed was moved into `src/styles/polish.css`. You may delete them; the site does not use them.

## 3. Verify
Run these from the project root. Expected results are what the package was verified with:
```
npx tsc --noEmit         # no output
npx eslint .             # no errors
npx vitest run           # 63 test files, 596 tests passed
npm run build            # compiles successfully
```
Confirm the Build Optimizer is untouched. This must print nothing:
```
git diff --stat -- src/features/build-optimizer src/app/api/build-optimizer src/app/tools/build-optimizer \
  tests/build-optimizer src/lib/domain/player.ts src/lib/data/build-import.ts docs/build-optimizer-audit.md \
  docs/build-optimizer-wiki-conformance.md API/BUILD_OPTIMIZER_AUDIT.md
```
Optional smoke test of every page type in both languages (dev or production server running, with the mock API or the real API):
```
node scripts/smoke-crawl.mjs http://localhost:3000
```

## 4. If you changed files locally
The 17 modified files and the size of each change are listed in `docs/phase1/FINAL-REPORT.md`. Every change is small and almost entirely additive (`src/i18n/messages.ts` is +266 lines and no removed lines). The complete diff against the baseline is `docs/phase1/cumulative.patch`:
```
git apply --check docs/phase1/cumulative.patch    # dry run
git apply --3way docs/phase1/cumulative.patch     # apply with 3-way merge
```
(Use the patch instead of extracting the ZIP if you prefer to merge.)

## 5. After integration: the first live check (recommended)
The sandbox could not reach the live API, so several response shapes were read from conventions and are listed in the final report. To confirm them in one step, deploy with `NATIONSCOPE_DIAGNOSTICS=true` and open `/diagnostics?ids=1` (it finds an id for every entity type by itself and requests each detail endpoint; pages of 14, wait about a minute between pages). Any endpoint that answers in a shape the pages do not recognise is shown there, and the page itself falls back to displaying the response as returned.
