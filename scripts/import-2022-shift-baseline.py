#!/usr/bin/env python3
"""Normalize the 2022 certified multi-county Senate/school-board tables.

Input: Firecrawl's OCR of the official scanned canvass, saved as HTML tables in
markdown. Every candidate total and contest total must reconcile with the county
rows before a result is emitted. Single-county races are absent from this state
canvass and are deliberately not inferred.

python3 scripts/import-2022-shift-baseline.py .firecrawl/2022-canvass.md
"""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://vote.utah.gov/wp-content/uploads/2022/12/Signed-2022-General-Election-State-Canvass-Certification.pdf'
PARTIES = {'DEM': 'Democratic', 'REP': 'Republican', 'LIB': 'Libertarian', 'UUP': 'United Utah', 'CON': 'Constitution', 'IAP': 'Independent American', 'UNA': 'Unaffiliated', 'WRITE-IN': ''}

class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.rows, self.row, self.cell = [], [], [], None
    def handle_starttag(self, tag, attrs):
        if tag == 'table': self.rows = []
        elif tag == 'tr': self.row = []
        elif tag in ('td', 'th'): self.cell = ['', dict(attrs)]
    def handle_data(self, value):
        if self.cell is not None: self.cell[0] += value
    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(self.cell)
            self.cell = None
        elif tag == 'tr': self.rows.append(self.row)
        elif tag == 'table': self.tables.append(self.rows)

def grid(rows):
    cells = {}
    for r, row in enumerate(rows):
        c = 0
        for value, attrs in row:
            while (r, c) in cells: c += 1
            width, height = int(attrs.get('colspan', 1)), int(attrs.get('rowspan', 1))
            for dr in range(height):
                for dc in range(width): cells[r + dr, c + dc] = value.strip()
            c += width
    return [[cells.get((r, c), '') for c in range(max(c for _, c in cells) + 1)] for r in range(len(rows))]

def number(value): return int(value.replace(',', '').strip() or '0')

def main():
    parser = Tables()
    parser.feed(Path(sys.argv[1]).read_text())
    contests = []
    for page_index, rows in enumerate(parser.tables):
        table = grid(rows)
        if not table: continue
        groups = {}
        for column, heading in enumerate(table[0]):
            match = re.fullmatch(r'(UTAH SENATE|STATE BOARD OF EDUCATION) DISTRICT (\d+)', heading)
            if match: groups.setdefault(heading, []).append(column)
        for heading, columns in groups.items():
            category = 'State Senate' if heading.startswith('UTAH SENATE') else 'School board'
            name = f"{'State Senate' if category == 'State Senate' else 'State School Board'} District {re.search(r'\d+$', heading)[0]}"
            item = {'id': re.sub('[^a-z0-9]+', '-', name.lower()), 'name': name, 'category': category, 'county': None, 'reporting': None,
                    'source': SOURCE, 'options': [], 'counties': [], 'total': 0}
            totals = next(row for row in table if 'Total Votes Cast Per Candidate' in row[0])
            contest_totals = next(row for row in table if row[0] == 'Total Votes Cast in Contest')
            for column in columns:
                candidate = re.fullmatch(r'(.+?)\s+\(([^)]+)\)', table[1][column])
                assert candidate, (name, table[1][column])
                candidate_name, code = candidate.groups()
                assert code in PARTIES, code
                item['options'].append({'id': f"{item['id']}-{column}", 'name': candidate_name, 'party': PARTIES[code], 'votes': number(totals[column]), 'winner': None})
            for row in table[2:]:
                if not row[0].endswith(' County'): continue
                county_options = [{**option, 'votes': number(row[column])} for option, column in zip(item['options'], columns)]
                county_total = sum(option['votes'] for option in county_options)
                if county_total:
                    item['counties'].append({'id': row[0].lower().replace(' ', '-') + '-ut', 'total': county_total, 'options': sorted(county_options, key=lambda option: -option['votes']), 'reporting': None})
            item['total'] = number(contest_totals[columns[0]])
            assert sum(option['votes'] for option in item['options']) == item['total'], f'{name}: candidate/contest mismatch'
            assert sum(county['total'] for county in item['counties']) == item['total'], f'{name}: county/contest mismatch'
            for option in item['options']:
                assert sum(next(candidate['votes'] for candidate in county['options'] if candidate['id'] == option['id']) for county in item['counties']) == option['votes'], f"{name}: county totals for {option['name']} do not reconcile"
            item['options'].sort(key=lambda option: -option['votes'])
            contests.append(item)
    assert len(contests) == 13, f'Expected 8 Senate and 5 school-board contests, found {len(contests)}'
    data = {'source': SOURCE, 'election': '2022 General Election — state-canvassed multi-county races', 'electionDate': '2022-11-08',
            'official': True, 'asOf': '2022-11-28T19:00:00Z', 'certifiedDate': '2022-11-28',
            'coverage': 'Only multi-county State Senate and State School Board contests certified in the state canvass. Single-county races are certified by their counties and are not included.',
            'contests': contests}
    output = ROOT / 'public/data/2022-shift-baseline.json'
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    temporary.replace(output)
    print(f'Imported {len(contests)} certified 2022 contests; all candidate and county totals reconcile.')

if __name__ == '__main__': main()
