#!/usr/bin/env python3
"""Import county, municipal, school-board, and special-district candidates from Utah's results API.

python3 scripts/import-local-contests.py [--use-cache] [--reports DIR]

electionresults.utah.gov publishes every county's local contests for the elections
it hosts (the 2023 municipal elections onward). Each county's ballot items are read for the primaries and
generals below; statewide and multi-county state contests (which carry a parentId)
are skipped because the state filing lists already cover them, as are ballot
measures and judicial retention questions.

Each candidate becomes one filing per office and year, in the same shape as
src/data/historical-candidates.json, written to src/data/local-candidates.json.
A primary and general for the same office merge into one record whose status
comes from the last contest the candidate appeared in. Winners come from vote
counts and the published "Vote for N" seats, since the feed rarely flags them;
unofficial results (the 2026 general until canvass) and multi-seat contests whose seat
count the feed omits (most of 2023) leave general candidates as "General Election Candidate".

Municipal contests are matched to official municipality names from UGRC's
municipal boundaries layer. With --reports, writes a CSV and an HTML review table.
Raw responses stay in the ignored .firecrawl/ directory.
"""
import argparse
import csv
import html
import json
import re
import time
import unicodedata
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from report_sort import SORTABLE

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firecrawl' / 'local-results'
OUTPUT = ROOT / 'src' / 'data' / 'local-candidates.json'
API = 'https://electionresults.utah.gov/results/public/api/elections'
PUBLIC = 'https://electionresults.utah.gov/results/public'
MUNICIPALITIES = 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahMunicipalBoundaries/FeatureServer/0/query'
HEADERS = {'User-Agent': 'ElectionsUtah/1.0 (https://www.electionsutah.org/; local contests)'}
# (election id, year, type, date), as listed by /api/jurisdictions/Utah. Earlier elections are not on this system.
ELECTIONS = [
    ('primary09052023_Demo', 2023, 'primary', '2023-09-05'),  # the state's ID for the 2023 municipal primary
    ('2023-Nov-General', 2023, 'general', '2023-11-21'),
    ('Primary06252024', 2024, 'primary', '2024-06-25'),
    ('General11052024', 2024, 'general', '2024-11-05'),
    ('Primary08122025', 2025, 'primary', '2025-08-12'),
    ('General11042025', 2025, 'general', '2025-11-04'),
    ('Primary06232026', 2026, 'primary', '2026-06-23'),
    ('General11032026', 2026, 'general', '2026-11-03'),
]
COUNTIES = ['Beaver', 'Box Elder', 'Cache', 'Carbon', 'Daggett', 'Davis', 'Duchesne', 'Emery', 'Garfield', 'Grand', 'Iron', 'Juab', 'Kane', 'Millard', 'Morgan', 'Piute',
            'Rich', 'Salt Lake', 'San Juan', 'Sanpete', 'Sevier', 'Summit', 'Tooele', 'Uintah', 'Utah', 'Wasatch', 'Washington', 'Wayne', 'Weber']
PARTIES = {'REPUBLICAN': 'Republican', 'REPUBLICAN PARTY': 'Republican', 'DEMOCRATIC': 'Democratic', 'DEMOCRATIC PARTY': 'Democratic', 'UNAFFILIATED': 'Unaffiliated',
           'CONSTITUTION': 'Constitution', 'LIBERTARIAN': 'Libertarian', 'LIBERTARIAN PARTY': 'Libertarian', 'FORWARD': 'Forward', 'FORWARD PARTY': 'Forward', 'UTAH FORWARD': 'Forward',
           'INDEPENDENT AMERICAN': 'Independent American', 'UNITED UTAH': 'United Utah', 'GREEN': 'Green'}
