#!/usr/bin/env python3
"""Fetch freely licensed photos of officeholders for square avatars.

python3 scripts/fetch-person-photos.py [--only PERSON_ID]

Reads reviewed person-to-Wikidata links from src/data/person-wikidata.json and
takes each item's image (P18) from Wikimedia Commons with its author and license.
Members of Congress without one fall back to their official Congressional
Biographical Directory portrait (P1157), a federal work in the public domain.
State and local government photos are not used: Utah's site terms allow only
unmodified personal or informational use, and cropping is a modification.

Each photo is cropped to a square (centered, or near the top of portraits, where
the face usually is), saved as 400px WebP in public/images/people/<id>.webp, and
credited in src/data/person-photos.json. CROP below adjusts individual crops.
Requires ImageMagick (`magick`). Raw downloads stay in the ignored .firecrawl/.
"""
import argparse
import html
import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firecrawl' / 'person-photos'
OUTPUT = ROOT / 'public' / 'images' / 'people'
INDEX = ROOT / 'src' / 'data' / 'person-photos.json'
SIZE = 400
HEADERS = {'User-Agent': 'ElectionsUtah/1.0 (https://www.electionsutah.org/; officeholder photos)'}
# Where the square starts down a portrait, as a share of the spare height (0 = top, 0.5 = centered).
DEFAULT_TOP = 0.12
CROP: dict[str, float] = {}


def get_json(url, params):
    for attempt in range(4):
        try:
            with urlopen(Request(url + '?' + urlencode(params), headers=HEADERS), timeout=60) as response: return json.load(response)
        except Exception:
            if attempt == 3: raise
            time.sleep(2 ** attempt)


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', value or ''))).strip()


def first_value(entity, prop):
    for claim in sorted(entity.get('claims', {}).get(prop, []), key=lambda claim: claim.get('rank') != 'preferred'):
        if claim.get('rank') != 'deprecated' and claim['mainsnak'].get('datavalue'): return claim['mainsnak']['datavalue']['value']
    return None


def download(url, path):
    if not path.exists():
        with urlopen(Request(url, headers=HEADERS), timeout=120) as response: path.write_bytes(response.read())
        time.sleep(0.5)


def square(source, target, top):
    width, height = map(int, subprocess.run(['magick', 'identify', '-format', '%w %h', f'{source}[0]'], check=True, capture_output=True, text=True).stdout.split())
    side = min(width, height)
    x = (width - side) // 2
    y = int((height - side) * top) if height > width else 0
    subprocess.run(['magick', f'{source}[0]', '-auto-orient', '-crop', f'{side}x{side}+{x}+{y}', '+repage', '-resize', f'{SIZE}x{SIZE}', '-strip', '-quality', '80', str(target)], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', help='a single person id')
    args = parser.parse_args()
    links = json.loads((ROOT / 'src/data/person-wikidata.json').read_text())
    if args.only: links = {args.only: links[args.only]}
    ids = sorted(set(links.values()))
    entities = {}
    for start in range(0, len(ids), 50):
        entities.update(get_json('https://www.wikidata.org/w/api.php', {'action': 'wbgetentities', 'ids': '|'.join(ids[start:start + 50]), 'props': 'claims', 'format': 'json'})['entities'])
    files = {person: first_value(entities[qid], 'P18') for person, qid in links.items()}
    titles = sorted({'File:' + name for name in files.values() if name})
    info = {}
    for start in range(0, len(titles), 50):
        query = get_json('https://commons.wikimedia.org/w/api.php', {'action': 'query', 'titles': '|'.join(titles[start:start + 50]), 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|mime', 'iiurlwidth': 800, 'format': 'json', 'formatversion': 2})['query']
        normalized = {row['from']: row['to'] for row in query.get('normalized', [])}
        pages = {page['title']: page for page in query['pages']}
        for title in titles[start:start + 50]:
            page = pages.get(normalized.get(title, title))
            if page and page.get('imageinfo'): info[title] = page['imageinfo'][0]

    OUTPUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    index = json.loads(INDEX.read_text()) if args.only and INDEX.exists() else {}
    missing = []
    for person, qid in sorted(links.items()):
        meta = info.get('File:' + files[person]) if files[person] else None
        target = OUTPUT / f'{person}.webp'
        if meta and plain(meta['extmetadata'].get('LicenseShortName', {}).get('value')):
            ext = meta['extmetadata']
            original = CACHE / (person + Path(meta['thumburl'].split('?')[0]).suffix.lower())
            download(meta['thumburl'], original)
            credit = {'title': Path(files[person]).stem, 'artist': plain(ext.get('Artist', {}).get('value')) or plain(ext.get('Credit', {}).get('value')) or 'Unknown author',
                      'license': plain(ext['LicenseShortName']['value']), 'licenseUrl': ext.get('LicenseUrl', {}).get('value', ''), 'sourceUrl': meta['descriptionurl'], 'via': 'Wikimedia Commons'}
        elif (bioguide := first_value(entities[qid], 'P1157')):
            original = CACHE / f'{person}-bioguide.jpg'
            try: download(f'https://bioguide.congress.gov/bioguide/photo/{bioguide[0]}/{bioguide}.jpg', original)
            except Exception: missing.append(person); continue
            credit = {'title': 'Official portrait', 'artist': 'U.S. Congress', 'license': 'Public domain', 'licenseUrl': '', 'sourceUrl': f'https://bioguide.congress.gov/search/bio/{bioguide}', 'via': 'Biographical Directory of the United States Congress'}
        else:
            missing.append(person); continue
        square(original, target, CROP.get(person, DEFAULT_TOP))
        index[person] = {'src': f'/images/people/{person}.webp', 'wikidataId': qid, **credit}
    INDEX.write_text(json.dumps(dict(sorted(index.items())), indent=1, ensure_ascii=False) + '\n')
    print(f'Saved {len(index)} photos; {len(missing)} linked people have none.')


if __name__ == '__main__': main()
