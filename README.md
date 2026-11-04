# Elections Utah — multi-year data edition

A responsive, single-page reimagining of the Elections Utah archive, combining
the original 2017–2019 records with available official State of Utah candidate
data through the 2026 election cycle.

## Run locally

```bash
npm install
npm run dev
```

## Included content

- 1,928 searchable filing records from the available 2017–2026 sources
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

## Directory routes

Current campaign information is maintained separately in
`src/data/person-enrichment.json`, keyed by the person's directory ID. Each
profile records its campaign source and verification date, a short biography,
attributed priorities, contact details, and resource links. Profile contacts
take precedence on person pages without replacing contacts in archived filings
or changing the state's candidate status and dataset update date. Use
`pressEmail` for a published media contact rather than treating it as a general
campaign email.

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

This is a **saved snapshot**, not a live feed. The reload control checks for a
newer snapshot on this site; it does not scrape the state on demand. The importer
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
