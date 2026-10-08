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
