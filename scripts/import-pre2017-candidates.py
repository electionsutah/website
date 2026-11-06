#!/usr/bin/env python3
"""Backfill 2013–2016 ballot candidates from official state and county canvasses.

Run with --use-cache to reuse .firecrawl/pre2017 downloads. Requires pdftotext.
These are ballot rosters, not complete filing lists; no outcome is inferred.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import subprocess
from urllib.request import Request, urlopen

from generate_state_backfill import read_workbook, nearest_heading, parse_ballot_name, clean_office, slug, deduplicate

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firecrawl/pre2017'
STATE = 'https://vote.utah.gov/wp-content/uploads/2023/09/'
COUNTY = 'https://www.saltlakecounty.gov/globalassets/1-site-files/clerk/elections/election-results/historical-election-results/'
SOURCES = {
    '2016-general': STATE + '2016-General-Election-Statewide-Canvass.xlsx',
    '2016-primary': STATE + '2016-Primary-Election-State-Canvass-2-1.xlsx',
    '2014-general': STATE + '2014-General-Canvass-Report-1-1.xlsx',
    '2014-primary': STATE + '2014-Primary-Canvass-Reports-1.xlsx',
    '2015-general': COUNTY + '2015-11-03-municipal-general-election.pdf',
    '2015-primary': COUNTY + '2015-08-11-municipal-primary-election.pdf',
    '2013-general': COUNTY + '2013-11-05-municipal-general-election.pdf',
    '2013-primary': COUNTY + '2013-08-13-municipal-primary-election.pdf',
}
DATES = {'2016-general': '2016-11-08', '2016-primary': '2016-06-28',
         '2014-general': '2014-11-04', '2014-primary': '2014-06-24',
         '2015-general': '2015-11-03', '2015-primary': '2015-08-11',
         '2013-general': '2013-11-05', '2013-primary': '2013-08-13'}
CITIES = ['Alta', 'Bluffdale', 'Cottonwood Heights', 'Draper', 'Herriman', 'Holladay', 'Midvale', 'Murray',
          'Riverton', 'Salt Lake City', 'Sandy', 'South Jordan', 'South Salt Lake', 'Taylorsville', 'West Jordan', 'West Valley City']


def name_case(value):
    value = re.sub(r'\s+', ' ', value).strip()
    if value != value.upper(): return value
    value = value.title()
    value = re.sub(r'\bMc([a-z])', lambda m: 'Mc' + m[1].upper(), value)
    return re.sub(r'\b(Ii|Iii|Iv)\b', lambda m: m[0].upper(), value)


def office_name(value):
    value = re.sub(r'\s+', ' ', value).strip()
    value = re.sub(r'\s*-\s*Write-in Candidates$', '', value, flags=re.I)
    value = value.replace('Utah Governor', 'Governor')
    value = re.sub(r'^(State (?:House|Senate|School Board)) (\d+)$', r'\1 District \2', value)
    return clean_office(value)


def record(key, name, office, party='', city='', section=None):
    name = name_case(name)
    office = office_name(office)
    mate = ''
    if office in {'U.S. President & Vice President', 'Governor & Lieutenant Governor'} and ', ' in name:
        name, mate = name.split(', ', 1)
    return dict(id=slug(name), name=name, runningMate=mate, office=office, party=party,
                status='general_election' if key.endswith('general') else 'primary_election',
                sourceStatus='General Election Candidate' if key.endswith('general') else 'Primary Election Candidate',
                section=section or ('Municipal Offices' if city else 'State School Board' if office.startswith('State School Board') else 'State Senate' if office.startswith('State Senate') else 'State House' if office.startswith('State House') else 'State Offices'),
                year=int(key[:4]), electionType=key.split('-')[1], city=city, county='Salt Lake' if city else '', state='UT',
                source=SOURCES[key], lastUpdated=DATES[key],
                contact=dict(address='', phone='', email='', website='', facebook='', twitter=''))


def state_records(key, path):
    output = []
    primary = key.endswith('primary')
    for sheet, rows in read_workbook(path).items():
        if sheet in {'Cover', 'Con. Amend.', 'Constitutional Amendments', 'Straight Ticket', 'Straight Party', 'Voter Turnout'}: continue
        heading_row = 3 if key == '2014-primary' else 1
        candidate_row = 4 if primary else 2 if key == '2014-general' else 3
        first_column = 5 if key.startswith('2014') else 2
        headings = {c: v for c, v in rows.get(heading_row, {}).items() if c >= first_column}
        if sheet == 'Judicial':
            for heading in headings.values():
                if not heading: continue
                match = re.match(r'(.+?),?\s+((?:Utah Supreme Court|Utah Court of Appeals|\d+(?:st|nd|rd|th) District).*)$', heading)
                assert match, heading
                name, court = match.groups()
                item = record(key, name.rstrip(', '), ('Justice of the ' if 'Supreme' in court else 'Judge of the ') + court, section='State Judicial')
                item['sourceStatus'] = 'Judicial Retention Candidate'
                output.append(item)
            continue
        for col, candidate in rows.get(candidate_row, {}).items():
            if col < first_column or not candidate: continue
            heading = nearest_heading(headings, col)
            assert heading, (key, sheet, col, candidate)
            if primary:
                party = nearest_heading(rows.get(3, {}), col) if key.startswith('2016') else ''
                if key.startswith('2014'):
                    match = re.search(r' (Republican|Democratic)$', heading)
                    assert match, heading
                    party = match[1]; heading = heading[:match.start()]
                if party == 'Non-Partisan': party = ''
                name = candidate
            else:
                name, party = parse_ballot_name(candidate)
            output.append(record(key, name, heading, party))
    return output


def municipal_records(key, text):
    output = []
    office = city = ''
    for line in text.splitlines():
        line = line.strip()
        # Any new summary block resets the office, including ballot measures and districts.
        if re.match(r'^[A-Z][A-Z0-9 .#&()/-]+$', line) and not re.search(r'\s\d+\s+\d+\.\d+\s*%$', line):
            if re.search(r'COUNCIL|MAYOR|PROPOSITION|DISTRICT|BOARD|INITIATIVE|BOND', line):
                office = city = ''
                for candidate_city in sorted(CITIES, key=len, reverse=True):
                    prefix = candidate_city.upper()
                    if not line.startswith(prefix + ' '): continue
                    rest = line[len(prefix):].strip()
                    rest = re.sub(r'^CITY ', '', rest)
                    if not re.match(r'^(MAYOR|COUNCIL)\b', rest): continue
                    rest = re.sub(r'COUNCIL (\d+)$', r'COUNCIL DISTRICT \1', rest)
                    rest = re.sub(r' (\d) YEAR$', r' (\1-Year Term)', rest)
                    office = candidate_city + ' ' + rest.title().replace('At Large', 'at Large')
                    city = candidate_city
                    break
        match = re.match(r'(.+?)\s{2,}([\d,]+)\s+\d+\.\d+\s*%$', line)
        if not match or not office: continue
        name = match[1].strip().lstrip('*').strip()
        if name.lower() == 'write-in votes' or name.startswith(('Times Counted', 'Precincts Reporting')): continue
        output.append(record(key, name, office, city=city))
    assert output, key
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--use-cache', action='store_true')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    additions = []
    for key, url in SOURCES.items():
        path = CACHE / (key + Path(url).suffix)
        if not args.use_cache or not path.exists():
            with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60) as response:
                path.write_bytes(response.read())
        if path.suffix == '.xlsx': rows = state_records(key, path)
        else:
            text = subprocess.check_output(['pdftotext', '-layout', str(path), '-'], text=True)
            rows = municipal_records(key, text)
        additions.extend(rows)
        print(f'{key}: {len(rows)} ballot entries')
    additions = deduplicate(additions)
    assert all(r['name'] and r['office'] and r['source'] for r in additions)
    output = ROOT / 'src/data/historical-candidates.json'
    existing = [r for r in json.loads(output.read_text()) if r['year'] not in {2013, 2014, 2015, 2016}]
    output.write_text(json.dumps(deduplicate(existing + additions), ensure_ascii=False, indent=2) + '\n')
    print(f'Added {len(additions)} distinct candidate/office/year/party records: {dict(sorted(Counter(r["year"] for r in additions).items()))}')


if __name__ == '__main__': main()
