#!/usr/bin/env python3
"""Import the certified 2024 turnout table, extracted from page 3 of the canvass.

First run:
  firecrawl scrape 'https://vote.utah.gov/wp-content/uploads/2025/02/2024-General-Election-Statewide-Canvass-2.pdf' -o .firecrawl/2024-canvass.md
Then run this script. OCR is needed because the table is an image in the PDF.
County coverage, totals, and published percentages are validated before writing.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://vote.utah.gov/wp-content/uploads/2025/02/2024-General-Election-Statewide-Canvass-2.pdf'


def parse_table(markdown, expected):
    rows = {}
    for name, active, ballots, turnout in re.findall(
        r'^\| ([A-Za-z ]+) \| ([\d,]+) \| ([\d,]+) \| ([\d.]+)% \|\s*$', markdown, re.M
    ):
        key = name.lower().replace(' ', '-')
        if key in rows:
            raise ValueError(f'Duplicate county: {name}')
        row = dict(activeRegistered=int(active.replace(',', '')), ballotsCast=int(ballots.replace(',', '')), turnoutPercent=float(turnout))
        if not 0 < row['ballotsCast'] <= row['activeRegistered'] or abs(row['ballotsCast'] / row['activeRegistered'] * 100 - row['turnoutPercent']) > .011:
            raise ValueError(f'Invalid turnout: {name}')
        rows[key] = row
    state = rows.pop('total')
    if rows.keys() != expected:
        raise ValueError(f'County coverage differs: {rows.keys() ^ expected}')
    for field in ('activeRegistered', 'ballotsCast'):
        if sum(row[field] for row in rows.values()) != state[field]:
            raise ValueError(f'County sum does not match state: {field}')
    return {'election': '2024 General Election', 'electionDate': '2024-11-05', 'certifiedOn': '2024-11-25',
            'sourceUrl': SOURCE, 'sourcePage': 3, 'denominator': 'Active registered voters in the 2024 certified canvass',
            'state': state, 'counties': rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--markdown', type=Path, default=ROOT / '.firecrawl/2024-canvass.md')
    args = parser.parse_args()
    expected = json.loads((ROOT / 'src/data/voter-registration.json').read_text())['counties'].keys()
    data = parse_table(args.markdown.read_text(), expected)
    (ROOT / 'src/data/voter-participation.json').write_text(json.dumps(data, indent=1) + '\n')
    print(f"Saved certified participation for {len(data['counties'])} counties; county sums match statewide totals.")


if __name__ == '__main__':
    main()
