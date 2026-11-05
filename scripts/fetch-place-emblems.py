#!/usr/bin/env python3
"""Fetch county and city emblems (seal, logo, coat of arms, flag) from Wikimedia Commons.

python3 scripts/fetch-place-emblems.py

Uses each place's Wikidata item (seal P158, logo P154, coat of arms P94, flag P41,
in that order of preference), plus Commons files that Wikidata does not link yet
(EXTRA below, each checked by hand). Every emblem is padded to a 256px square WebP
in public/images/place-emblems/<key>.webp, with its license and author in
src/data/place-emblems.json. Places without one fall back to the location_on icon.
Requires ImageMagick (`magick`). Raw downloads stay in the ignored .firecrawl/ directory.
"""
import html
import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firecrawl' / 'place-emblems'
OUTPUT = ROOT / 'public' / 'images' / 'place-emblems'
INDEX = ROOT / 'src' / 'data' / 'place-emblems.json'
SIZE = 256
HEADERS = {'User-Agent': 'ElectionsUtah/1.0 (https://www.electionsutah.org/; place emblems)'}
PROPERTIES = [('P158', 'seal'), ('P154', 'logo'), ('P94', 'coat of arms'), ('P41', 'flag')]
# Utah county and city emblems on Commons that Wikidata does not link (checked 2026-11-05).
EXTRA = {
    'emery': ('seal', 'Emery County Seal.png'),
    'salt-lake': ('logo', 'Salt Lake County, Utah logo.png'),
    'salt-lake/taylorsville': ('seal', 'Taylorsville Seal.svg'),
    'salt-lake/west-valley-city': ('seal', 'Seal of West Valley City, Utah.png'),
    'tooele': ('seal', 'Seal of Tooele County, Utah.png'),
    'wasatch': ('logo', 'Logo of Wasatch County, Utah.svg'),
    'summit/park-city': ('logo', 'Logo of Park City, Utah.jpg'),
    'washington/st-george': ('seal', 'Seal of the City of St. George.png'),
}


def get_json(url, params):
    for attempt in range(4):
        try:
            with urlopen(Request(url + '?' + urlencode(params), headers=HEADERS), timeout=60) as response: return json.load(response)
        except Exception:
            if attempt == 3: raise
            time.sleep(2 ** attempt)


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', value or ''))).strip()


def main():
    places = json.loads((ROOT / 'src/data/place-enrichment.json').read_text())
    keys = [key for key, row in places.items() if row.get('wikidataId')]
    picks = {}
    for start in range(0, len(keys), 50):
        group = keys[start:start + 50]
        entities = get_json('https://www.wikidata.org/w/api.php', {'action': 'wbgetentities', 'ids': '|'.join(places[key]['wikidataId'] for key in group), 'props': 'claims', 'format': 'json'})['entities']
        for key in group:
            claims = entities[places[key]['wikidataId']].get('claims', {})
            for prop, kind in PROPERTIES:
                values = [claim['mainsnak']['datavalue']['value'] for claim in claims.get(prop, []) if claim.get('rank') != 'deprecated' and claim['mainsnak'].get('datavalue')]
                if values: picks[key] = (kind, values[0]); break
    for key, pick in EXTRA.items():
        # A hand-checked seal or logo beats a flag; keep any Wikidata seal or logo.
        if key not in picks or picks[key][0] == 'flag': picks[key] = pick

    titles = sorted({'File:' + name for _, name in picks.values()})
    info = {}
    for start in range(0, len(titles), 50):
        query = get_json('https://commons.wikimedia.org/w/api.php', {'action': 'query', 'titles': '|'.join(titles[start:start + 50]), 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|mime', 'iiurlwidth': 500, 'format': 'json', 'formatversion': 2})['query']
        normalized = {row['from']: row['to'] for row in query.get('normalized', [])}
        pages = {page['title']: page for page in query['pages']}
        for title in titles[start:start + 50]:
            page = pages.get(normalized.get(title, title))
            if page and page.get('imageinfo'): info[title] = page['imageinfo'][0]

    OUTPUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    index, skipped = {}, []
    for key, (kind, name) in sorted(picks.items()):
        meta = info.get('File:' + name)
        license_name = plain(meta['extmetadata'].get('LicenseShortName', {}).get('value')) if meta else ''
        if not meta or not license_name:
            skipped.append((key, name)); continue
        # Commons serves SVGs as PNG thumbnails, so ImageMagick never has to render SVG itself.
        original = CACHE / (key.replace('/', '--') + Path(meta['thumburl'].split('?')[0]).suffix.lower())
        if not original.exists():
            with urlopen(Request(meta['thumburl'], headers=HEADERS), timeout=120) as response: original.write_bytes(response.read())
            time.sleep(0.5)
        target = OUTPUT / f'{key}.webp'
        target.parent.mkdir(parents=True, exist_ok=True)
        # Fit inside the square with a little room, centered on a transparent background.
        subprocess.run(['magick', str(original), '-background', 'none', '-resize', f'{int(SIZE * .9)}x{int(SIZE * .9)}', '-gravity', 'center', '-extent', f'{SIZE}x{SIZE}', '-strip', '-quality', '86', str(target)], check=True)
        ext = meta['extmetadata']
        index[key] = {
            'src': f'/images/place-emblems/{key}.webp', 'kind': kind, 'file': name, 'title': Path(name).stem,
            'artist': plain(ext.get('Artist', {}).get('value')) or plain(ext.get('Credit', {}).get('value')) or 'Unknown author',
            'license': license_name, 'licenseUrl': ext.get('LicenseUrl', {}).get('value', ''), 'sourceUrl': meta['descriptionurl'],
        }
    INDEX.write_text(json.dumps(index, indent=1, ensure_ascii=False) + '\n')
    print(f'Saved {len(index)} place emblems; skipped {len(skipped)}.')
    for key, name in skipped: print(f'  {key}: {name}')


if __name__ == '__main__': main()
