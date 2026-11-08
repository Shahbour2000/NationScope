# Endpoint Coverage

Coverage is based on the supplied OpenAPI JSON and the copied `.txt` bodies. “Sample” means a likely matching body exists, based on filename and content; the source files do not preserve request URLs. “Live” means a successful response was inspected on 2026-11-07. All operations below are GET in the supplied reference.

| Endpoint | Parameters / IDs | Captured sample | Live observed | Notes |
|---|---|---:|---:|---|
| `/api/v1/game` | None | Yes | Timeout | OpenAPI describes rules and server time; request timed out in this audit. |
| `/api/v1/search` | `q` required | Yes | Yes | Search response exposed player, country, region and unit IDs in tested query. |
| `/api/v1/countries` | None | Yes | Yes | Country IDs discovered. |
| `/api/v1/countries/{countryId}` | Country ID | Yes | Yes | Tested with an ID obtained from `/countries` and `/search`. |
| `/api/v1/countries/{countryId}/citizens` | Country ID; search/page optional | Yes | No | Sample has pagination metadata. |
| `/api/v1/countries/{countryId}/government` | Country ID | Yes | No | Government and congress summary. |
| `/api/v1/countries/{countryId}/government/members` | Country ID | Yes | No | Current office holders. |
| `/api/v1/countries/{countryId}/summary` | Country ID | Yes | No | Composite country response. |
| `/api/v1/countries/{countryId}/announcements` | Country ID | Yes | No | Route association inferred from the announcement body. |
| `/api/v1/countries/{countryId}/embassies` | Country ID | Yes | No | Country embassy relations. |
| `/api/v1/countries/{countryId}/wars` | Country ID; status optional | Yes | No | Country war list. |
| `/api/v1/countries/{countryId}/battles` | Country ID; status/limit optional | Yes | No | Country battle list. |
| `/api/v1/countries/{countryId}/units` | Country ID | Yes | Yes | Unit IDs were followed to unit detail successfully. |
| `/api/v1/countries/{countryId}/history` | Country ID; type/cursor optional | Yes | No | Cursor indicates a potentially partial page. |
| `/api/v1/countries/{countryId}/government/history` | Country ID; limit optional | Yes | No | Sample contains a bounded history list. |
| `/api/v1/countries/{countryId}/elections` | Country ID | Yes | No | Election IDs lead to election details. |
| `/api/v1/countries/{countryId}/parties` | Country ID | Yes | Yes | Party IDs were followed to party detail successfully. |
| `/api/v1/countries/{countryId}/laws` | Country ID; filter/page optional | Yes | No | Proposals/laws in a country context. |
| `/api/v1/countries/{countryId}/bank` | Country ID | Yes | No | Country currency, reserves, taxes and fees. |
| `/api/v1/countries/{countryId}/revolution` | Country ID | Yes | No | Revolution state and rules. |
| `/api/v1/elections/{electionId}` | Election ID | Yes | No | Two saved examples: presidential and congress. |
| `/api/v1/parties/{partyId}` | Party ID | Yes | Yes | ID discovered from country parties list. |
| `/api/v1/laws/{proposalId}` | Proposal ID | Yes | No | Proposal details, not the law catalogue. |
| `/api/v1/alliances` | `includeDisbanded` optional | Yes | No | Saved list. |
| `/api/v1/alliances/{allianceId}` | Alliance ID | Yes | No | Alliance detail. |
| `/api/v1/alliances/{allianceId}/laws` | Alliance ID; filter/page optional | Yes | No | Alliance proposals/laws. |
| `/api/v1/laws` | None | Yes | No | Law catalogue and rule metadata. |
| `/api/v1/regions` | None | Yes | Yes | Region IDs available for follow-up. |
| `/api/v1/regions/{regionId}` | Region ID | Yes | Yes | Tested with a region ID from the country/region data. |
| `/api/v1/regions/{regionId}/companies` | Region ID | Yes | Yes | Company IDs were followed to company detail successfully. |
| `/api/v1/companies` | Optional country/region/owner/product/page filters | Yes | No | Public/filterable company list. |
| `/api/v1/companies/stats` | Country ID optional | Yes | No | Aggregate company statistics. |
| `/api/v1/countries/{countryId}/companies` | Country ID; product/sort/page optional | Yes | No | Country-specific companies. |
| `/api/v1/countries/{countryId}/companies/stats` | Country ID | Yes | No | Country-specific aggregates. |
| `/api/v1/players/{userId}/companies` | Player ID; product/sort/page optional | No | Yes | Tested; response was an empty company page for that player. |
| `/api/v1/companies/{companyId}` | Company ID | Yes | Yes | ID discovered from regional company list. |
| `/api/v1/jobs` | None | Yes | No | Open job offers; not proof of a player's current employment. |
| `/api/v1/battles` | Optional status/type/country/region/limit | Yes* | Yes | Saved `All battles` and `Active battles` are byte-identical; exact query provenance unknown. |
| `/api/v1/battles/{battleId}` | Battle ID | Yes | Yes | ID discovered from live battle list. |
| `/api/v1/battles/{battleId}/contracts` | Battle ID | Yes | No | Small contract response sample. |
| `/api/v1/regions/{regionId}/campaign` | Region ID | Yes | No | Regional campaign state. |
| `/api/v1/wars` | Optional status/country | Yes | No | Global war list; no separate war-detail operation is in this reference. |
| `/api/v1/contracts` | None | Yes | No | Mercenary contract list. |
| `/api/v1/contracts/auctions/{auctionId}` | Auction ID | No | No | Requires an auction ID discovered in contract data. |
| `/api/v1/market` | Market optional | Yes | Yes | `itemCode` values are discoverable from this list. |
| `/api/v1/market/{itemCode}/orders` | `itemCode`; market optional | No | No | Can resolve item code from `/market`. |
| `/api/v1/market/{itemCode}/history` | `itemCode`; hours/market optional | No | No | No saved response. |
| `/api/v1/market/{itemCode}/trades` | `itemCode`; limit/market optional | No | No | No saved response. |
| `/api/v1/market/trades` | Market/limit optional | No | No | No saved response. |
| `/api/v1/equipment` | Slot/rarity/sort/page optional | No | Yes | Returns offers for sale; not player inventory. |
| `/api/v1/equipment/floor` | None | No | No | No saved response. |
| `/api/v1/units` | Country/search/policy optional | No | No | Alternative unit discovery route. |
| `/api/v1/units/{muId}` | Unit ID | No | Yes | ID discovered from country units list. |
| `/api/v1/players` | `ids` list | No | No | Batch lookup when IDs are already known. |
| `/api/v1/players/by-name/{username}` | Username | No | Yes | Name was found through live search first. |
| `/api/v1/players/{userId}/stats` | Player ID | No | Yes | Live fields include work/trade/company metrics. |
| `/api/v1/players/{userId}` | Player ID | No | Yes | Live sample includes prestige, rank details and `equipment`; semantics of equipment need confirmation. |
| `/api/v1/rankings/{board}` | Board; period/country/limit optional | No | No | Board codes described as discoverable from `/game`, not verified here. |
| `/api/v1/rankings/{board}/archive` | Board | No | No | No saved response. |
| `/api/v1/articles` | Category/language/country/newspaper optional | No | No | No saved response. |
| `/api/v1/articles/{articleId}` | Article ID | No | No | No saved response. |
| `/api/v1/newspapers/{newspaperId}` | Newspaper ID | No | No | No saved response. |
| `/api/v1/history` | Optional type/country/cursor | No | No | Country history sample is a different route. |
| `/api/v1/tournaments` | None | No | No | No saved response. |
| `/api/v1/tournaments/{editionId}` | Edition ID | No | No | Requires an ID from tournament list. |

`*` The two battle files are identical and do not prove which query produced them. Saved data does not record source URLs, so all sample associations remain provisional until provenance is added.