NONPARTISAN = {'', 'NONPARTISAN', 'NON-PARTISAN'}
# Ballot-name prefixes some counties use for the candidate's party ("REP JESSE PLATT").
NAME_PARTY = {'REP': 'Republican', 'DEM': 'Democratic', 'UNA': 'Unaffiliated', 'CON': 'Constitution', 'LIB': 'Libertarian', 'IAP': 'Independent American', 'FWD': 'Forward', 'GRN': 'Green'}
# Fruit Heights' nonpartisan caucus labels also appear in 2025 ballot names.
LOCAL_NAME_PARTY = {'PIN': 'Pinecone', 'SAG': 'Sagebrush'}
ACRONYMS = {'EMS', 'SSD', 'ID', 'II', 'III', 'IV', 'USU', 'UTA', 'SID', 'MWD', 'WCD', 'SD', 'RSD', 'CWD', 'PID'}
SMALL = {'and', 'of', 'at', 'the', 'for', 'to', 'in', 'on'}
# Source spellings of municipality names, corrected before matching.
CITY_ALIASES = [(r'^Mt\.? Pleasant\b', 'Mount Pleasant'), (r'^St\.? George\b', 'St. George'), (r'^Granstville\b', 'Grantsville')]
# UGRC names that the archive already files under a shorter name (Magna is a metro township).
CITY_NAMES = {'Magna City': 'Magna'}
COUNTY_OFFICES = r'commission|council|clerk|auditor|sheriff|attorney|district attorney|assessor|recorder|treasurer|surveyor|justice court|mayor|controller|executive'
# State and federal contests that some county feeds repeat without a parentId; the state filings cover them.
STATE_CONTESTS = r'^(?:(?:republican|democratic) )?(?:state (?:house|senate|school board)|(?:senate|house) district|u\.?\s?s\.?\s|united states|congress|governor|attorney general|state (?:auditor|treasurer))'


def fetch_json(url, cache_name, use_cache):
    path = CACHE / cache_name
    if use_cache and path.exists(): return json.loads(path.read_text() or 'null')
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers=HEADERS), timeout=60) as response: body = response.read()
            path.write_bytes(body)
            return json.loads(body or b'null')
        except Exception:
            if attempt == 2: raise
            time.sleep(attempt + 1)


def text(value):
    if isinstance(value, str): return value
    return next((x['text'] for x in value or [] if (x.get('languageId') or '').startswith('en')), next((x['text'] for x in value or []), ''))


