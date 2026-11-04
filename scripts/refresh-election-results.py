#!/usr/bin/env python3
"""Import the complete 2026 general results from Utah's public results API.

Run: python3 scripts/refresh-election-results.py [--use-cache]
Raw responses are cached in .firecrawl/results/. A failed import never replaces
our last good snapshot. County breakdowns come from the statewide publication;
local-only contests come from the county publications.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import time
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firecrawl/results'
API = 'https://electionresults.utah.gov/results/public/api'
SOURCE = 'https://electionresults.utah.gov/results/public/Utah/General11032026'
ELECTION = 'General11032026'

def text(value):
    return next((x['text'] for x in value or [] if (x.get('languageId') or '').startswith('en')), next((x['text'] for x in value or []), ''))

def options(rows):
    return sorted([{'id': x['id'], 'name': text(x['name']), 'votes': x['voteCount'],
                    'party': text((x.get('party') or {}).get('name')),
                    'winner': x.get('isWinner')} for x in rows], key=lambda x: -x['votes'])

def category(name):
    for prefix, label in [('U.S. House', 'U.S. House'), ('State Senate', 'State Senate'), ('State House', 'State House'), ('State School', 'School board')]:
        if name.startswith(prefix): return label
    if 'retained' in name.lower(): return 'Judicial retention'
    return 'Local & measures'

def contest(row, county=None):
    name = text(row['name'])
    return {'id': row['id'], 'name': name, 'category': category(name), 'county': county,
            'total': row['voteTotal'], 'reporting': row.get('reportingStatus'),
            'options': options(row['summaryResults']['ballotOptions']),
            'source': f"{SOURCE.split('/Utah/')[0]}/{county or 'Utah'}/elections/{ELECTION}/ballot-items/{row['id']}",
            'counties': []}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--use-cache', action='store_true')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    def fetch(path):
        file = CACHE / (path.replace('/', '_') + '.json')
        if args.use_cache and file.exists(): return json.loads(file.read_text())
        for attempt in range(3):
            try:
                with urlopen(Request(API + path, headers={'User-Agent': 'ElectionsUtah-Labs/1.0'}), timeout=60) as response:
                    data = json.load(response)
                file.write_text(json.dumps(data))
                return data
            except Exception:
                if attempt == 2: raise
                time.sleep(attempt + 1)
    state = fetch(f'/elections/Utah/{ELECTION}/data')
    assert state['election']['electionDate'] == '2026-11-03'
    counties = [{'id': x['shortName'], 'name': text(x['name']), 'asOf': None} for x in state['jurisdiction']['childLocalities']]
    rows = state['ballotItems']
    def detail(row):
        item = contest(row)
        result = fetch(f"/elections/Utah/{ELECTION}/data/ballot-item/{row['id']}")['ballotItemWithBreakdown']
        # Use the totals and breakdown from the same publication.
        item.update(total=result['voteTotal'], options=options(result['summaryResults']['ballotOptions']), reporting=result['reportingStatus'])
        for x in result.get('breakdownResults') or []:
            locality = x.get('locality')
            if locality:
                item['counties'].append({'id': locality['shortName'], 'total': x['voteTotal'], 'options': options(x['ballotOptions']), 'reporting': x.get('precinctReportingStatus')})
        return item
    with ThreadPoolExecutor(max_workers=6) as pool:
        contests = list(pool.map(detail, rows))
        def local(county):
            data = fetch(f"/elections/{county['id']}/{ELECTION}/data")
            county['asOf'] = data['election']['asOf']
            local_rows = []
            for row in data['ballotItems']:
                if row.get('parentId'): continue
                item = contest(row, county['id'])
                item['counties'] = [{'id': county['id'], 'total': item['total'], 'options': item['options'], 'reporting': item['reporting']}]
                local_rows.append(item)
            return local_rows
        for local_rows in pool.map(local, counties): contests.extend(local_rows)
    known_counties = {county['id'] for county in counties}
    assert len({item['id'] for item in contests}) == len(contests), 'Duplicate contest IDs'
    for item in contests:
        assert item['total'] >= 0 and all(x['votes'] >= 0 for x in item['options'])
        assert len({x['id'] for x in item['counties']}) == len(item['counties'])
        assert all(x['id'] in known_counties for x in item['counties'])
        assert sum(x['votes'] for x in item['options']) == item['total'], f"Candidate totals do not reconcile: {item['name']}"
        assert sum(x['total'] for x in item['counties']) == item['total'], f"County totals do not reconcile: {item['name']}"
    snapshot = {'source': SOURCE, 'election': '2026 General Election', 'electionDate': '2026-11-03',
                'asOf': state['election']['asOf'], 'official': state['election']['isOfficialResults'],
                'fetchedAt': datetime.fromtimestamp(max(file.stat().st_mtime for file in CACHE.glob('*.json')), timezone.utc).isoformat(), 'counties': counties, 'contests': contests}
    output = ROOT / 'public/data/2026-results.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot, separators=(',', ':')) + '\n')
    temporary.replace(output)
    print(f"Imported {len(contests)} contests ({len(rows)} statewide, {len(contests)-len(rows)} local) across {len(counties)} counties. State publication: {snapshot['asOf']}")

if __name__ == '__main__': main()
