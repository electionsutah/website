# Elections Utah — multi-year data edition

A responsive, single-page reimagining of the Elections Utah archive, combining
the original 2017–2019 records, pre-2017 canvass rosters, and official State of Utah candidate
data through the 2026 election cycle.

## Run locally

Reviewed candidate records outside the results feed live in `src/data/researched-candidates.json`; the app merges them with the historical and local imports so feed refreshes preserve them. `src/data/place-election-notes.json` retains cancellation and vacancy records separately from election filings, and shows them in the place's existing election details popover.

Run `npm run check:researched` to validate these records and `npm run audit:coverage` to regenerate the HTML, JSON, and Markdown municipal coverage reports in `reports/`. The HTML includes sortable tables, search, gap filtering, and source popovers. The audit uses the checked-in municipality boundary snapshot, groups multi-county municipalities, and flags missing records for research rather than treating them as proof that no election occurred.

`reports/municipal-gap-investigation.json` retains source notes and manually verified candidates for the original 33-place investigation cohort. Run `python3 scripts/import-municipal-gap-findings.py` to merge those candidates idempotently and create sourced place profiles. Search cache files are discovery leads only; the importer reads reviewed records, never raw search hits.

```bash
npm install
npm run dev
```

## Local content editor

The Decap proof of concept edits people and filing records alongside automated
imports, with manual changes preserved in a separate override file. Run
`npm run editor:install` once, then `npm run editor` and open
`http://127.0.0.1:8080`. See [editor/README.md](editor/README.md) for the editing
workflow, data connections, and current scope.

## Included content

- Searchable filing and ballot-candidate records from available 1960–2026 state and county sources, plus earlier newspaper returns
- Individual, cross-linked views for people, offices, political parties,
  counties, cities, and election years
- Global popout search across every entity type
- Schema-compatible YAML at `src/data/2026-candidates.yml`
- 2026 primary, general election, and candidate-filing milestones
- Utah political party directory
- Voting eligibility requirements
- Documentation and CC0 public-domain links

