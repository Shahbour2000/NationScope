# NationScope API Integration Blueprint

**Status: proposed architecture only.** This document does not implement or alter the current client, schemas, domain models, cache, or routes.

## 1. Centralized API client

Keep one environment-bound GET client as the transport boundary. It should own URL construction, safe path/query encoding, timeouts, body limits, JSON decoding, retry policy, response metadata, and structured errors. Feature modules should not call `fetch` directly or reconstruct the API base URL.

The current NationScope client already provides a useful foundation: environment binding, a bounded in-process cache, in-flight request deduplication, response validation hooks, timeout/body checks, and retry handling for transient failures and acceptable `Retry-After` values. Retain these behaviors unless measured evidence justifies a change.

## 2. Typed response schemas

- Define runtime schemas next to each endpoint/domain contract; derive TypeScript types from them.
- Treat OpenAPI descriptions as route/parameter evidence, not detailed response schemas.
- Validate known fields while allowing safe forward-compatible unknown fields at the boundary; do not use unknown fields in calculations until explicitly modeled.
- Model money as its documented integer subunit/string representation until conversion at a single boundary.
- Model nullability, optional fields, enum drift, empty arrays, partial pages, and error responses explicitly.
- Add response fixtures only with request URL, query, capture time, HTTP status, environment, and completeness metadata.

## 3. Entity discovery services and ID resolution

Create shared discovery functions for players, countries, regions, parties, military units, companies, battles, elections/proposals, alliances, market item codes and tournaments. Each function should return canonical IDs with display labels and enough provenance to show how the ID was found.

ID resolution should be explicit: search name → candidate list → user or feature selection → canonical ID → detail fetch. Do not guess fuzzy IDs, persist display names as identifiers, or hard-code IDs from samples. Cache aliases only with a freshness policy and allow a not-found/stale resolution state.

Use typed references (`PlayerRef`, `CountryRef`, etc.) to avoid accidentally using a party ID as a country ID. Keep route-specific validation and URL encoding centralized.

## 4. Pagination and cursors

Represent page state in domain results, e.g. `items`, `nextOffset`/`nextCursor`, `hasMore`, `total`, and the query used. Provide bounded page iteration for workflows that need completeness; default UI/autocomplete flows should request only a small first page. Never label a paginated response complete unless all pages were fetched or the endpoint says it is complete.

Cursor pagination and offset pagination should be distinct types. Deduplication across pages should use stable entity IDs, and the API's sorting/filter parameters should be preserved across page requests.

## 5. Cache and request deduplication

Use endpoint-aware TTLs: stable catalog/reference data can have a longer TTL; market, battle, government and presence data should be fresher. Respect the API's documented 30-second cache window and avoid polling faster than useful. Normalize query ordering before building cache keys. Dedupe concurrent identical requests. Any cross-process cache should be introduced only if deployment topology or upstream request metrics show a need.

Every result should retain `source: live | cache | stale`, `fetchedAt`, `ageMs`, and stale cause. Feature UIs must be able to distinguish current data from stale data for decision-sensitive values.

## 6. Rate limits and retries

Use a shared request budget appropriate to the documented 60 requests/minute/IP limit, accounting for all concurrent NationScope instances where practical. Honor `Retry-After`; do not retry deterministic 4xx validation/not-found responses. Use bounded jittered backoff for network/timeout/selected server errors. When retrying a 429, stop if the indicated delay exceeds the request's time budget. Provide a controlled degraded/stale result where safe rather than launching a retry storm.

Instrument counts by endpoint, response class, cache state, retry and timeout. Avoid logging secrets or unnecessary player payloads.

## 7. Data provenance and freshness

For values that affect a recommendation, preserve provenance through adapters and view models:

```text
value + source endpoint + observedAt/fetchedAt + live/cache/stale + evidence class + transformation
```

Evidence classes should distinguish OpenAPI documented, captured sample, live observed, derived, user supplied, and unverified semantics. Derived values should record the formula/version and inputs. Do not present a value derived from a listing as player-owned state.

## 8. Errors and partial responses

Use a typed result that separates transport error, upstream HTTP error, parse/schema error, not found, rate limit, timeout, and partial data. For composite views, return per-source success/failure and keep valid independent sections visible; do not turn a failed section into an empty list or zero. Record pagination incomplete and stale information in the result. Validate body size and cap page fan-out to prevent large or accidental request bursts.

## 9. Build Optimizer integration boundary

The optimizer should consume a normalized snapshot assembled by shared entity services, not fetch raw endpoints itself. Separate player profile, skill ledger, owned/equipped gear state, market candidates, company scenario, and battle context. Each field should carry provenance and missingness. Do not infer equipped gear from market offers, current work from open job offers, skill points from level until Prestige rules are confirmed, or battle bonuses from the presence of a party/unit ID alone.

Before implementation, reconcile this blueprint with Claude Account 1's eventual NationScope changes and confirm the meaning of live-only player fields with authoritative game/API evidence.
