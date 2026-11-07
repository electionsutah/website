#!/usr/bin/env python3
"""Build municipal vote tables from the manually verified government-source review.

No web search output is imported automatically. Source counts, office terms,
write-in labels, and unresolved seat counts below were checked against county PDFs.
"""
import json
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
review = json.loads((ROOT / 'reports/four-municipalities-government-review.json').read_text())
groups = {}
for row in review['records']:
    groups.setdefault((row['municipality'], row['year'], row['office']), []).append(row)
assert len(groups) == 8
assert sum(map(len, groups.values())) == 17
write_ins = {'Gary Price', 'Jerry Price', 'Bert Reed', 'Ella Ekker'}
slug = lambda value: re.sub('[^a-z0-9]+', '-', value.lower()).strip('-')
contests = []
for (town, year, office), rows in groups.items():
    notes = []
    if town == 'Elmo':
        notes = ['The county file is published as general-election results dated November 7, 2017, but its internal heading says Primary. No winner status is inferred.']
    contests.append(dict(id=f'{year}-{slug(town)}-{slug(office)}',
        placeId=('millard/' if town == 'Lynndyl' else 'emery/') + slug(town),
        municipality=town, year=year,
        electionDate={2017:'2017-11-07', 2019:'2019-11-05', 2021:'2021-11-02'}[year],
        office=office, source=rows[0]['source'], official=True,
        seats=None if town == 'Elmo' and office == 'Town Council' else 2 if office == 'Town Council (4-year term)' else 1,
        totalCandidateVotes=sum(row['votes'] for row in rows), notes=notes,
        options=[dict(name=row['name'], votes=row['votes'], writeIn=row['name'] in write_ins, winner=None) for row in rows]))
assert sum(c['totalCandidateVotes'] for c in contests) == 602
text = json.dumps(contests, indent=2) + '\n'
for destination in ['src/data/municipal-results.json', 'public/data/municipal-results.json']:
    (ROOT / destination).write_text(text)
print('Imported 8 municipal contests, 17 candidate results and 602 candidate votes.')
