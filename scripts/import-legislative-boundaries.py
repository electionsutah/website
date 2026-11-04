#!/usr/bin/env python3
"""Download and project Utah's official 2022–2032 legislative polygons.

python3 scripts/import-legislative-boundaries.py [--use-cache]
The projection matches src/data/utah-county-paths.json. The ArcGIS query
simplifies at 0.0005 degrees (~50 m), suitable for results exploration, not
address lookup. Raw responses stay in the ignored .firecrawl/ directory.
"""
import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SERVICE = 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/'

def project(point):
    return ((point[0] + 114.1) * 62 * math.cos(math.radians(39.5)), (42.1 - point[1]) * 62)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--use-cache', action='store_true')
    args = parser.parse_args()
    result = {'projection': 'Local equirectangular, matching the bundled Utah county map', 'simplificationDegrees': 0.0005, 'chambers': {}}
    for chamber, count in [('house', 75), ('senate', 29)]:
        service = SERVICE + f"Utah{chamber.title()}Districts2022to2032/FeatureServer/0"
        url = service + '/query?' + urlencode({'where': '1=1', 'outFields': 'DIST', 'outSR': 4326, 'f': 'geojson', 'maxAllowableOffset': 0.0005})
        cache = ROOT / '.firecrawl' / f'{chamber}-district-geometry.json'
        cache.parent.mkdir(parents=True, exist_ok=True)
        if args.use_cache and cache.exists(): data = json.loads(cache.read_text())
        else:
            with urlopen(Request(url, headers={'User-Agent': 'ElectionsUtah-Labs/1.0'}), timeout=60) as response: data = json.load(response)
            cache.write_text(json.dumps(data))
        assert not data.get('exceededTransferLimit') and len(data['features']) == count
        districts = []
        for feature in data['features']:
            number = int(feature['properties']['DIST'])
            geometry = feature['geometry']
            assert geometry['type'] in ('Polygon', 'MultiPolygon')
            polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
            points, paths = [], []
            for polygon in polygons:
                for ring in polygon:
                    projected = [project(point) for point in ring]
                    points.extend(projected)
                    paths.append('M' + 'L'.join(f'{x:.3f},{y:.3f}' for x, y in projected) + 'Z')
            bounds = [min(x for x, y in points), min(y for x, y in points), max(x for x, y in points), max(y for x, y in points)]
            assert all(math.isfinite(value) for value in bounds)
            districts.append({'number': number, 'path': ''.join(paths), 'bounds': [round(value, 3) for value in bounds]})
        assert {row['number'] for row in districts} == set(range(1, count + 1))
        result['chambers'][chamber] = {'source': f'https://gis.utah.gov/products/sgid/political/state-{chamber}-districts/', 'service': service,
            'fetchedAt': datetime.fromtimestamp(cache.stat().st_mtime, timezone.utc).isoformat(), 'districts': sorted(districts, key=lambda row: row['number'])}
    output = ROOT / 'public/data/utah-legislative-boundaries.json'
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    temporary.replace(output)
    print('Imported 75 House and 29 Senate districts from Utah GIS.')

if __name__ == '__main__': main()
