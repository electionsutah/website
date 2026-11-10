# External link inventory

Snapshot of resolved application data, 2026-11-10. Run `node scripts/inventory-external-links.mjs` to regenerate the JSON and CSV inventories. This is a data coverage audit, not a live availability or account activity check. A missing link means it is not recorded, not that an account exists or should exist.

| Entity | Records | With any profile/source link | With website | With social | Explicit link review |
|---|---:|---:|---:|---:|---:|
| Elections | 53 | 53 | 53 | N/A | N/A |
| Parties | 23 | 8 | 7 | 7 | 23 |
| People | 12,439 | 493 | 458 | 87 | 254 |
| Places | 294 | 262 | 258 | 32 | 43 |
| Offices (additional) | 1,606 | 139 | 139 | 4 | 138 |

Elections expose a cycle source rather than the entity link collection used for people, parties and places. All 53 have one; their filings collectively reference 3,676 distinct URLs. A source can be a general archive index rather than a direct election artifact. Zero social links is appropriate for an election event. Use the existing state-election-source-inventory report for document discovery/import status; link presence does not establish complete election coverage.

Parties have 25 profile links, all with source and verification date. Fifteen affiliations have no links, with explicit dispositions: historical affiliations, non-organizations, or local caucuses without a verified dedicated account. Do not treat these as 15 missing organizations. People's Freedom Party has a verified social account without a separate website. See `src/data/party-enrichment.json` for each disposition.

People have 648 displayed profile links; 357 carry source and verification date, leaving 291 without those fields. Only 254 people have an explicit review record. Among 865 people with a 2026 filing, 631 have no profile links, 642 no website, and 839 no social. This is a filing-year cohort, not a list of current officeholders or only active candidates. Among that cohort, 208 have a website but no social account recorded. Across all years, 406 have a website but no social. Sixty-two distinct-per-person contact URLs in imported filings are absent from displayed links. Review dispositions intentionally supersede older contacts; these differences are a review queue, not automatic additions.

Places have 872 profile links: 260 website links, 259 Wikipedia, 259 Wikidata, and 94 social links. There are 36 places without a website and 32 without any links; 251 have no explicit link review. There are 227 places with a website but no recorded social account. Missing-link examples include [Fielding](https://www.electionsutah.org/places/box-elder/fielding/), [Cornish](https://www.electionsutah.org/places/cache/cornish/), and [South Weber](https://www.electionsutah.org/places/davis/south-weber/). Some other gaps involve historical places, so administrative status needs checking before assigning a present-day government website.

## Low-token enrichment sequence

1. **Reuse existing data first.** Review the 62 person contact differences, the existing `.firecrawl/` cache, enrichment reports, and editorial overrides. Match by entity ID; preserve explicit clears and reviewed exclusions. No web request or LLM required for inventory and URL extraction.
2. **Extract from known homepages.** Start with the 208 people in the 2026 cohort and 227 places that have a website but no social links. Fetch each unique canonical homepage once, extract outbound anchors and JSON-LD `sameAs` using a script, filter to supported account domains, and emit compact candidate rows. Only try contact/about/social pages when the homepage yields nothing; cap follow-up pages per domain. These are up to 435 entity seeds, not necessarily 435 distinct fetches. Do not ask a model to read full pages.
3. **Query authoritative directories in batches.** Extract legislators from chamber rosters, candidates from party directories and state filing data, municipalities/counties from official government directories. One directory fetch can cover many entities. Name + office/district/year or place + county must corroborate identity; exact name alone is insufficient. Keep candidate, party, office, and government accounts separate.
4. **Query Wikidata in batches where IDs already exist.** Use stored place QIDs to request official website and account identifiers (for example P856, P2013, P2002, P2003, P2397, P4033). Treat results as candidates until corroborated by a primary site; do not overwrite verified government links. For people without IDs, use name plus office/jurisdiction/date and review ambiguous matches rather than guessing.
5. **Search only unresolved current entities.** Build query templates such as `"{name}" "{office or district}" official website`, `"{municipality}" "{county}" Utah official government`, or `site:{known-domain} (Facebook OR Instagram OR LinkedIn)`. One entity-level discovery search can return several platforms; avoid one search per person per platform. Prefer archival evidence for historical candidates; do not attach a modern namesake's account.
6. **Send only exceptions to an LLM.** Emit `{entityId, candidateUrl, sourceUrl, anchorText, identityEvidence, fetchedAt, disposition}` and a short excerpt only for ambiguous ownership. Report aggregate counts and a small exception sample in chat. Full raw results stay on disk.

## Pipeline controls

Use URL normalization to collapse http/https redirects, www variants, tracking queries, trailing slashes, and twitter.com/x.com aliases without collapsing distinct accounts. Reject share/intent/login endpoints and individual posts/videos. A homepage endorsement proves ownership evidence, not posting activity or future availability. Never copy department/tourism/parent-party accounts onto a different entity. The existing resolver validates URLs and basic duplicates but does not implement all these canonical equivalences.

Cache by canonical URL and content hash; use conditional requests when supported. Store successful fetch time, evidence time, status, negative result and next-review time. Distinguish `not_attempted`, `no_account_found`, `not_applicable`, `blocked`, `retrieval_failed`, `ambiguous`, `verified`, and `historical`. Missing platform fields alone should not trigger repeated searches. Apply model review only to ambiguous rows; accept deterministic extraction only under explicit primary-source ownership rules. Preserve publication dates for historical evidence separately from retrieval dates.

Firecrawl calls should use the configured `FIRECRAWL_API_KEY`. The latest attempt in this session returned HTTP 402; the proposed batch work has not been executed. Token savings from deterministic extraction do not eliminate provider request/credit costs. No unsupported dollar or token estimate is assumed.

## Files

- `external-links.csv`: every resolved profile link and election cycle source, with available provenance.
- `external-link-gaps.csv`: one row per entity with coverage flags.
- `external-link-references.csv`: distinct-per-entity filing, review and resource source URLs, separate from profile accounts.
- `external-link-inventory.json`: full runtime inventory, platform counts, review dispositions, contact differences, and references.

Scope excludes image asset/attribution URLs, arbitrary links embedded inside prose, and application navigation. Reference URLs may recur across entities because one source supports multiple records. Imported links can lack provenance fields even when a filing source exists; that is a metadata gap, not proof of an untrustworthy destination.