The candidate source is the [Utah Lieutenant Governor's 2026 filing page](https://vote.utah.gov/2026-candidate-filings/), whose workbook was last modified July 20, 2026. The record shape and normalized status vocabulary follow the [Elections Utah person schema](https://www.electionsutah.org/docs/schema/).

The 2017, 2018, and 2019 records come from the original CC0 Elections Utah
candidate exports. The state backfill adds 2020 primary and general canvass
workbooks, the 2022 official voter pamphlet/general-election roster, the 2023
congressional special-election filings, and the 2024 candidate-filing workbook.
Utah did not publish comparable statewide candidate tables for the locally
administered 2021 and 2025 municipal cycles, so their year pages explain the
gap and link to the official record directories instead of fabricating rows.

## Pre-2017 coverage

The 2013–2016 tranche adds 826 distinct ballot-candidate records:

- **2016:** 291 records from Utah's primary and general statewide canvasses.
- **2015:** 106 municipal records from Salt Lake County's primary and general results.
- **2014:** 269 records from Utah's primary and general statewide canvasses.
- **2013:** 160 municipal records from Salt Lake County's primary and general results.

Sources: [Utah historical statewide results](https://vote.utah.gov/historical-election-results/)
and [Salt Lake County historical results](https://www.saltlakecounty.gov/clerk/elections/election-results/).
Every imported record links directly to its workbook or PDF. These are ballot
rosters rather than complete filing lists: withdrawn and convention-only
candidates may be absent. Municipal coverage is limited to the county's mayor
and council contests. Ballot measures, unnamed write-in totals, and special
districts are excluded. Primary and general appearances merge by year, name,
office, and party; the general appearance takes precedence. Status describes
ballot participation, without inferring winners or elimination. Dates identify
the source election, not a recovered declaration date.

Refresh with `python3 scripts/import-pre2017-candidates.py`; add `--use-cache`
to reuse source files in `.firecrawl/pre2017/`. Requires Poppler's `pdftotext`.
The importer replaces only 2013–2016 records and preserves later cycles.
The indexes also include earlier statewide and county results. See the
1994–2012 backfill below for imported records and remaining source gaps.

## Reviewed state PDF rosters, 1960–1992

The [state historical-results index](https://vote.utah.gov/historical-election-results/)
contains 68 election groups across 1960–2024, including primary, presidential,
and special elections. The [source inventory](reports/state-election-source-inventory.html)
distinguishes direct artifact provenance, known existing importer coverage, and
unimported sources. A document not imported does not imply that its election year
has no existing candidate records. OCR snapshots for the 28 indexed pre-1994
sources have been cached for review; raw OCR output is never imported directly.

The reviewed manifest now contains **2,068 candidate/office/election records from
28 PDFs across every even-year cycle from 1960 through 1992**. This adds 2,028
records beyond the initial 1960 import. Coverage is partial where the manifest
lists pending pages, faint names, conflicting labels or abbreviated tickets;
these counts do not claim complete statewide rosters. Primary and general
candidacies retain separate keys, and judicial retention entries are labeled.

The first import supplied **40 candidate/office records for 1960**.
`1960Gen.pdf` page 1 is a separate party/turnout abstract. Pages 2–4 are overlapping
parts of one wide table. The reconstruction rotates and deskews the scans,
aligns their header/body and totals rules, and removes repeated columns at the
seams. The joined table and upright name headers are saved in
`reports/source-images/`, with panel-level provenance in the matching JSON.

```sh
uv run --with pillow python scripts/stitch-historical-canvass.py .firecrawl/state-history/1960Gen.pdf
python3 scripts/import-reviewed-state-rosters.py
python3 scripts/audit-historical-state-sources.py
node scripts/report-state-election-sources.mjs
```

`scripts/render-canvass-review.py` generalizes header review for rotated pages,
vertical names and side-by-side tables. `scripts/process-historical-canvasses.py`
generates proposals with independent OCR evidence; it never imports raw OCR.
The macOS-only `scripts/lib/ocr-canvass.swift` runs accurate Vision OCR on full
pages plus four overlapping tiles and retains page coordinates. The reviewed
manifest records scope and unresolved work per document; rerunning the importer
preserves records from other sources and the current 2026 results.

```sh
uv run --with pillow python scripts/render-canvass-review.py \
  .firecrawl/state-history/1980Gen.pdf /tmp/1980-header-review.png \
  --rotate -90 --top .04 --bottom .34 --names --pages 5 6
uv run --with pillow python scripts/render-reviewed-state-pdfs.py --source 1962-primary
python3 scripts/process-historical-canvasses.py
```

The source auditor reads a Firecrawl index snapshot at
`.firecrawl/state-history-current.json`. Refresh that snapshot with:

```sh
firecrawl scrape 'https://vote.utah.gov/historical-election-results/' --format markdown,links -o .firecrawl/state-history-current.json
```

Reviewed facts live in `src/data/history/reviewed-state-rosters.json`. The importer
replaces only records owned by those reviewed source documents and preserves
other imports. Candidate rows link to original PDF pages; presidential running
mates remain on their tickets. The source's historical Governor office remains
separate from the modern joint ticket. The four district judges are contested
candidates, not retention questions. The printed party label “Soc.” is retained
without guessing a normalized party name. Ballot questions, responses and the
page-1 party totals do not become candidate records; votes and winners are not
imported by this roster workflow. The canvass lists selected Senate districts
and no State House roster, so it does not establish statewide completeness.

The index entry “1962 Primary” links to `1960Pri.pdf`, but the document heading
confirms **September 11, 1962**. This filename discrepancy is recorded in
`src/data/history/state-source-reviews.json`; dates are verified from documents,
not inferred from filenames. Its 12 primary candidate columns are now imported into the 1962 cycle.

## 1994–2012 backfill

The state/county importer now adds **2,518 distinct candidate/office/year/party
records across 18 years from 1994 through 2012**. The separate newspaper dataset
already supplies **1,225 unofficial 1995 records**. Every year in the requested
range therefore has records, with substantial differences in source coverage.

The first pass reported 1,325 records for 2007–2012. Follow-up work removed two
misclassified Yes/No responses and six recreation-board candidates incorrectly
assigned to a preceding council contest, added the
2008 regular/presidential primaries, and extended reviewed rosters back to 1994.
The preserved first-pass inventory and current source-by-source gaps are shown in
[the HTML progress report](reports/historical-backfill-1994-2012.html).

```sh
uv run --with xlrd python scripts/import-1994-2012-candidates.py --use-cache
node scripts/report-historical-backfill.mjs
python3 -m unittest discover -s scripts -p 'test_import*.py'
```

Requires `curl` and Poppler's `pdftotext` for source downloads and municipal PDF
extraction, plus `xlrd` for legacy Excel. Downloads live in `.firecrawl/pre2017/`.
Reviewed older PDF facts are committed in
`src/data/history/reviewed-canvass-rosters.tsv`, with document keys and page
numbers. Local OCR was used to aid transcription; raw OCR output is not imported.
The importer replaces only its covered years and preserves all other cycles and
the separate newspaper dataset. The 2013–2016 importer remains independent.

**Remaining source work:** selected 1996/1998 judicial entries, the conflicting
1999 general Salt Lake City District 6 section and August incorporation primary,
the 2000/2002/2004 general legislative/school-board/judicial rosters, and 2006
general House coverage. The 2006 official PDF repeats Senate tables where
multi-county House coverage is expected; county sources will be needed. Details
and reviewed page numbers are in `reports/historical-backfill-1994-2012.json`.

These are ballot rosters, not complete filing lists. Municipal official coverage
is limited to Salt Lake County. Older state canvasses vary in legislative scope.
No outcomes are inferred. Surname-only tickets and source spellings are retained;
unknown running mates do not become people. Ambiguous or unpublished party
labels remain blank. Judicial retention is labeled separately from contested
races, and justice-court sheets are excluded. All 75 House districts are present
in each of the 2008/2010/2012 statewide general imports.

## Refreshing the data

Download the current official workbook, then regenerate both the YAML source and
the JSON used by the Svelte directory:

```bash
curl -L -o /tmp/utah-2026-candidate-filings.xlsx \
  https://vote.utah.gov/wp-content/uploads/2026/06/Candidate-Filing-2026.xlsx
python3 scripts/generate_2026_candidates.py \
  /tmp/utah-2026-candidate-filings.xlsx
```

After downloading the original yearly JSON exports, regenerate the historical
bundle with:

```bash
python3 scripts/generate_historical_candidates.py \
  --2017 /tmp/eu-2017.json \
  --2018 /tmp/eu-2018.json \
  --2019 /tmp/eu-2019.json
```

Then fetch and normalize the official state backfill sources:

```bash
python3 scripts/generate_state_backfill.py
```

The backfill script downloads the official artifacts directly. Regenerating
2022 requires Poppler's `pdftotext` command because that cycle's published
candidate roster is a PDF rather than a workbook.

Finally, link each filing to the most specific official document for that
candidate, so person pages point at the document rather than an index page:

```bash
python3 scripts/generate_candidate_documents.py
```

- 2023, 2024, and 2026 link to the declaration PDFs on the live filing pages.
- 2018, 2020, and 2022 filing pages no longer exist, so the script reads
  Wayback Machine snapshots of the state's candidate API, which list each
  candidate's document. Documents still on vote.utah.gov link there; the rest
  link to their Wayback Machine capture.
- 2020 judicial retention candidates link to their evaluation page in the
  official voter information pamphlet (requires Poppler's `pdftotext`).
- The 2017 congressional special election links to archived declarations.
- 2017 and 2019 municipal filings link to the Wayback Machine capture of the
  original city or county page nearest the record's date, but only when that
  capture actually names the candidate.

Records without a better document keep their existing source. Both
vote.utah.gov and the Wayback Machine rate-limit requests, so the script caches
responses in the system temp directory and a first run takes several minutes.

The generator uses only the Python standard library. It preserves the state's
source status in JSON and maps it into the schema's fixed `candidate_status`
values in YAML. The one lossy mapping is `Deceased` to `withdrew`, because the
published schema has no deceased status.

## AI assistants (MCP connector)

The site runs a read-only [Model Context Protocol](https://modelcontextprotocol.io)
server at `https://www.electionsutah.org/mcp` (Streamable HTTP, stateless, no
sign-in). It is a Netlify Function (`netlify/functions/mcp.mts`) that wraps
`src/mcp/server.ts`, which reuses the site's own data libraries, so answers match
the website.

| Tool | Returns |
|---|---|
| `search` | People, offices, parties, places, and 2026 contests matching a query, with ids and site URLs |
| `fetch` | The full record for a `search` id |
| `list_contests` | 2026 contests filtered by category, county, or text |
| `get_contest_results` | Votes for one contest, statewide or for one county |
| `get_district_shift` | Change in the D–R margin since 2024 or 2022 for a legislative or State School Board race |

`search` and `fetch` follow the shape ChatGPT expects for connectors and deep
research. Results responses state whether the numbers are unofficial and when
they were last updated.

Connect it:

- **Claude** (claude.ai or desktop): Settings → Connectors → Add custom connector, URL `https://www.electionsutah.org/mcp`.
  Claude Code: `claude mcp add --transport http elections-utah https://www.electionsutah.org/mcp`.
- **ChatGPT**: Settings → Apps & Connectors → enable developer mode under Advanced, then create a connector with the same URL and no authentication.

Menus and plan requirements change; check each app's current help pages.

Run and test it locally:

```sh
npm run mcp                                   # http://127.0.0.1:8787/mcp
npx @modelcontextprotocol/inspector           # choose Streamable HTTP and that URL
```

The build also writes `dist/llms.txt` (a guide to the site and its data for AI
tools) and `dist/data/filings.json` (every candidate filing as JSON).

## Verified website and social links

Source-backed link collections are stored separately from archived filings:

- `src/data/office-enrichment.json` — individual office sites and accounts
- `src/data/party-enrichment.json` — party websites, accounts, and review dispositions
- `src/data/person-link-enrichment.json` — individual profiles and campaign accounts
- `src/data/place-link-enrichment.json` — verified government sites and accounts

Each new link retains its primary source and verification date. These collections
appear on entity pages, directory tiles, and the MCP connector. Government documents,
external reference pages, and parent-organization accounts are kept out of a
subject’s website/social collection. Existing Wikipedia/Wikidata links for places
remain available as explicitly identified reference links.

Run the link checks with `npm run check:links`. HTML review reports live in
`reports/`, link subjects to their directory pages, and retain a `3rem` body margin.
After generating a report and its matching JSON file, run
`node scripts/decorate-enrichment-reports.mjs` to embed the platform icons. Pass
individual HTML paths to update only selected reports. Reports are self-contained
for offline review, including filtering and pagination.

## Office descriptions and communities

Office and affiliation descriptions are defined in `src/lib/entity-profiles.ts`
and `src/data/party-profiles.json`. Office communities come from official UGRC
boundaries, not candidates’ mailing addresses. `src/data/office-communities.json`
retains GIS source URLs, retrieval dates, and input hashes. Rebuild with:

```sh
uv run --with shapely --with pyproj python scripts/generate-office-communities.py
```

Add `--use-cache` to reuse ignored `.firecrawl/office-communities/` downloads.
Full-resolution polygons are projected to EPSG:26912. Overlaps below one hectare
are omitted as possible boundary slivers, and municipalities with less than
99.5% overlap are marked “Partial.” This is a geographic guide, not an address-level
voting eligibility tool. Municipal names do not enumerate every settlement.
District dates are displayed; these boundaries are not applied retroactively to
archived elections. Judicial county coverage follows the Utah Courts district
map. Unverified local wards, school-board seats, and special-purpose service
areas are explicitly identified rather than populated from candidate addresses.
Run `npm run check:profiles` to check coverage and those distinctions.

## Directory routes

Current campaign information is maintained separately in
`src/data/person-enrichment.json`, keyed by the person's directory ID. Each
profile records its campaign source and verification date, a short biography,
attributed priorities, contact details, and resource links. Profile contacts
take precedence on person pages without replacing contacts in archived filings
or changing the state's candidate status and dataset update date. All contact
email addresses use the shared `email` field. Postal and physical addresses use
the shared `address` field: a list of `{ "label": "Campaign office", "value": "…" }`
entries when multiple addresses are published. Original single-address strings
remain supported. Physical addresses open Google Maps; mailing addresses copy
to the clipboard with a confirmation at the bottom of the viewport. Mailing
addresses are identified by a mailing/postal label or a P.O. Box value.

The app uses shareable client-side routes that follow the original Elections
Utah information architecture:

- `/people/` and `/people/{person-id}/`
- `/offices/` and `/offices/{office-id}/`
- `/parties/` and `/parties/{party-id}/`
- `/places/` and `/places/{place-id}/`
- `/elections/` and `/elections/{year}/`

Each directory index can switch between tile and list layouts and drill down
with filters built from the schema's per-election fields: election year,
`election_type`, office type, `candidate_status`, party, county, city, and the
published contact fields. Filters, search, and layout are kept in the query
string, so a filtered view can be shared, for example
`/people/?year=2024&party=Utah+Democratic+Party&search=salt+lake`. The
site-wide search modal's "View all" links use the same `search` parameter. List-view columns sort
A–Z or Z–A from their headers (`?sort=office&order=desc`). Each page's filters,
layout, and sort are also saved in localStorage and restored on later visits; a link
that carries its own filters takes precedence.

Every detail page links to related entities. Places follow the original site’s
model: county routes use `/places/{county-id}/`, and city routes use
`/places/{county-id}/{city-id}/`. The 2026 workbook does not publish candidate
city or county values, so those filings correctly show “Not published” instead
of being assigned to an electoral district as a place.

## Election results lab

`/labs/` is an editorial-style explorer for the **2026 general election**. Its
compact interactive county maps accompany U.S. House race cards and a detailed
explorer for every imported contest. Search, county/category filters, closest-race
sorting, pagination, shareable query parameters, keyboard map selection, and
county result tables are included. The existing site’s serif/sans fonts, blue
links, dark rules, and warm backgrounds carry into the lab.

The bundled snapshot at `public/data/2026-results.json` contains 135
state-published contests plus 329 additional local contests across all 29 counties.
It was retrieved from the [official public results API](https://electionresults.utah.gov/results/public/Utah/General11032026).
Refresh it before rebuilding/deploying:

```bash
python3 scripts/refresh-election-results.py
npm run check
npm run build
```

This is a **saved snapshot**, not a live feed. Results update when a refreshed
snapshot is built and deployed; there is no on-demand reload control. Congressional
map cards show the top three candidates, with the remaining candidates and votes
summarized separately. The importer
uses the state-published contest breakdowns for county comparisons, then includes
county-only contests without duplicating their parent statewide contests. Raw
responses are cached in the ignored `.firecrawl/results/` directory;
`--use-cache` supports offline regeneration. A failed import preserves the previous
snapshot. The JSON retains state/county source timestamps, reporting counts,
source links, exact candidate names, votes, and the source’s winner indicators.
All vote totals and county breakdown sums were reconciled for the included import.

Maps show **county aggregates**, including only votes for the chosen contest;
they do not depict 2026 district boundaries. Geometry is bundled in
`src/data/utah-county-paths.json`, projected from the Utah features in
[Plotly’s U.S. Census county GeoJSON](https://github.com/plotly/datasets/blob/master/geojson-counties-fips.json).
These simplified county shapes should not be used for address or district lookup.
Leaders are not projected winners, and “reporting” does not mean every ballot has
been counted. The accessible county selector and data table follow W3C’s
[text-alternative guidance for complex images](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html).

### Linking results to existing people

Results use the same identity normalization as the directory (case, spacing,
accents, and punctuation) and recognize names already recorded in a person's
filings. Links use the directory's actual person ID. A unique exact identity
match links automatically; duplicate names need a matching 2026 office and,
for local contests, county. Similar spellings, missing middle names, and nicknames
are not guessed. Ballot responses and write-in aggregates never become person
links. Judicial-retention questions link the named judge's profile while Yes/No
responses remain ballot responses. Official result names and votes stay unchanged.

The included snapshot reconciles to 226 candidate profiles plus 29 judicial
profiles (255 existing people). The three unmatched statewide candidate names are
Babak “Bobby” Darvish, Blake Townsend, and Rebecca Winsor. Unmatched local names
also remain plain text. The matcher reads the current directory at runtime, so
future results refreshes and directory additions use the same rules automatically.

Run `node scripts/check-result-people.mjs` to validate identity edge cases and
print the current reconciliation counts and unmatched statewide candidates.

### Historical political shifts

The lab includes a political-shift table for State House, State Senate, State
School Board, and countywide U.S. House votes, with district/county search,
filters, magnitude sorting, source details, and matching comparisons in the race
explorer. Blue arrows indicate a shift toward Democrats; red arrows indicate a
shift toward Republicans. Arrow lengths share a scale within the table.

The calculation uses all reported votes, including other parties and write-ins:

```
margin = 100 × (Democratic votes − Republican votes) / total contest votes
shift = margin in 2026 − margin in the prior comparable election
```

For example, D 61%, R 37% against a prior D 42%, R 56% produces **D+38 percentage
points** of margin change. This is not a 38-point increase in Democratic vote
share and does not establish that individual voters changed parties.

The included data supports **45 direct race comparisons** (39 State House,
4 State Senate, 2 school board) plus **29 countywide congressional comparisons**.
All 2026 values come from the saved, unofficial snapshot. Prior race baselines
use the most recent imported result, preferring 2024 over 2022; every row labels
its baseline year. The 2022 state canvass covers multi-county races only, so some
single-county Senate/school-board races lack imported baselines.

Comparison rules are in `src/lib/shifts.ts`:

- District matching uses the office and district number. It is permitted for
  State House, State Senate, and State School Board using Utah GIS’s documented
  [2022–2032 boundary vintages](https://gis.utah.gov/products/sgid/political/).
- **Congressional district numbers cannot be compared directly:** Utah’s
  [2026 congressional boundaries supersede the previous map](https://gis.utah.gov/products/sgid/political/us-congressional-districts/).
  The countywide comparison sums all U.S. House districts within each county
  once per year, preserving county geography despite the district change.
- Both parties must receive votes in each election. Missing parties are not a
  zero-percent baseline, and an older contested race never replaces a more
  recent uncontested baseline just to produce a numeric shift.
- Local boundaries/office matching are not verified; nonpartisan races,
  retention questions, and measures do not receive a D–R comparison.
- Zero, missing, duplicate, or inconsistent source data is withheld as applicable.
  The 2024 State House 68 district total is 17,491, but published county totals
  sum to 17,480. Its county breakdown is flagged and unavailable for shift
  calculations. Its full-race comparison is independently excluded as uncontested.
- Other-party voting, different candidates, competitiveness, and midterm versus
  presidential turnout can affect these election-to-election shifts.

Historical data is bundled in `public/data/2024-results.json` and
`public/data/2022-shift-baseline.json`. The 2024 importer queries the same public
results API as the 2026 importer. The 2022 importer reads Firecrawl OCR of the
scanned [official signed canvass](https://vote.utah.gov/wp-content/uploads/2022/12/Signed-2022-General-Election-State-Canvass-Certification.pdf).
Its 13 imported Senate/school-board contests must reconcile every candidate’s
county sum and each contest’s total before the output replaces the last snapshot.

```bash
npm run refresh:history
# Rebuild 2022 baselines after extracting the official PDF:
firecrawl parse /path/to/Signed-2022-General-Election-State-Canvass-Certification.pdf \
  -o .firecrawl/2022-canvass.md
python3 scripts/import-2022-shift-baseline.py .firecrawl/2022-canvass.md
npm run check:shifts
npm run check
npm run build
```

`import-result-history.py --use-cache` supports cached API responses. The shift
checks cover the formula, sign, denominator, uncontested races, missing votes,
baseline selection, boundary exclusions, and county aggregation against statewide
totals. Historical loading failures preserve the current-results experience and
never silently select an older baseline if the 2024 baseline failed to load.

### Statewide Utah legislature map

The statewide interactive at `/labs/#statewide-map` toggles between the **Utah
House** and **Utah Senate**, drawing actual district polygons from Utah GIS’s
2022–2032 plans. It bundles all 75 House and 29 Senate districts and joins them
by office/district number to the 2026 snapshot (75 House and 15 Senate results).
Seats with no published 2026 result use a neutral pattern; no incumbent party,
race call, flip, or legislative-control result is inferred.

Select a county to center on its area-weighted geometry centroid and fit its full
extent, then select a district for candidate
profiles, vote counts, and full-race links. Map colors always show the full
district leader; when a selected district has county-level data, the detail panel
explicitly labels those county-only votes. Chamber switching keeps the selected
county and map position. Reset returns to the statewide view in the current
chamber. Plus/minus buttons zoom from 1× to 24×; pointer dragging, directional
buttons, and keyboard arrows pan with the map center constrained to Utah’s extent.
County labels stay at the same geographic centroid as the zoom target; border
counties can show whitespace outside Utah so they remain centered. `+` / `-` zoom, `Home`
resets, and `Escape` clears the selected district. Searchable county and district comboboxes provide alternatives
to selecting small polygons. The district combobox filters by district number or
candidate name, uses Arrow keys and Enter for selection, and restores the current
selection on Escape or blur. County and chamber changes reset its search scope. Map errors leave the
results desk available and provide a retry control.

The boundary file is fetched only for this map, keeping the initial results
snapshot separate. Rebuild the geometry and check its joins and navigation math:

```bash
npm run refresh:boundaries
npm run check:map
```

`import-legislative-boundaries.py --use-cache` uses ignored cached GeoJSON. The
query simplifies to 0.0005 degrees (roughly 50 metres), and the projection matches
the existing county map. This is a visualization, not an address/district lookup.
Official boundary sources: [House](https://gis.utah.gov/products/sgid/political/state-house-districts/)
and [Senate](https://gis.utah.gov/products/sgid/political/state-senate-districts/).
