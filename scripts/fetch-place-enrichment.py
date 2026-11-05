#!/usr/bin/env python3
"""Add Wikipedia and Wikidata profiles for archive places that do not have one yet.

python3 scripts/fetch-place-enrichment.py [--refresh]

Every county and city named in the candidate data (src/data/historical-candidates.json
and src/data/local-candidates.json) gets a profile in src/data/place-enrichment.json:
the Wikipedia lead summary, the Wikidata item, its official website (P856),
population (P1082, preferring the 2020 census figure), and inception (P571).
Existing profiles are kept as they are unless --refresh is given. Titles are tried
as "<County> County, Utah" and "<City>, Utah"; a page whose summary does not mention
Utah, or that is a disambiguation page, is skipped and reported.
"""
import argparse
import json
import re
import time
import unicodedata
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'src' / 'data' / 'place-enrichment.json'
HEADERS = {'User-Agent': 'ElectionsUtah/1.0 (https://www.electionsutah.org/; place profiles)'}
# Places whose Wikipedia article title is not "<name>, Utah".
TITLES = {'salt-lake/magna': 'Magna, Utah', 'weber/ogden-valley-city': 'Ogden Valley, Utah'}


def get_json(url):
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers=HEADERS), timeout=60) as response: return json.load(response)
        except Exception as error:
            if getattr(error, 'code', None) == 404: return None
            if attempt == 3: raise
            time.sleep(2 ** attempt)


def slug(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def archive_places():
    rows = json.loads((ROOT / 'src/data/historical-candidates.json').read_text()) + json.loads((ROOT / 'src/data/local-candidates.json').read_text())
    places = {}
    for row in rows:
        if not row.get('county'): continue
        places[slug(row['county'])] = (f"{row['county']} County, Utah", row['county'] + ' County')
        if row.get('city'): places[f"{slug(row['county'])}/{slug(row['city'])}"] = (f"{row['city']}, Utah", row['city'])
    return places


def claim_values(entity, prop):
    return [claim for claim in entity.get('claims', {}).get(prop, []) if claim.get('rank') != 'deprecated' and claim['mainsnak'].get('datavalue')]


def population(entity):
    claims = claim_values(entity, 'P1082')
    def when(claim):
        qualifier = claim.get('qualifiers', {}).get('P585')
        return qualifier[0]['datavalue']['value']['time'] if qualifier and qualifier[0].get('datavalue') else ''
    census = [claim for claim in claims if when(claim).startswith('+2020-04-01')]
    pick = census[0] if census else max(claims, key=when, default=None)
    if not pick: return None, ''
    return int(float(pick['mainsnak']['datavalue']['value']['amount'])), when(pick)[1:11]


def profile(title):
    summary = get_json('https://en.wikipedia.org/api/rest_v1/page/summary/' + quote(title.replace(' ', '_'), safe=''))
    if not summary or summary.get('type') == 'disambiguation' or 'Utah' not in summary.get('extract', '') or not summary.get('wikibase_item'): return None
    qid = summary['wikibase_item']
    entity = get_json('https://www.wikidata.org/w/api.php?' + urlencode({'action': 'wbgetentities', 'ids': qid, 'props': 'claims', 'format': 'json'}))['entities'][qid]
    website = next((claim['mainsnak']['datavalue']['value'] for claim in sorted(claim_values(entity, 'P856'), key=lambda claim: claim.get('rank') != 'preferred')), '')
    count, as_of = population(entity)
    inception = next((claim['mainsnak']['datavalue']['value'] for claim in claim_values(entity, 'P571')), None)
    page = summary['titles']['canonical']
    row = {
        'wikipediaTitle': summary['titles']['normalized'], 'wikipediaUrl': 'https://en.wikipedia.org/wiki/' + quote(page, safe=''),
        'summary': re.sub(r'\s+', ' ', summary['extract']).strip(), 'wikidataId': qid, 'wikidataUrl': f'https://www.wikidata.org/wiki/{qid}',
        'officialWebsite': website,
    }
    if count is not None: row.update(population=count, populationAsOf=as_of, populationSource='Wikidata')
    if inception: row.update(inceptionDate=inception['time'][1:11], inceptionPrecision=inception['precision'])
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='refetch existing profiles too')
    args = parser.parse_args()
    existing = json.loads(OUTPUT.read_text())
    wanted = archive_places()
    added, missing = [], []
    for key, (title, name) in sorted(wanted.items()):
        if key in existing and not args.refresh: continue
        titles = [TITLES[key]] if key in TITLES else [title, re.sub(r' (City|Town), Utah$', ', Utah', title)]
        row = next((found for found in (profile(candidate) for candidate in dict.fromkeys(titles)) if found), None)
        time.sleep(0.2)
        if row: existing[key] = row; added.append(key)
        else: missing.append(key)
    OUTPUT.write_text(json.dumps(existing, indent=1, ensure_ascii=False) + '\n')
    print(f'Added {len(added)} place profiles; {len(missing)} not found.')
    for key in missing: print('  not found:', key)


if __name__ == '__main__': main()
