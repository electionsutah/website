#!/usr/bin/env python3
"""Import manually reviewed, source-attributed candidate records from the gap investigation.

Search results are never imported automatically. Each reviewed candidate must name
an office, election year, status, and supporting source in the investigation file.
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return json.loads((ROOT / name).read_text())
def write(name, value, indent=2):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=indent) + '\n')
def slug(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    return re.sub('[^a-z0-9]+', '-', value.lower()).strip('-')
def key(row):
    return row['year'], slug(row['name']), slug(row['office']), row['county'], row.get('city', '')

investigation = read('reports/municipal-gap-investigation.json')
researched = read('src/data/researched-candidates.json')
existing = {key(row) for name in ['historical-candidates', 'local-candidates', 'researched-candidates'] for row in read(f'src/data/{name}.json')}
profiles = read('src/data/place-enrichment.json')
notes = read('src/data/place-election-notes.json')
added = 0
for entry in investigation['municipalities']:
    candidates = entry.get('candidates', [])
    for candidate in candidates:
        assert candidate['source'] in entry['sources'], entry['name']
        assert candidate['status'] in {'filed', 'general_election', 'primary_election', 'elected', 'withdrew'}
        row = dict(id=slug(candidate['name']), name=candidate['name'], office=candidate['office'], party='',
                   status=candidate['status'], sourceStatus=candidate.get('sourceStatus', candidate['status'].replace('_', ' ').title()),
                   section='Municipal Offices', year=candidate['year'], electionType=candidate.get('electionType', 'general'),
                   city=entry['name'], county=entry['county'], state='UT', source=candidate['source'], lastUpdated='',
                   contact=dict(address='', phone='', email='', website='', facebook='', twitter=''))
        if key(row) not in existing:
            researched.append(row)
            existing.add(key(row))
            added += 1
    entry['importedRecords'] = len(candidates)
    if candidates:
        entry['status'] = 'Candidate records imported'
        if entry['id'] not in profiles:
            profiles[entry['id']] = dict(wikipediaTitle=f"{entry['name']}, Utah", wikipediaUrl='', wikidataId='', wikidataUrl='',
                summary=f"{entry['name']} is a municipality in {entry['county']} County, Utah. Municipal candidate records are documented in the election sources listed below.",
                officialWebsite=entry.get('officialWebsite', ''), sources=entry['sources'], verifiedOn=investigation['reviewedOn'])
        for source in dict.fromkeys(candidate['source'] for candidate in candidates):
            note = dict(date=investigation['reviewedOn'], kind='candidate_roster', title='Municipal candidate source review',
                summary=' '.join(entry['notes']), source=source)
            bucket = notes.setdefault(entry['id'], [])
            if not any(item['kind'] == note['kind'] and item['source'] == source for item in bucket):
                bucket.append(note)
write('src/data/researched-candidates.json', researched)
write('src/data/place-enrichment.json', profiles, 1)
write('src/data/place-election-notes.json', notes)
write('reports/municipal-gap-investigation.json', investigation)
print(f'Added {added} reviewed municipal candidates; {len(researched)} researched records total.')
