#!/usr/bin/env python3
"""Import certified 2024 state contest totals and county breakdowns.

python3 scripts/import-result-history.py [--use-cache]
Raw API responses are kept in the ignored .firecrawl/history/ directory.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import time
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firecrawl/history'
API = 'https://electionresults.utah.gov/results/public/api'
ELECTION = 'general11052024'
SOURCE = f'https://electionresults.utah.gov/results/public/Utah/{ELECTION}'
spec = importlib.util.spec_from_file_location('results_import', ROOT / 'scripts/refresh-election-results.py')
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--use-cache', action='store_true')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    used = []
    def fetch(path):
        file = CACHE / (path.replace('/', '_') + '.json')
        used.append(file)
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
    assert state['election']['electionDate'] == '2024-11-05'
    assert state['election']['isOfficialResults'], 'Historical baseline must be certified'
    counties = [{'id': x['shortName'], 'name': shared.text(x['name']), 'asOf': state['election']['asOf']} for x in state['jurisdiction']['childLocalities']]
    def detail(row):
        data = fetch(f"/elections/Utah/{ELECTION}/data/ballot-item/{row['id']}")
        result = data['ballotItemWithBreakdown']
        item = shared.contest(row)
        item.update(total=result['voteTotal'], options=shared.options(result['summaryResults']['ballotOptions']), reporting=result['reportingStatus'],
                    source=f"{SOURCE.split('/Utah/')[0]}/Utah/elections/{ELECTION}/ballot-items/{row['id']}")
        for x in result.get('breakdownResults') or []:
            locality = x.get('locality')
            if locality and x['voteTotal'] > 0:
                item['counties'].append({'id': locality['shortName'], 'total': x['voteTotal'], 'options': shared.options(x['ballotOptions']), 'reporting': x.get('precinctReportingStatus')})
        assert sum(x['votes'] for x in item['options']) == item['total'], item['name']
        item['countyTotalsReconcile'] = sum(x['total'] for x in item['counties']) == item['total']
        if not item['countyTotalsReconcile']:
            print(f"County breakdown withheld from shift comparisons: {item['name']} (source totals differ)")
        assert len({x['id'] for x in item['counties']}) == len(item['counties']), item['name']
        return item
    # District races supply direct comparisons; all four U.S. House races supply
    # countywide aggregates that remain usable after congressional redistricting.
    rows = [row for row in state['ballotItems'] if shared.text(row['name']).strip().startswith(('U.S. House', 'State House', 'State Senate', 'State School Board'))]
    with ThreadPoolExecutor(max_workers=6) as pool:
        contests = list(pool.map(detail, rows))
    output = {'source': SOURCE, 'election': '2024 General Election', 'electionDate': '2024-11-05', 'official': True,
              'asOf': state['election']['asOf'], 'fetchedAt': datetime.fromtimestamp(max(file.stat().st_mtime for file in used), timezone.utc).isoformat(),
              'counties': counties, 'contests': contests}
    file = ROOT / 'public/data/2024-results.json'
    temporary = file.with_suffix('.tmp')
    temporary.write_text(json.dumps(output, separators=(',', ':')) + '\n')
    temporary.replace(file)
    print(f"Imported {len(contests)} certified 2024 district races; any inconsistent county breakdowns are explicitly flagged.")

if __name__ == '__main__': main()
