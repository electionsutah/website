# Project instructions

## Browser checks

Use Synaptic Code’s `preview_*` browser tools for browser checks. Do not launch Chrome or Playwright from sandboxed shell commands. If a test requires standalone Playwright, run it through a specifically authorized runner outside the agent’s shell sandbox, using a temporary browser profile.

## Sources and notes

When consolidating a verified matching candidacy, prefer its source-imported named party/affiliation over `not-reported`. Preserve every original source value; conflicting named affiliations require review rather than inference.

Always prefer the existing evidence popover pattern (`evidence-popover` with `anchoredPopover`) over `<details>` for sources and notes anywhere on the site. Reuse its shared styles, anchored positioning, and close control.

## HTML reports

Use HTML rather than Markdown for report deliverables by default.

Always give generated HTML reports a `<body>` margin of `3rem`.

Generated reports must link relevant existing ELUT entities and place source links alongside the claims they support.

## Default data enrichment workflow

Use this low-token sequence for data enrichment across elections, parties, people, places, and offices. Apply the relevant steps in order; do not repeat satisfied steps or perform broad research for a narrow request. The reference report is [External link inventory](reports/external-link-inventory.html).

1. **Reuse existing evidence.** Inspect current data, editorial overrides, review dispositions, prior reports, and cached fetches before making network requests. For link work, run `node scripts/inventory-external-links.mjs` when an updated inventory is needed. Review imported contact differences before searching; preserve explicit clears and intentional exclusions.
2. **Extract from known primary pages.** Fetch each unique canonical website once. Use deterministic scripts to extract relevant fields, outbound account links, and JSON-LD `sameAs`. For link enrichment, try contact/about/social pages only if the homepage yields nothing, with a bounded page budget per domain. Keep full responses on disk instead of sending whole pages to a model.
3. **Batch authoritative directories.** Prefer chamber rosters, party candidate directories, state filings, and official government directories that cover multiple entities in one request. Corroborate identity with office/district/year or place/county; a name match alone is insufficient.
4. **Batch structured sources.** Reuse existing Wikidata IDs and other established identifiers to query relevant fields together. Treat secondary-source results as candidates until corroborated by primary evidence. Preserve verified values and review ambiguous identity matches.
5. **Search unresolved gaps only.** Prioritize current entities and requested fields. Use entity-level queries with jurisdiction and role context rather than one search per platform. Use archival evidence for historical records; never attach a modern namesake's account by inference.
6. **Use model review for exceptions.** Produce compact candidate rows with entity ID, candidate value or URL, source URL, anchor text or short excerpt, identity evidence, fetch date, and disposition. Send only ambiguous ownership or conflicting evidence for model review. Report aggregate counts and a small exception sample; retain full raw results locally.

### Enrichment controls

- Deduplicate canonical fetch URLs and candidate destinations while preserving distinct accounts. Reject share, intent, login, and individual post/video endpoints when collecting accounts. Keep person, party, office, government, department, and tourism identities separate.
- Cache results by canonical URL and content hash, using conditional requests when supported. Record successful fetch time, evidence/publication date, outcome, and next-review time. Cache negative outcomes so missing fields do not trigger repeated searches.
- Distinguish `not_attempted`, `no_account_found`, `not_applicable`, `blocked`, `retrieval_failed`, `ambiguous`, `verified`, and `historical`. Missing data does not prove an account or value exists. Retrieval failures must not erase verified data.
- Preserve provenance alongside each accepted claim. Distinguish source endorsement from current account activity or live availability. Accept deterministic results only when primary-source ownership and identity are clear; review exceptions before applying them.
- Use the configured `FIRECRAWL_API_KEY` for Firecrawl API calls, without exposing the key or switching authentication to a personal login. If requests fail or credits are unavailable, report the limitation and use available evidence or a suitable fallback. Keep provider request costs separate from model token costs.
- Run repository checks appropriate to the changed data. Deliver HTML reports with relevant entity links, nearby evidence links, aggregate coverage, unresolved exceptions, and links to machine-readable exports when useful.

### Controlled people-link discovery

- Prepare a bounded current-person cohort with `npm run enrich:people:prepare -- 100`, then run `npm run enrich:people`. Seeds use resolved links and editorial overrides, not raw name guesses. The default selection is alphabetical among people with 2026 filings, a non-legislative website, and no recorded social account.
- The implemented first-stage runner is `scripts/enrichment_pipeline.py`: at most two pages per person by default, six workers, finite time/size/redirect budgets, canonical account filtering, anchor and JSON-LD extraction, hashed raw-page cache, conditional refresh, and dated negative/error outcomes. It writes review proposals and HTML/JSON evidence; it never applies proposals to production data.
- Use `--offline` for cache replay and `--refresh` for conditional revalidation. Direct public-page retrieval is the default fallback. Select `--backend firecrawl` explicitly to use the CLI and its configured API key; backend failures do not switch authentication or backend automatically.
- Fetch success (`verified` in the fetch ledger) means a retrieved HTML document, not verified account ownership. Discovered accounts remain `ambiguous` pending ownership review. Shared institutional domains, identity/context mismatches, cross-domain redirects and editorial overrides require review. Historical or inapplicable entities should receive explicit dispositions rather than fresh searches.
- Directory, structured-data and search stages remain separate follow-up work under the sequence above; do not describe primary-page discovery as completion of those stages. Before accepting proposals, review ownership and preserve existing verified links, exclusions and manual overrides.
- Validate controls with `npm run check:enrichment`. The HTML trial report and JSON ledger record cohort selection, per-person outcomes, request/cache counts, sources, and zero production changes.

### Additional enrichment cohorts and approvals

- To continue beyond a cohort, pass its run JSON as the exclusion manifest: `node scripts/prepare-person-enrichment.mjs 200 reports/people-enrichment-rerun.json .firecrawl/enrichment/people-next-200-seeds.json`. This excludes every previously attempted person, including failures, prioritizes 2026 filings, and fills remaining slots from earlier filing years with known websites. Historical seeds are flagged and held for additional identity review.
- Use a separate output file for each run. Prepare review batches with `node scripts/prepare-enrichment-review.mjs reports/people-enrichment-next-200.json people-enrichment-next-200-review 5`. The final arguments set an isolated report prefix and starting batch number; preserve earlier manifests and approval/application audits.
- Historical matches, mislabeled X/Threads links, and hashtag links remain investigation-only. Primary-site context checks alone are not ownership approval. Apply only the user's explicitly approved batch, with fingerprint verification and a separate application audit; exclude invalid or unrelated links and preserve the original reviewed manifest.