def slug(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def squash(value):
    return re.sub(r'\s+', ' ', value or '').strip()


def person_case(value):
    """Ballot names are often upper case: "GINGER MCMULLIN" -> "Ginger McMullin"."""
    value = squash(value)
    if value != value.upper() and value != value.lower(): return value
    def word(token):
        if token.upper() in {'II', 'III', 'IV'}: return token.upper()
        low = token.lower()
        out = re.sub(r"(^|[-'’])([a-z])", lambda m: m.group(1) + m.group(2).upper(), low)
        return re.sub(r'^Mc([a-z])', lambda m: 'Mc' + m.group(1).upper(), out)
    return ' '.join(word(token) for token in value.split(' '))


def office_case(value):
    words = squash(value).split(' ')
    out = []
    for index, token in enumerate(words):
        bare = token.strip('(),#')
        if bare.upper() in ACRONYMS or re.fullmatch(r'[A-Z]', bare) or re.fullmatch(r'\d+[A-Z]?', bare): out.append(token.upper() if bare.upper() in ACRONYMS else token); continue
        low = token.lower()
        if index and low in SMALL: out.append(low); continue
        out.append(re.sub(r"(^|[-/(])([a-z])", lambda m: m.group(1) + m.group(2).upper(), low))
    return ' '.join(out)


def tidy_seat(value):
    """Shared wording fixes: terms, at-large, seat numbers."""
    value = re.sub(r'\b(\d)\s*-?\s*(?:year|yr)s?(?:\s*term)?\b', lambda m: f'({m.group(1)}-Year Term)', value, flags=re.I)
    value = re.sub(r'\(?\b(Two|Four|Six) (?:Years?|Yrs?)(?: Term)?\)?', lambda m: f"({ {'two': 2, 'four': 4, 'six': 6}[m.group(1).lower()]}-Year Term)", value, flags=re.I)
    value = re.sub(r'\(\s*\((\d-Year Term)\)\s*\)', r'(\1)', value)
    value = re.sub(r'\s*Special\s*\((\d-Year Term)\)\s*Seat\b', r' (\1)', value, flags=re.I)
    value = value.replace(',', '')
    value = re.sub(r'-\s*\(', ' (', value)
    # Ranked-choice ballots published one item per ranking ("Lehi City Council 3rd Choice"): one office.
    value = re.sub(r'\s+\d+(?:st|nd|rd|th) (?:Choice|Preference)\b.*$', '', value, flags=re.I)
    value = re.sub(r'\b(\w+(?: \w+)?) \1$', r'\1', value)  # "Council Seats Council Seats"
    value = re.sub(r'\bCouncil Seats\b', 'Council', value, flags=re.I)
    value = re.sub(r'\bat[- ]large\b', 'at Large', value, flags=re.I)
    value = re.sub(r'\bdist\.?\s', 'District ', value, flags=re.I)
    value = re.sub(r'#\s*(\d+)', r'\1', value)
    value = re.sub(r'\bseat\s+no\.?\s*', 'Seat ', value, flags=re.I)
    value = re.sub(r'\b(?:council ?members?|councilmembers?|council person)\b', 'Council', value, flags=re.I)
    return squash(value.replace(' - ', ' ').replace(' -', ' ').replace('–', ' '))


def municipalities(use_cache):
    data = fetch_json(MUNICIPALITIES + '?' + urlencode({'where': '1=1', 'outFields': 'NAME,COUNTYNBR', 'returnGeometry': 'false', 'f': 'json'}), 'municipalities.json', use_cache)
    by_county = defaultdict(set)
    for feature in data['features']:
        attributes = feature['attributes']
        by_county[COUNTIES[int(attributes['COUNTYNBR']) - 1]].add(squash(attributes['NAME']))
    return by_county


def classify(raw, county, cities, year):
    """Return (section, office, city) for a candidate contest, or None to skip it."""
    name = tidy_seat(squash(raw))
    for pattern, replacement in CITY_ALIASES: name = re.sub(pattern, replacement, name, flags=re.I)
    party = None
    name = re.sub(r'["“”]', '', name)
    # "Bountiful City Council Bountiful City": drop a trailing repeat of the leading place name.
    for size in (4, 3, 2, 1):
        lead = ' '.join(name.split(' ')[:size])
        trimmed = re.sub(rf'\s+{re.escape(lead)}(?: City| Town)?$', '', name, flags=re.I)
        if trimmed != name and len(trimmed.split(' ')) > size: name = trimmed; break
    words = name.split(' ')
    # A few feeds repeat the contest name with different seat wording; keep the second copy.
    for index in range(3, len(words) - 2):
        if len(words) - index >= 4 and [w.upper() for w in words[index:index + 3]] == [w.upper() for w in words[:3]]: name = ' '.join(words[index:]); break
    marker = re.match(r'^(REP|DEM)\s+(.+)$', name, flags=re.I) or re.match(r'^(Democratic|Republican) Candidate for\s+(.+)$', name, flags=re.I)
    if marker: party, name = ('Republican' if marker.group(1).upper().startswith('REP') else 'Democratic'), marker.group(2)
    marker = re.match(r'^(.+?)\s*\((REP|DEM|R|D)\)$', name, flags=re.I)
    if marker: name, party = marker.group(1), 'Republican' if marker.group(2).upper().startswith('R') else 'Democratic'
    match = re.match(r'^(Republican|Democratic|Libertarian|Constitution|Unaffiliated|Forward|Independent American|United Utah)(?: Party)?(?: Primary)?(?: for| -|:)\s+(.+)$', name, flags=re.I)
    if match: party, name = PARTIES.get(match.group(1).upper(), match.group(1).title()), match.group(2)
    if re.search(r'retention|retain|proposition|referendum|bond|initiative|amendment|\bleeway\b|\bmeasure\b|form of government', name, flags=re.I): return None
    if re.search(STATE_CONTESTS, name, flags=re.I): return None
    name = re.sub(r'\s+County$', '', name)
    upper = name.upper()
    # Municipal: the contest starts with one of the county's municipalities.
    for city in sorted(cities, key=len, reverse=True):
        for prefix in (f'CITY OF {city.upper()} ', f'TOWN OF {city.upper()} ', f'{city.upper()} '):
            if upper.startswith(prefix) and not re.search(r'\bschool\b|\bcounty\b(?! council)', name[len(prefix):], flags=re.I):
                if city.upper() == county.upper() and re.search(rf'^{re.escape(county)}\s+(?:county\b|{COUNTY_OFFICES}|school)', name, flags=re.I) and not re.search(r'mayor|city|town', name, flags=re.I):
                    break
                rest = office_case(name[len(prefix):])
                # Local districts named after a city ("Kearns Improvement District") are not municipal offices.
                if re.search(r'district|trustee|water|improvement|recreation|cemetery|fire', rest, flags=re.I) and not re.search(r'council', rest, flags=re.I):
                    return 'Special District Offices', office_case(name), '', party
                rest = re.sub(r'^City Council City ?Wide', 'City Wide', rest)
                rest = re.sub(r'^(?:City |Town )?Council (\d+)$', r'Council District \1', rest)
                rest = re.sub(r'^((?:City|Town) Council) Board Members?$', r'\1', rest)
                rest = re.sub(r'^(City|Town) (Mayor)$', r'\2', rest)
                rest = re.sub(r'^(City|Town) Council (District|Seat|at Large)', r'Council \2', rest)
                city = CITY_NAMES.get(city, city)
                return 'Municipal Offices', f'{city} {rest}', city, party
    if re.search(r'\bschool\b|\bboard of education\b', name, flags=re.I):
        named = re.match(r'^School Board ([A-Za-z]+(?: [A-Za-z]+)?) (\d+|[A-Z])$', name, flags=re.I)
        if named and named.group(1).lower() not in {'district', 'seat', 'precinct', 'no'}: return 'School Board Offices', f'{office_case(named.group(1))} School Board District {named.group(2).upper()}', '', party
        name = re.sub(r'\s+Local\s+School', ' School', name, flags=re.I)
        district = re.match(r'^(.+?)\s+(?:County\s+)?School\s+(?:District|Board)\b', name, flags=re.I)
        prefix = office_case(district.group(1)) if district and district.group(1).lower() not in {'county', 'local'} else county
        prefix = re.sub(r'\s+County$', '', prefix)
        after = name[district.end() if district else 0:]
        seat = re.search(r'(?:district|precinct|seat|board|no\.?|#)\s*(\d+|[A-Z])\b(?!\w)', after, flags=re.I) or re.search(r'^\s*(\d+|[A-Z])\b(?!\w)', after) or re.search(r'(\d+)\s*$', name)
        at_large = re.search(r'at Large', name, flags=re.I)
        tail = f' District {seat.group(1).upper()}' if seat else (' at Large' if at_large else '')
        term = re.search(r'\(\d-Year Term\)', name)
        return 'School Board Offices', f'{prefix} School Board{tail}{" " + term.group(0) if term else ""}', '', party
    # County offices: strip any "<County> County" / "County" lead-in, then name it once.
    rest = re.sub(rf'^(?:{re.escape(county)}\s+County|{re.escape(county)}|County)\s+', '', name, flags=re.I)
    if re.match(rf'^(?:{COUNTY_OFFICES})', rest, flags=re.I) and not re.search(r'\bdistrict board\b|\bservice area\b|\bspecial service\b|\bfire\b|\bwater\b|\bcemetery\b', rest, flags=re.I):
        rest = office_case(rest)
        rest = re.sub(r'^Commissioner\s+(?:Seat\s+)?([A-Z0-9]\b)', r'Commission Seat \1', rest)
        rest = re.sub(r'^Commission\s+(?!Seat|District|at)([A-Z0-9]\b)', r'Commission Seat \1', rest)
        rest = re.sub(r'^Commissioner$', 'Commission', rest)
        rest = re.sub(r'^Commissioner (District|at Large)', r'Commission \1', rest)
        rest = re.sub(r'^Council (\d+)$', r'Council District \1', rest)
        rest = rest.replace('Clerk-Auditor', 'Clerk/Auditor')
        rest = re.sub(r'^Council (Logan|North|Northeast|South|Southeast) (\d)\b', r'Council \1 Seat \2', rest)
        rest = re.sub(r'\s*/\s*', '/', rest)
        return 'County Offices', f'{county} County {rest}', '', party
    if year % 2 == 1 and re.search(r'\bmayor\b|\bcouncil\b', name, flags=re.I):
        # "City Wide 2 - Provo City Council": the seat first, the municipality after it.
        for city in sorted(cities, key=len, reverse=True):
            trailing = re.match(rf'^(.+?)\s+{re.escape(city)}(?: City| Town)? Council$', name, flags=re.I)
            if trailing: return 'Municipal Offices', f'{CITY_NAMES.get(city, city)} {office_case(trailing.group(1))}', CITY_NAMES.get(city, city), party
        return 'Unmatched', office_case(name), '', party
    return 'Special District Offices', office_case(name), '', party


def candidate_name(option):
    """Separate named write-ins from aggregate/invalid ballot responses."""
    name = squash(text(option['name']))
    marker = re.match(r'^write[- ]?ins?\b', name, flags=re.I)
    if marker:
        name = name[marker.end():].strip(' :-()')
    if not name or name.lower() in {'not assigned', 'unassigned', 'invalid', 'not valid', 'delete'}:
        return ''
    return name


def candidate_party(option, contest_party):
    name = candidate_name(option)
    raw = squash(text((option.get('party') or {}).get('name'))).upper()
    prefix = re.match(r'^(REP|DEM|UNA|CON|LIB|IAP|FWD|GRN)\s+(.+)$', name)
    party = contest_party or (PARTIES.get(raw) if raw not in NONPARTISAN else '') or (raw.title() if raw not in NONPARTISAN else '')
    if prefix:
        name = prefix.group(2)
        party = party or NAME_PARTY[prefix.group(1)]
    local_prefix = re.match(r'^(PIN|SAG)\s+(.+)$', name, flags=re.I)
    if local_prefix and raw == LOCAL_NAME_PARTY[local_prefix.group(1).upper()].upper():
        name = local_prefix.group(2)
    return person_case(name), party


def seats(item, office):
    """Seats from the published "Vote for N"; None when the feed omits it and the office may fill several."""
    match = re.search(r'\d+', text(item.get('voteFor')))
    if match: return max(1, int(match.group()))
    # The 2023 feed has no seat counts. A mayor or a numbered district or seat is a single seat.
    if re.search(r'mayor|district [0-9a-z]+\b|seat [0-9a-z]+\b|commission|sheriff|clerk|attorney|assessor|recorder|treasurer|surveyor', office, flags=re.I) and not re.search(r'choice|preference', text(item['name']), flags=re.I): return 1
    return None


def options_of(item):
    if item.get('summaryResults'): return item['summaryResults']['ballotOptions']
    rounds = item.get('rankedChoiceSummaryResults') or []
    return rounds[-1]['ballotOptions'] if rounds else []


def deduplicate_contests(contests):
    """Only collapse matching candidate slates repeated across counties."""
    groups = defaultdict(list)
    for contest in contests:
        slate = tuple(sorted((slug(candidate_party(entry['option'], entry['party'])[0]),
                              candidate_party(entry['option'], entry['party'])[1])
                             for entry in contest['candidates']))
        groups[(contest['election'], contest['office'], contest['seats'], slate)].append(contest)
    retained = set()
    for group in groups.values():
        # Older ranked-choice feeds repeat the same slate for each preference.
        # Preserve the existing representative (the item with the most votes).
        if all(re.search(r'\d+(?:st|nd|rd|th) (?:Choice|Preference)\b', contest.get('raw', ''), flags=re.I) for contest in group):
            by_county = defaultdict(list)
            for contest in group: by_county[contest['county']].append(contest)
            group = [max(copies, key=lambda contest: contest['total']) for copies in by_county.values()]
        counties = Counter(contest['county'] for contest in group)
        if len(counties) > 1 and max(counties.values()) == 1:
            retained.add(id(max(group, key=lambda contest: contest['total'])))
        else:
            # Separate seats and party primaries in one county must survive, even
            # when their normalized office names happen to be identical.
            retained.update(id(contest) for contest in group)
    return [contest for contest in contests if id(contest) in retained]


def reconcile_primary_offices(contests):
    """Resolve a primary's office using its own slate, never another primary's."""
    general_offices = defaultdict(set)
    for contest in contests:
        if contest['kind'] != 'general': continue
        for entry in contest['candidates']:
            name, _ = candidate_party(entry['option'], entry['party'])
            general_offices[(contest['year'], contest['county'], slug(name))].add(contest['office'])
    for contest in contests:
        if contest['kind'] != 'primary': continue
        targets = set()
        for entry in contest['candidates']:
            name, _ = candidate_party(entry['option'], entry['party'])
            targets.update(general_offices.get((contest['year'], contest['county'], slug(name)), set()))
        if len(targets) == 1:
            target = next(iter(targets))
            if target.startswith(contest['office'] + ' '): contest['office'] = target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--use-cache', action='store_true')
    parser.add_argument('--reports', type=Path)
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    cities = municipalities(args.use_cache)
    contests, skipped = [], Counter()
    for election, year, kind, date in ELECTIONS:
        state = fetch_json(f'{API}/Utah/{election}/data', f'Utah_{election}_data.json', args.use_cache)
        official = bool(state['election'].get('isOfficialResults'))
        # Results from earlier years are long canvassed even where the feed was never marked official.
        final = official or year < 2026
        localities = [(row['shortName'], text(row['name'])) for row in state['jurisdiction']['childLocalities']]
        def load(locality):
            return locality, fetch_json(f'{API}/{locality[0]}/{election}/data', f'{locality[0]}_{election}_data.json', args.use_cache)
        with ThreadPoolExecutor(6) as pool: loaded = list(pool.map(load, localities))
        for (locality, label), data in loaded:
            county = re.sub(r'\s+County.*$', '', label).strip()
            if county not in COUNTIES: raise SystemExit(f'Unknown county locality: {label}')
            for item in (data or {}).get('ballotItems', []):
                if item.get('parentId'): continue
                options = options_of(item)
                labels = {squash(text(o['name'])).upper() for o in options}
                if item.get('contestType') == 'BallotMeasure' or labels & {'YES', 'NO', 'FOR', 'AGAINST'}: skipped['ballot measure or retention'] += 1; continue
                result = classify(text(item['name']), county, cities[county], year)
                if not result: skipped['ballot measure or retention'] += 1; continue
                section, office, city, contest_party = result
                if section == 'Unmatched':
                    # Generic "CITY COUNCIL" contests: the precincts that voted on it name the municipality.
                    detail = fetch_json(f'{API}/{locality}/{election}/data/ballot-item/{item["id"]}', f'{locality}_{election}_item_{item["id"]}.json', args.use_cache)
                    found = Counter()
                    for row in (detail or {}).get('ballotItemWithBreakdown', {}).get('breakdownResults') or []:
                        precinct = text((row.get('precinct') or {}).get('name')).upper()
                        match = next((c for c in sorted(cities[county], key=len, reverse=True) if precinct.startswith(c.upper())), None)
                        if match: found[match] += row.get('voteTotal') or 0
                    if len(found) == 1:
                        city = CITY_NAMES.get(next(iter(found)), next(iter(found)))
                        section, office = 'Municipal Offices', f'{city} {office_case(tidy_seat(squash(text(item["name"]))))}'
                # General-election placeholders with no votes at all (a second "Town of Bluff" contest) are dropped.
                # The 2023 primary feed lists every ballot but no votes; it still shows who did not advance.
                if final and kind == 'general' and not any(o.get('voteCount') for o in options): skipped['empty contest'] += 1; continue
                options = [option for option in options if candidate_name(option)]
                ranked = sorted(options, key=lambda o: -(o.get('voteCount') or 0))
                count = seats(item, office)
                winners = {o['id'] for o in ranked[:count]} if kind == 'general' and final and count else set()
                contests.append({'election': election, 'year': year, 'kind': kind, 'date': date, 'final': final, 'county': county, 'locality': locality,
                                 'raw': squash(text(item['name'])), 'section': section, 'office': office, 'city': city, 'id': item['id'],
                                 'total': item.get('voteTotal') or 0, 'seats': count, 'contestType': item.get('contestType'),
                                 'candidates': [{'option': o, 'party': contest_party, 'won': o['id'] in winners, 'votes': o.get('voteCount') or 0} for o in options]})

    contests = deduplicate_contests(contests)
    reconcile_primary_offices(contests)

    records = {}
    for contest in sorted(contests, key=lambda c: c['date']):
        for entry in contest['candidates']:
            raw_name = squash(text(entry['option']['name']))
            name, party = candidate_party(entry['option'], entry['party'])
            key = (contest['year'], contest['office'], slug(name))
            source = f"{PUBLIC}/{contest['locality']}/elections/{contest['election']}/ballot-items/{contest['id']}"
            if contest['kind'] == 'general':
                decided = contest['final'] and contest['seats']
                status, label = ('elected', 'Elected') if entry['won'] else (('defeated', 'Defeated') if decided else ('general_election', 'General Election Candidate'))
            else:
                status, label = ('defeated', 'Out in Primary')  # replaced if the candidate reaches the general
            if re.match(r'^write[- ]?in\b', raw_name, flags=re.I) or entry['option'].get('isWriteIn') or entry['option'].get('isQualifiedWriteIn'):
                label += ' (Write-in)'
            previous = records.get(key)
            records[key] = {
                'id': slug(name), 'name': name, 'office': contest['office'], 'party': party or (previous or {}).get('party', ''),
                'status': status, 'sourceStatus': label, 'section': contest['section'], 'year': contest['year'], 'electionType': contest['kind'],
                'city': contest['city'], 'county': contest['county'], 'state': 'UT', 'source': source, 'lastUpdated': contest['date'],
                'votes': entry['votes'], 'contestVotes': contest['total'], 'seats': contest['seats'], 'rawOffice': contest['raw'],
                'contact': {'address': '', 'phone': '', 'email': '', 'website': '', 'facebook': '', 'twitter': ''},
            }
    rows = sorted(records.values(), key=lambda r: (r['year'], r['county'], r['office'], r['name']))
    unmatched = [r for r in rows if r['section'] == 'Unmatched']
    output = [{key: value for key, value in row.items() if key not in {'votes', 'contestVotes', 'seats', 'rawOffice'}} for row in rows if row['section'] != 'Unmatched']
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=1) + '\n')
    print(f'Saved {len(output)} local filings from {len(contests)} contests; skipped {dict(skipped)}; {len(unmatched)} unmatched rows.')
    print('  by section:', dict(Counter(r['section'] for r in output)))
    print('  by year:', dict(sorted(Counter(r['year'] for r in output).items())))
    for row in unmatched[:40]: print('  unmatched:', row['county'], '|', row['rawOffice'])
    if args.reports: write_reports(args.reports, rows)


