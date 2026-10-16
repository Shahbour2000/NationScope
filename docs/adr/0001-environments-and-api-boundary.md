# ADR 0001: Environment selection and API boundary

Status: accepted (foundation milestone)

- Environment is chosen by `NATIONSCOPE_API_ENV` (default `main`); origins come from env vars, never from code.
- No fallback between environments. A failure is shown as a failure; a stale copy of the *same* environment may be shown only if flagged as stale.
- All upstream access goes through `src/lib/api` and `src/lib/data`; UI code never calls `fetch`.
- Responses are untrusted. Schemas stay minimal until real responses are captured, then tighten per endpoint.
- No database or scheduler yet; add Supabase only when a metric is shown to need our own snapshots.
