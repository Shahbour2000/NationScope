# Economy Engine: implementation report (Session 3)

## Delivered this session
- **Repository reconciliation** (roadmap section 0): uploaded ZIP identical to the Session 2 delivery; no `.git`, so no branch/SHA; protected hashes unchanged.
- **Test-count correction:** baseline 399; Session 2 added 78 (not 101); this delivery adds 42 more = 120 new, **519 total (512 pass, 7 skipped)**.
- **Opportunity detector** (`domain/opportunities.ts`): ranks every recipe by gold earnable from visible demand at the going wage (value per point minus median allowed wage, times PP the best bid can absorb, capped by your capacity); signals for thin/no buyers, wide spread, no recent trades, wage above value, inferred recipe; start cost and affordability from capital.
- **Recommendations** (`domain/recommendations.ts`): offer wage, not profitable, switch product, automation payback, storage binding, unsold units, capital shortfall, no capacity.
- **Market analysis:** all-items activity from one `/market/trades` request; per-item history parsed (unverified) and charted with trades as fallback; VWAP, units/day, trend, volatility, supply state kept (supply thresholds labelled as rules of thumb).
- **Company/capital:** production tax now read from the player's country; capacity from the player's own skills (workers x shifts x PP); capital-limited PP; profit-by-wage curve.
- **Live sampling script** + tests with a fake fetch (429/timeouts/404 semantics, discovery, anonymisation) + skipped-until-captured parsing tests.
- **UI/UX redesign** (see `UX-REPORT.md`).
- **Agents:** re-investigated repo, API reference, fixtures, wiki: still no base output per hour and no endpoint. Stays gated; nothing invented.

## Assumptions reviewed (none upgraded without evidence)
| Assumption | Status | Reason |
|---|---|---|
| PP scale x10,000 | Inferred | capacity 4,000,000 vs storage level 2 = 400 PP; no contradicting data |
| Skill effect linear between 0 and 10 | Inferred | wiki gives endpoints only |
| Engine PP bonus-free | Assumed | no evidence either way |
| Employer pays gross wage | Assumed | API shows gross, tax, net only |
| Worker loyalty | Not included | worker-specific, not in company data |
| Selling behaviour | Instant = visible best bid only; patient = best ask capped by an assumed market share | labelled in the UI |

## Verification (final tree)
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm test` | 58 files, 519 tests: 512 passed, 0 failed, 7 skipped (live fixtures) |
| `npm run build` | succeeds |
| Browser | 19 checks x 3 viewports pass (UX-REPORT.md) |
| Protected hashes | 14/14 identical |
| ZIP reproduction | applied to the original clean baseline and to the uploaded ZIP: both reproduce the tested tree (see delivery note) |

## Not done / limits
Live verification (blocked, see `LIVE-API-VERIFICATION-REPORT.md`); history-based statistics (shape unverified); deep order books per item for the opportunity ranking (only the best bid level is visible for all items); competitor company bonuses; agents UI. Product icons from the game CDN not visually verified.

## Integration
Unzip over the repository root (paths are repository-relative; it also works on a tree that already has the Session 2 engine). No files deleted. Then `npm ci && npx tsc --noEmit && npm run lint && npm test && npm run build`. Run the sampler per `LIVE-SAMPLING.md`.