def write_reports(directory, rows):
    directory.mkdir(parents=True, exist_ok=True)
    fields = ['year', 'county', 'section', 'office', 'rawOffice', 'city', 'name', 'party', 'status', 'sourceStatus', 'electionType', 'votes', 'contestVotes', 'seats', 'source']
    with (directory / 'local-candidates.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction='ignore')
        writer.writeheader(); writer.writerows(rows)
    by_county = defaultdict(Counter)
    for row in rows: by_county[row['county']][(row['year'], row['section'])] += 1
    years = sorted({row['year'] for row in rows})
    sections = ['County Offices', 'Municipal Offices', 'School Board Offices', 'Special District Offices', 'Unmatched']
    head = ''.join(f'<th>{year}<br><small>{html.escape(section.replace(" Offices", ""))}</small></th>' for year in years for section in sections[:4])
    def link(path, label):
        return f'<a href="https://www.electionsutah.org/{html.escape(path, quote=True)}/">{html.escape(str(label))}</a>'

    def office_link(office, label=None):
        # Match cleanOfficeName in src/lib/entities.ts before building the office route.
        clean = re.sub(r'\s+\(Multi[- ]County\)', '', office, flags=re.I)
        clean = clean.replace('Distrct', 'District', 1).replace('Distirct', 'District', 1)
        clean = re.sub(r'^US Congressional', 'U.S. House', clean)
        clean = re.sub(r'^(U\.S\. House|State Senate|State House|State School Board) (\d+)', r'\1 District \2', clean)
        return link(f'offices/{slug(clean)}', office if label is None else label)

    body = ''.join(f'<tr><th>{link(f"places/{slug(county)}", county)}</th>' + ''.join(f'<td data-sort="{by_county[county][(year, section)]}">{link(f"places/{slug(county)}", by_county[county][(year, section)]) if by_county[county][(year, section)] else "—"}</td>' for year in years for section in sections[:4]) + '</tr>' for county in COUNTIES)
    offices = defaultdict(set)
    for row in rows: offices[(row['section'], row['office'])].add(row['rawOffice'])
    # Local candidates who share a name with someone already in the archive are joined into one person on the site.
    def key(value): return re.sub(r'[^a-z0-9]', '', slug(value))
    existing = defaultdict(set)
    historical = json.loads((ROOT / 'src/data/historical-candidates.json').read_text())
    current = [{**row, 'year': 2026} for row in json.loads((ROOT / 'src/data/2026-candidates.json').read_text())]
    for row in historical + current: existing[key(row['name'])].add((row['year'], row['office']))
    # The site chooses the latest spelling, with later filings breaking ties.
    person_names = {}
    for row in historical + [r for r in rows if r['section'] != 'Unmatched'] + current:
        for name in filter(None, (row['name'], row.get('runningMate'))):
            k = key(name)
            if k not in person_names or row['year'] >= person_names[k][0]:
                person_names[k] = (row['year'], name)

    shared = defaultdict(set)
    for row in rows:
        if key(row['name']) in existing: shared[(row['name'], key(row['name']))].add((row['year'], row['office']))
    def race_links(records):
        return ' · '.join(office_link(office, f'{year} {office}') for year, office in sorted(records, key=lambda record: f'{record[0]} {record[1]}'))

    matches = ''.join(f'<tr><td>{link(f"people/{slug(person_names[k][1])}", name)}</td><td>{race_links(existing[k])}</td><td>{race_links(local)}</td></tr>' for (name, k), local in sorted(shared.items()))
    mapping = ''.join(f'<tr><td>{html.escape(section)}</td><td>{office_link(office) if section != "Unmatched" else html.escape(office)}</td><td>{html.escape(" · ".join(sorted(raw)))}</td></tr>' for (section, office), raw in sorted(offices.items()))
    (directory / 'local-candidates.html').write_text(f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Local contests import review</title>
<style>body{{margin:3rem;padding:32px;font:13px/1.45 system-ui,sans-serif;color:#1d2226;background:#f2f1ed}}h1{{font:700 28px Georgia,serif;margin:0 0 6px}}h2{{font:700 20px Georgia,serif;margin:28px 0 8px}}p{{color:#5f5e59;max-width:900px}}
table{{border-collapse:collapse;background:#fff;border:1px solid #c8c6c0}}th,td{{padding:5px 8px;border-bottom:1px solid #e3e1db;text-align:right;white-space:nowrap}}thead th{{background:#1d2226;color:#fff;font-size:11px;position:sticky;top:0}}tbody th{{text-align:left}}
.map td{{text-align:left;white-space:normal;max-width:520px}}.wrap{{overflow-x:auto}}</style>{SORTABLE}</head><body>
<h1>Local contests import</h1><p>{len(rows)} candidate records from electionresults.utah.gov (2023 municipal primary through 2026 general). Counts are candidate records per county, year, and office type. The second table shows how each source contest name was normalized into an office name, so naming mistakes are easy to spot. The full list with votes and source links is in <a href="local-candidates.csv">local-candidates.csv</a>. Click any column heading to sort.</p>
<div class="wrap"><table><thead><tr><th>County</th>{head}</tr></thead><tbody>{body}</tbody></table></div>
<h2>Same name as an existing person ({len(shared)})</h2><p>These local candidates share a name with someone already in the archive, so the site joins them into one person. Most are the same people (council members who later ran for the Legislature). Flag any that are different people.</p>
<div class="wrap"><table class="map"><thead><tr><th>Name</th><th>Existing records</th><th>New local records</th></tr></thead><tbody>{matches}</tbody></table></div>
<h2>Office names</h2><div class="wrap"><table class="map"><thead><tr><th>Type</th><th>Office on the site</th><th>Source contest names</th></tr></thead><tbody>{mapping}</tbody></table></div></body></html>''')
    print(f'  wrote {directory / "local-candidates.csv"} and .html')


if __name__ == '__main__': main()
