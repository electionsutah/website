#!/usr/bin/env python3
"""Fetch each place's Wikidata image (P18) from Wikimedia Commons, with attribution.

python3 scripts/fetch-place-images.py [--use-cache] [--only KEY]

Reads Wikidata IDs from src/data/place-enrichment.json, looks up the image
property (P18), and asks Commons for the file's author and license. Each photo
is resized to 1280px wide WebP in public/images/places/<key>.webp, and the
credits go to src/data/place-images.json. Raw downloads stay in the ignored
.firecrawl/ directory. Requires ImageMagick (`magick`).
"""
import argparse
import html
import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firecrawl' / 'place-images'
OUTPUT = ROOT / 'public' / 'images' / 'places'
INDEX = ROOT / 'src' / 'data' / 'place-images.json'
WIDTH = 1280  # A standard Commons thumbnail width; covers the half-width hero at 2x.
# Wikimedia asks automated clients to identify themselves.
HEADERS = {'User-Agent': 'ElectionsUtah/1.0 (https://www.electionsutah.org/; place images)'}


def get_json(url, params):
    for attempt in range(4):
        try:
            with urlopen(Request(url + '?' + urlencode(params), headers=HEADERS), timeout=60) as response:
                return json.load(response)
        except Exception:
            if attempt == 3: raise
            time.sleep(2 ** attempt)


def batches(items, size=50):
    for start in range(0, len(items), size): yield items[start:start + size]


def plain(value):
    """Commons metadata is HTML; keep the text."""
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', value or ''))).strip()


def best_claim(claims):
    """Prefer a preferred-rank statement, then the first normal one; skip deprecated."""
    ranked = [claim for claim in claims if claim.get('rank') != 'deprecated' and claim['mainsnak'].get('datavalue')]
    ranked.sort(key=lambda claim: claim.get('rank') != 'preferred')
    return ranked[0]['mainsnak']['datavalue']['value'] if ranked else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--use-cache', action='store_true', help='reuse downloaded originals')
    parser.add_argument('--only', help='a single place key, e.g. salt-lake/bluffdale')
    args = parser.parse_args()
    places = json.loads((ROOT / 'src/data/place-enrichment.json').read_text())
    keys = [key for key, row in places.items() if row.get('wikidataId') and (not args.only or key == args.only)]

    files = {}
    for group in batches(keys):
        ids = [places[key]['wikidataId'] for key in group]
        entities = get_json('https://www.wikidata.org/w/api.php', {'action': 'wbgetentities', 'ids': '|'.join(ids), 'props': 'claims', 'format': 'json'})['entities']
        for key in group:
            image = best_claim(entities.get(places[key]['wikidataId'], {}).get('claims', {}).get('P18', []))
            if image: files[key] = image

    info = {}
    titles = sorted({'File:' + name for name in files.values()})
    for group in batches(titles):
        pages = get_json('https://commons.wikimedia.org/w/api.php', {'action': 'query', 'titles': '|'.join(group), 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|mime|size', 'iiurlwidth': WIDTH, 'format': 'json', 'formatversion': 2})['query']
        # Commons normalizes titles (underscores to spaces), so map back through "normalized".
        normalized = {row['from']: row['to'] for row in pages.get('normalized', [])}
        by_title = {page['title']: page for page in pages['pages']}
        for title in group:
            page = by_title.get(normalized.get(title, title))
            if page and page.get('imageinfo'): info[title] = page['imageinfo'][0]

    OUTPUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    index = json.loads(INDEX.read_text()) if args.only and INDEX.exists() else {}
    skipped = []
    for key in keys:
        name = files.get(key)
        meta = info.get('File:' + name) if name else None
        if not meta:
            skipped.append((key, 'no Wikidata image' if not name else 'file not found on Commons'))
            continue
        if not meta.get('mime', '').startswith('image/') or meta['mime'] == 'image/svg+xml':
            skipped.append((key, f"not a photo ({meta.get('mime')})"))
            continue
        ext = meta['extmetadata']
        license_name = plain(ext.get('LicenseShortName', {}).get('value'))
        if not license_name:
            skipped.append((key, 'no license on Commons'))
            continue
        original = CACHE / (key.replace('/', '--') + Path(meta['thumburl']).suffix.lower())
        if not (args.use_cache and original.exists()):
            with urlopen(Request(meta['thumburl'], headers=HEADERS), timeout=120) as response: original.write_bytes(response.read())
            time.sleep(0.5)
        target = OUTPUT / f'{key}.webp'
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['magick', str(original), '-auto-orient', '-resize', f'{WIDTH}x{WIDTH}>', '-strip', '-quality', '72', str(target)], check=True)
        size = subprocess.run(['magick', 'identify', '-format', '%w %h', str(target)], check=True, capture_output=True, text=True).stdout.split()
        index[key] = {
            'src': f'/images/places/{key}.webp',
            'width': int(size[0]), 'height': int(size[1]),
            'title': plain(ext.get('ObjectName', {}).get('value')) or Path(name).stem,
            'artist': plain(ext.get('Artist', {}).get('value')) or plain(ext.get('Credit', {}).get('value')) or 'Unknown author',
            'license': license_name,
            'licenseUrl': ext.get('LicenseUrl', {}).get('value', ''),
            'sourceUrl': meta['descriptionurl'],
            'file': name,
        }
    INDEX.write_text(json.dumps(dict(sorted(index.items())), indent=1, ensure_ascii=False) + '\n')
    print(f'Saved {len(index)} place images; skipped {len(skipped)}.')
    for key, reason in skipped: print(f'  {key}: {reason}')


if __name__ == '__main__': main()
