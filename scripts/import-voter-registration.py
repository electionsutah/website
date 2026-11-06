#!/usr/bin/env python3
"""Import Utah voter registration counts from the Lieutenant Governor's office.

python3 scripts/import-voter-registration.py [--reports DIR]

Reads vote.utah.gov/current-voter-registration-statistics/, which has the
statewide table (active, inactive, and total voters by party) and links the
latest "Active Voters by County and Party" PDF. The PDF is converted with
pdftotext (poppler) and checked against the statewide active counts before
anything is written. The state publishes active voters only by county, and
nothing by district or city.

Writes src/data/voter-registration.json. With --reports, also writes a CSV and
an HTML review table to DIR that link each county to its place page on the site
and list that county's city and town pages (pages added by the local-contest
import, src/data/local-candidates.json, are marked new). Raw downloads stay in
the ignored .firecrawl/.
"""
import argparse
import csv
import html
import json
import re
import subprocess
import unicodedata
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen

from report_sort import SORTABLE

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firecrawl' / 'voter-registration'
OUTPUT = ROOT / 'src' / 'data' / 'voter-registration.json'
STATS_URL = 'https://vote.utah.gov/current-voter-registration-statistics/'
HEADERS = {'User-Agent': 'ElectionsUtah/1.0 (https://www.electionsutah.org/; voter registration)'}
SITE = 'https://www.electionsutah.org'
PARTIES = ['Republican', 'Unaffiliated', 'Democratic', 'Independent American', 'Libertarian', 'Constitution', 'Forward', 'Green']
COUNTIES = ['Beaver', 'Box Elder', 'Cache', 'Carbon', 'Daggett', 'Davis', 'Duchesne', 'Emery', 'Garfield', 'Grand', 'Iron', 'Juab', 'Kane', 'Millard', 'Morgan', 'Piute',
            'Rich', 'Salt Lake', 'San Juan', 'Sanpete', 'Sevier', 'Summit', 'Tooele', 'Uintah', 'Utah', 'Wasatch', 'Washington', 'Wayne', 'Weber']


def fetch(url):
    with urlopen(Request(url, headers=HEADERS), timeout=60) as response: return response.read()


def number(text):
    return int(text.replace(',', ''))


def cell_text(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', value))).strip()


def statewide(page):
    """The statewide table: party, active, inactive, total."""
    rows = {}
    for row in re.findall(r'<tr.*?</tr>', page, flags=re.S):
        cells = [cell_text(cell) for cell in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, flags=re.S)]
        if len(cells) == 4 and re.fullmatch(r'[\d,]+', cells[1]): rows[cells[0]] = [number(cell) for cell in cells[1:]]
    if 'Total' not in rows: raise SystemExit('Statewide table not found on the statistics page.')
    updated = re.search(r'Last updated on ([A-Z][a-z]+ \d{1,2}, \d{4})', page)
    if not updated: raise SystemExit('"Last updated" date not found on the statistics page.')
    active, inactive, total = rows.pop('Total')
    return datetime.strptime(updated.group(1), '%B %d, %Y').date().isoformat(), {
        'active': active, 'inactive': inactive, 'total': total,
        'parties': {party: dict(zip(('active', 'inactive', 'total'), counts)) for party, counts in rows.items() if counts[2]},
    }


def county_counts(text):
    """Rows of "County  Party  Voters"; "Independent American" wraps onto a second line."""
    counties: dict[str, dict[str, int]] = {}
    lines = text.splitlines()
    for index, line in enumerate(lines):
        match = re.match(r'^\s*([A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)?)\s{2,}([A-Z][A-Za-z]*(?: [A-Za-z]+)?)\s+([\d,]+)\s*$', line)
        if not match or match.group(1) == 'County': continue
        county, party, voters = match.group(1), match.group(2), number(match.group(3))
        if party == 'Independent' and index + 1 < len(lines) and lines[index + 1].strip() == 'American': party = 'Independent American'
        if county not in COUNTIES or party not in PARTIES: raise SystemExit(f'Unexpected PDF row: {line.strip()!r}')
        counties.setdefault(county, {})[party] = voters
    missing = set(COUNTIES) - set(counties)
    if missing: raise SystemExit(f'Counties missing from the PDF: {", ".join(sorted(missing))}')
    return counties


def slug(name):
    return name.lower().replace(' ', '-')


def place_slug(value):
    """The site's slug() in src/lib/entities.ts."""
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def place_pages():
    """Place pages the site builds, {key: name}, and the keys that only the local-contest import adds."""
    def pages(rows):
        found = {}
        for row in rows:
            if not row.get('county'): continue
            found[place_slug(row['county'])] = f"{row['county']} County"
            if row.get('city'): found[f"{place_slug(row['county'])}/{place_slug(row['city'])}"] = row['city']
        return found
    historical = json.loads((ROOT / 'src/data/historical-candidates.json').read_text())
    local = json.loads((ROOT / 'src/data/local-candidates.json').read_text())
    everything = pages(historical + local)
    return everything, set(everything) - set(pages(historical))


def page_url(key):
    return f'{SITE}/places/{key}/'


