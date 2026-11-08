# Age of Nations API Reference Archive

This directory is the repository-local documentation and sample archive for the public Age of Nations API. It is a **read-only research artifact**. It does not change NationScope's runtime API client or any game data.

## Evidence labels

- **OpenAPI documented** — a path, method, parameter, or high-level response description appears in the supplied OpenAPI 3.0.3 reference. The reference has no component schemas and most successful responses are generic objects; this label does not prove every field or live availability.
- **Captured sample** — a response body was present in the supplied `API` folder. The original files did not record request URLs, query strings, HTTP status, or capture metadata. Route associations in the docs are therefore inferred from names and body shape unless independently verified.
- **Live observed** — the field or response shape was observed in a successful HTTP response on 2026-11-07. This is a dated sample, not a permanent API contract.
- **Inferred relationship** — an ID reference or data shape suggests a relationship. Follow-up requests validated only where explicitly stated.
- **Unverified semantics** — a field exists, but its exact game meaning or lifecycle has not been established.

## Sources and preservation

The source sample directory was `D:\Abdallah\Games\Age Of Nations\API`, outside the NationScope repository. Its 55 `.txt` files were copied into this repository without changing the originals. Files retain their source names. Captures are grouped under `samples/`; the OpenAPI text duplicate is in `references/`; empty placeholders and an exact duplicate capture are preserved under `archive/`.

The canonical OpenAPI JSON remains at [`../../../Wiki/AgeOfNations_API_Reference.json`](../../../Wiki/AgeOfNations_API_Reference.json). `references/AgeOfNations_API_Reference.txt` is byte-identical to that JSON (SHA-256 `62183CAE4247EE807BD3158E37DD233D347A1295ED06CF4DA90F69369B02EC33`). `archive/duplicate-captures/Active battles.txt` is byte-identical to `samples/battles/All battles.txt` (SHA-256 `6DC51E322040254F54707F0F0A6CBBB60A435FB82D303EF0870E59A385A8F899`). Neither was deleted. Nine zero-byte placeholder files are preserved with their original names.

## Layout

- `samples/` — supplied response bodies grouped by entity. Grouping is organizational, not proof of the original request URL.
- `references/` — supplied OpenAPI text copy. The Wiki JSON is canonical.
- `archive/duplicate-captures/` — exact duplicate capture, retained for provenance.
- `archive/empty-placeholders/` — nine empty source files, retained for provenance.
- `ENDPOINT_COVERAGE.md` — all 65 GET operations in the supplied OpenAPI reference and sample/live status.
- `ID_DISCOVERY_MAP.md` — entity discovery paths and ID relationships.
- `RESPONSE_SCHEMAS.md` — fields visible in saved and live examples, with evidence limits.
- `LIVE_VERIFICATION.md` — dated request log and observed results.
- `INTEGRATION_BLUEPRINT.md` — proposed shared API architecture; documentation only.
- `PLAYER_DATA_AUDIT.md` — live player response compared with NationScope parsing and Build Optimizer inputs.

## Important limitations

The captured bodies lack their exact request URL and may be pages or partial responses. A file name is not endpoint provenance. Live observations are limited samples. Do not treat market equipment offers as owned or equipped player gear. Do not infer undocumented game mechanics from IDs or field names alone.
