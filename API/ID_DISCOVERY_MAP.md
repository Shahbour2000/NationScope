# ID Discovery Map

This map distinguishes paths documented by OpenAPI from relationships inferred from response IDs. A path's existence does not guarantee a nonempty result. IDs should be discovered from current list/search responses and passed through URL encoding and validation; do not hard-code sample IDs as permanent identifiers.

## Discovery flows

```text
GET /api/v1/search?q=<text>
  ├─ players[].id ─ GET /players/by-name/{username} or /players/{userId}
  │                  ├─ GET /players/{userId}/stats
  │                  └─ GET /players/{userId}/companies ─ companies[].id ─ GET /companies/{companyId}
  ├─ countries[].id ─ GET /countries/{countryId}
  │                    ├─ /parties ─ parties[].id ─ GET /parties/{partyId}
  │                    ├─ /units ─ units[].id ─ GET /units/{muId}
  │                    ├─ /elections ─ election IDs ─ GET /elections/{electionId}
  │                    ├─ /laws ─ proposal IDs ─ GET /laws/{proposalId}
  │                    ├─ /battles ─ battle IDs ─ GET /battles/{battleId}
  │                    └─ country/company/history/bank/summaries
  ├─ regions[].id ─ GET /regions/{regionId}
  │                  └─ /companies ─ company IDs ─ GET /companies/{companyId}
  ├─ units[].id ─ GET /units/{muId}
  ├─ parties[].id ─ GET /parties/{partyId}
  └─ alliances[].id ─ GET /alliances/{allianceId} ─ /laws

GET /countries ─ country IDs ─ country-scoped lists and details
GET /regions ─ region IDs ─ region details / companies / campaign
GET /alliances ─ alliance IDs ─ alliance detail / laws
GET /battles ─ battle IDs ─ battle detail / contracts
GET /wars ─ war IDs (no war-detail path in this OpenAPI version)
GET /market ─ itemCode ─ orders / history / trades
GET /equipment ─ offerId, itemId, sellerId (market offers, not ownership)
GET /tournaments ─ edition IDs ─ tournament detail
```

## Entity relationship notes

| From | Discovery / relation | Confidence |
|---|---|---|
| Player username → Player ID | `/search?q=...` or `/players/by-name/{username}` | OpenAPI documented; live observed for search and by-name. Names may be ambiguous; use returned ID. |
| Player ID → profile and stats | `/players/{userId}` and `/players/{userId}/stats` | OpenAPI documented; live observed. |
| Player ID → owned companies | `/players/{userId}/companies` | OpenAPI documented and live observed; empty results are valid. |
| Country ID → parties → Party ID → Party details | Country parties list, then `/parties/{partyId}` | Captured sample and live observed follow-up. |
| Country ID → units → Unit ID → Unit details | Country units list, then `/units/{muId}` | Captured sample and live observed follow-up. |
| Country ID → regions | Country details/list fields reference regions; `/regions` is also a discovery path | Captured and live observed; exact completeness depends on list/page response. |
| Region ID → companies → Company ID → Company details | Regional companies list, then `/companies/{companyId}` | Captured sample and live observed follow-up. |
| Country ID → elections → Election ID | Country elections, then `/elections/{electionId}` | Captured sample; follow-up not live-tested. |
| Country ID → law proposals → Proposal ID | Country laws, then `/laws/{proposalId}` | Captured sample; follow-up not live-tested. The `/laws` catalogue is a separate concept. |
| Country ID → battles → Battle ID → details/contracts | Country battles or global battles, then battle detail | Captured sample and live observed for global list/detail. |
| Battle → Region, countries, military units, war | IDs in battle detail | Captured and live observed fields; semantic links are inferred from identifiers and names. |
| Country / region → company location | Company fields contain `countryId` and `regionId` | Captured and live observed. This does not establish ownership by a player. |
| Market → itemCode → item order/history/trades | Market list gives product codes used in item routes | Captured and live observed for market list; child routes not live-tested. |
| Equipment offer → itemId/sellerId | `/equipment` offer record | Live observed. It represents a listing; it is not proof of owned/equipped gear. |
| Alliance ID → alliance details/laws | `/alliances` list then detail/laws | Captured sample; live follow-up not tested. |

## Resolution policy for future integrations

1. Resolve names through search, then store/use the returned canonical ID for subsequent requests.
2. Treat list pagination (`limit`, `offset`, cursors, `hasMore`, `nextOffset`) as part of discovery; do not assume the first page is exhaustive.
3. Keep the source query, entity ID, capture time, and endpoint together in logs/fixtures.
4. Handle missing, deleted, or inaccessible entities as normal results, not as proof that the ID format is invalid.
5. Do not infer ownership, equipment state, employment, or gameplay eligibility merely from a cross-reference ID.