def write_reports(directory, data, places):
    directory.mkdir(parents=True, exist_ok=True)
    pages, new_pages = place_pages()
    missing = [name for name in COUNTIES if slug(name) not in pages]
    if missing: raise SystemExit(f'Counties without a place page: {", ".join(missing)}')
    county_population = {name: places.get(slug(name), {}).get('population') for name in COUNTIES}
    state_population = sum(county_population.values()) if all(county_population.values()) else ''
    cities = {name: sorted((key for key in pages if key.startswith(slug(name) + '/')), key=lambda key: pages[key]) for name in COUNTIES}
    rows = []
    state = data['state']
    rows.append({'geography': 'State', 'name': 'Utah', 'placeKey': '', 'pageUrl': f'{SITE}/places/', 'newPage': '', 'cityPages': sum(map(len, cities.values())), 'newCityPages': sum(key in new_pages for key in pages if '/' in key),
                 'population2020': state_population, 'active': state['active'], 'inactive': state['inactive'], 'total': state['total'], **{party: state['parties'].get(party, {}).get('active', 0) for party in PARTIES}})
    for name in COUNTIES:
        row, key = data['counties'][slug(name)], slug(name)
        rows.append({'geography': 'County', 'name': f'{name} County', 'placeKey': key, 'pageUrl': page_url(key), 'newPage': 'yes' if key in new_pages else '',
                     'cityPages': len(cities[name]), 'newCityPages': sum(city in new_pages for city in cities[name]), 'population2020': county_population[name] or '',
                     'active': row['active'], 'inactive': '', 'total': '', **{party: row['parties'].get(party, 0) for party in PARTIES}})
    stem = f'voter-registration-{data["asOf"]}'
    fields = ['geography', 'name', 'placeKey', 'pageUrl', 'newPage', 'cityPages', 'newCityPages', 'population2020', 'active', 'inactive', 'total', *PARTIES]
    with (directory / f'{stem}.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
    # Every place page, with the county registration it falls under (the state publishes nothing by city).
    with (directory / f'{stem}-pages.csv').open('w', newline='') as handle:
        writer = csv.writer(handle)
        writer.writerow(['placeKey', 'name', 'type', 'county', 'pageUrl', 'newPage', 'population', 'countyActiveVoters', 'voterCardOnPage'])
        for name in COUNTIES:
            key = slug(name)
            for page in [key, *cities[name]]:
                writer.writerow([page, pages[page], 'County' if page == key else 'City or town', f'{name} County', page_url(page), 'yes' if page in new_pages else '',
                                 places.get(page, {}).get('population', ''), data['counties'][key]['active'], 'yes' if page == key else 'no'])

    def fmt(value): return f'{value:,}' if isinstance(value, int) else '—'
    def share(row): return f'{row["active"] / row["population2020"]:.0%}' if isinstance(row['population2020'], int) and row['population2020'] else '—'
    body = []
    for row in rows:
        top = max(PARTIES, key=lambda party: row[party])
        link = f'<a href="{html.escape(row["pageUrl"])}">{html.escape(row["name"])}</a>'
        flag = ' <span class="new">New</span>' if row['newPage'] else ''
        if row['geography'] == 'County':
            names = cities[row['name'].removesuffix(' County')]
            listed = ', '.join(f'<a href="{html.escape(page_url(key))}">{html.escape(pages[key])}</a>' + (' <span class="new">New</span>' if key in new_pages else '') for key in names)
            city_cell = f'<details><summary>{len(names)} ({row["newCityPages"]} new)</summary><div class="cities">{listed}</div></details>' if names else '—'
        else:
            city_cell = f'{row["cityPages"]:,} ({row["newCityPages"]} new)'
        sort = f' data-sort="{len(names)}"' if row['geography'] == 'County' else ''
        cells = [f'<th scope="row">{link}{flag}</th>', f'<td class="page"{sort}>{city_cell}</td>', f'<td>{fmt(row["population2020"])}</td>', f'<td class="key">{fmt(row["active"])}</td>',
                 f'<td>{share(row)}</td>', f'<td>{fmt(row["inactive"])}</td>', f'<td>{fmt(row["total"])}</td>',
                 *[f'<td{" class=top" if party == top else ""}>{fmt(row[party])}</td>' for party in PARTIES]]
        body.append(f'<tr class="{row["geography"].lower()}"{" data-pin" if row["geography"] == "State" else ""}>{"".join(cells)}</tr>')
    party_heads = ''.join(f'<th scope="col">{html.escape(party)}</th>' for party in PARTIES)
    sources = data['sources']
    (directory / f'{stem}.html').write_text(f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Utah voter registration review · {data["asOf"]}</title>
<style>
body{{margin:3rem;padding:40px clamp(16px,4vw,48px);font:14px/1.45 system-ui,-apple-system,sans-serif;color:#1d2226;background:#f2f1ed}}
h1{{margin:0 0 6px;font:700 30px/1.1 Georgia,serif;letter-spacing:-.02em}}p{{max-width:880px;margin:0 0 10px;color:#5f5e59}}
.summary{{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0}}.summary div{{padding:14px 18px;background:#fff;border:1px solid #c8c6c0;min-width:150px}}
.summary small{{display:block;color:#5f5e59;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}}.summary strong{{font:700 26px/1.2 Georgia,serif}}
.wrap{{overflow-x:auto;background:#fff;border:1px solid #c8c6c0}}table{{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}}
th,td{{padding:7px 10px;border-bottom:1px solid #e3e1db;text-align:right;white-space:nowrap}}thead th{{position:sticky;top:0;background:#1d2226;color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase}}
tbody th{{text-align:left}}tr.state{{background:#fff7e0;font-weight:700}}td.key{{font-weight:700}}td.top{{background:#e8f1f8}}td.page{{text-align:left;white-space:normal;min-width:150px}}
.new{{display:inline-block;margin-left:4px;padding:0 5px;border-radius:3px;background:#2f7d4f;color:#fff;font:700 10px/16px system-ui;letter-spacing:.04em;text-transform:uppercase;vertical-align:1px}}
details summary{{cursor:pointer;color:#006eb7}}.cities{{margin-top:6px;max-width:420px;line-height:1.7}}tbody th a{{color:inherit}}
ul{{color:#5f5e59}}a{{color:#006eb7}}
</style>{SORTABLE}</head><body>
<h1>Utah voter registration</h1>
<p>Lieutenant Governor's office figures, last updated {datetime.fromisoformat(data["asOf"]).strftime("%B %-d, %Y")}. The state publishes active and inactive voters statewide, but only <strong>active</strong> voters by county. It publishes nothing by legislative district or city.</p>
<p>Every county links to its place page, where the voter card shows. “City and town pages” lists the county's municipal pages; they show no card because the state publishes no city figures. <span class="new">New</span> marks the {len(new_pages)} pages added by the 2023–2026 local-contest import. “Active ÷ pop.” compares active voters with the 2020 census population, which includes residents under 18. Shaded party cells are each row's largest party. Click any column heading to sort; the statewide row stays on top.</p>
<div class="summary"><div><small>Active statewide</small><strong>{fmt(state["active"])}</strong></div><div><small>Inactive statewide</small><strong>{fmt(state["inactive"])}</strong></div><div><small>Total registered</small><strong>{fmt(state["total"])}</strong></div><div><small>Place pages</small><strong>{len(pages)}</strong></div><div><small>County sum check</small><strong>{"Matches" if data["checks"]["countySumMatchesState"] else "Mismatch"}</strong></div></div>
<div class="wrap"><table><thead><tr><th scope="col" style="text-align:left">Geography</th><th scope="col" style="text-align:left">City and town pages</th><th scope="col">2020 pop.</th><th scope="col">Active</th><th scope="col">Active ÷ pop.</th><th scope="col">Inactive</th><th scope="col">Total</th>{party_heads}</tr></thead>
<tbody>{"".join(body)}</tbody></table></div>
<p style="margin-top:18px">Sources:</p><ul><li><a href="{html.escape(sources["statistics"])}">Current Voter Registration Statistics</a> (statewide table)</li><li><a href="{html.escape(sources["counties"])}">Active Voters by County and Party (PDF)</a></li></ul>
</body></html>
''')
    return directory / f'{stem}.csv', directory / f'{stem}-pages.csv', directory / f'{stem}.html'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reports', type=Path, help='also write CSV and HTML review reports to this directory')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    page = fetch(STATS_URL).decode('utf-8')
    as_of, state = statewide(page)
    pdf_url = re.search(r'href="(https://vote\.utah\.gov/[^"]*Active-Voters-by-County-and-Party\.pdf)"', page)
    if not pdf_url: raise SystemExit('County PDF link not found on the statistics page.')
    pdf = CACHE / Path(pdf_url.group(1)).name
    pdf.write_bytes(fetch(pdf_url.group(1)))
    text = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], check=True, capture_output=True, text=True).stdout
    counties = county_counts(text)

    # The county PDF must add up to the statewide active column, party by party.
    mismatches = [party for party in PARTIES if sum(row.get(party, 0) for row in counties.values()) != state['parties'].get(party, {}).get('active', 0)]
    county_total = sum(sum(row.values()) for row in counties.values())
    if mismatches or county_total != state['active']:
        raise SystemExit(f'County PDF does not match the statewide table (parties: {mismatches}; {county_total:,} vs {state["active"]:,}).')

    data = {
        'asOf': as_of,
        'sources': {'statistics': STATS_URL, 'counties': pdf_url.group(1)},
        'checks': {'countySumMatchesState': True},
        'state': state,
        'counties': {slug(name): {'name': f'{name} County', 'active': sum(row.values()), 'parties': {party: row[party] for party in PARTIES if row.get(party)}} for name, row in counties.items()},
    }
    OUTPUT.write_text(json.dumps(data, indent=1) + '\n')
    print(f'Saved registration as of {as_of}: {state["active"]:,} active, {state["total"]:,} total; {len(counties)} counties.')
    if args.reports:
        places = json.loads((ROOT / 'src/data/place-enrichment.json').read_text())
        for path in write_reports(args.reports, data, places): print(f'  wrote {path}')


if __name__ == '__main__': main()
