#!/usr/bin/env python3
"""Generate cropped SVG boundary maps from Utah's official GIS layers (UGRC).

python3 scripts/generate-boundary-maps.py [--use-cache] [--only state-house]
Writes public/maps/<layer>/<id>.svg and the index src/data/boundary-maps.json. Each map crops
to one boundary, shows its neighbors and county lines for context, and adds a
small statewide locator (drawn by src/BoundaryMap.svelte) when the crop
is a small part of Utah. Raw GeoJSON is
cached in the ignored .firecrawl/boundaries/ directory.
"""
import argparse
import json
import math
import re
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SERVICE = 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/'
CACHE = ROOT / '.firecrawl/boundaries'
OUT = ROOT / 'public/maps'

# name: (service, id field, simplification in degrees, label)
LAYERS = {
    'state':        ('UtahStateBoundary', None, 0.0008, 'Utah'),
    'county':       ('UtahCountyBoundaries', 'NAME', 0.0004, 'County'),
    'city':         ('UtahMunicipalBoundaries', 'NAME', 0.0001, 'Municipality'),
    'state-house':  ('UtahHouseDistricts2022to2032', 'DIST', 0.0002, 'Utah House District'),
    'state-senate': ('UtahSenateDistricts2022to2032', 'DIST', 0.0003, 'Utah Senate District'),
    'school-board': ('UtahSchoolBoardDistricts2022to2032', 'DIST', 0.0003, 'State School Board District'),
    'us-house':     ('political_us_congress_districts_2026_to_2032', 'DISTRICT', 0.0005, 'U.S. House District'),
}
VINTAGE = {'state-house': '2022–2032 boundaries', 'state-senate': '2022–2032 boundaries',
           'school-board': '2022–2032 boundaries', 'us-house': '2026–2032 boundaries'}

# Place pages show city and county maps in a tall column beside the facts panel.
PORTRAIT = (0.74, 0.74)
# Web Mercator, so MapTiler terrain tiles line up exactly in the browser. Map units are
# Web Mercator world coordinates (0–1) times UNIT, which makes one unit about one degree
# of latitude in Utah and keeps the crop and simplification settings readable.
UNIT = 360 * math.cos(math.radians(39.5))

def mercator(lon, lat):
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2
    return (lon + 180) / 360 * UNIT, y * UNIT
WIDTH = 480  # viewBox width; height follows the crop's aspect ratio

COLORS = {'paper': '#f2f1ed', 'land': '#fbfaf7', 'line': '#d4d1c8', 'county': '#a9a59a',
          'fill': '#ff5a4b', 'edge': '#111110', 'inset': '#5f5e59', 'label': '#5f5e59'}

def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')

def title_case(value):
    """UGRC names are upper case: SOUTH SALT LAKE -> South Salt Lake."""
    return re.sub(r"[A-Za-z]+('[A-Za-z]+)?", lambda m: m.group(0).capitalize(), value.strip())

def fetch(layer):
    service, field, offset, _ = LAYERS[layer]
    cache = CACHE / f'{layer}.json'
    if ARGS.use_cache and cache.exists(): return json.loads(cache.read_text())
    features, start = [], 0
    while True:
        query = {'where': '1=1', 'outFields': field or '*', 'outSR': 4326, 'f': 'geojson',
                 'maxAllowableOffset': offset, 'resultOffset': start, 'resultRecordCount': 1000}
        url = SERVICE + f'{service}/FeatureServer/0/query?' + urlencode(query)
        with urlopen(Request(url, headers={'User-Agent': 'ElectionsUtah-Maps/1.0'}), timeout=120) as response:
            page = json.load(response)
        features += page['features']
        if not page.get('exceededTransferLimit') and not page.get('properties', {}).get('exceededTransferLimit'): break
        start += len(page['features'])
    data = {'type': 'FeatureCollection', 'features': features}
    CACHE.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(data))
    return data

def rings(geometry):
    """Every ring as a list of projected (x, y) points, in an unscaled map space."""
    if not geometry: return []
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    return [[mercator(lon, lat) for lon, lat in ring] for polygon in polygons for ring in polygon]

def bounds(all_rings):
    xs = [x for ring in all_rings for x, _ in ring]; ys = [y for ring in all_rings for _, y in ring]
    return min(xs), min(ys), max(xs), max(ys)

def clip(ring, box):
    """Sutherland–Hodgman clip of one ring against an axis-aligned box."""
    x0, y0, x1, y1 = box
    edges = [(lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1]-a[1]) * (x0-a[0]) / (b[0]-a[0]))),
             (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1]-a[1]) * (x1-a[0]) / (b[0]-a[0]))),
             (lambda p: p[1] >= y0, lambda a, b: (a[0] + (b[0]-a[0]) * (y0-a[1]) / (b[1]-a[1]), y0)),
             (lambda p: p[1] <= y1, lambda a, b: (a[0] + (b[0]-a[0]) * (y1-a[1]) / (b[1]-a[1]), y1))]
    points = ring
    for inside, cross in edges:
        if not points: break
        result, prev = [], points[-1]
        for point in points:
            if inside(point):
                if not inside(prev): result.append(cross(prev, point))
                result.append(point)
            elif inside(prev): result.append(cross(prev, point))
            prev = point
        points = result
    return points

def simplify(points, tolerance):
    """Douglas–Peucker in screen pixels, so detail matches the drawing scale."""
    if len(points) < 4: return points
    keep = [False] * len(points); keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        (ax, ay), (bx, by) = points[first], points[last]
        dx, dy = bx - ax, by - ay; norm = math.hypot(dx, dy) or 1e-9
        best, index = 0, None
        for i in range(first + 1, last):
            px, py = points[i]
            distance = abs(dy * px - dx * py + bx * ay - by * ax) / norm if norm > 1e-9 else math.hypot(px-ax, py-ay)
            if distance > best: best, index = distance, i
        if index is not None and best > tolerance:
            keep[index] = True; stack += [(first, index), (index, last)]
    return [p for p, k in zip(points, keep) if k]

class View:
    def __init__(self, box, width=WIDTH):
        self.x0, self.y0, x1, y1 = box
        self.scale = width / (x1 - self.x0)
        self.width, self.height = width, round((y1 - self.y0) * self.scale)
        pad = 6 / self.scale  # clip a little outside the frame so cut edges never show
        self.clip_box = (self.x0 - pad, self.y0 - pad, x1 + pad, y1 + pad)

    def screen(self, all_rings, tolerance=0.35):
        """Rings clipped to the frame, in viewBox pixels."""
        result = []
        cx0, cy0, cx1, cy1 = self.clip_box
        for ring in all_rings:
            xs = [x for x, _ in ring]; ys = [y for _, y in ring]
            if max(xs) < cx0 or min(xs) > cx1 or max(ys) < cy0 or min(ys) > cy1: continue
            clipped = clip(ring, self.clip_box)
            if len(clipped) < 3: continue
            points = simplify([((x - self.x0) * self.scale, (y - self.y0) * self.scale) for x, y in clipped], tolerance)
            if len(points) >= 3: result.append(points)
        return result

    def path(self, all_rings, tolerance=0.35):
        return ''.join('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in ring) + 'Z' for ring in self.screen(all_rings, tolerance))

def area_centroid(ring):
    a = cx = cy = 0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        cross = x0 * y1 - x1 * y0
        a += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross
    if abs(a) < 1e-9: return 0, ring[0]
    return abs(a) / 2, (cx / (3 * a), cy / (3 * a))

def inside(point, ring):
    x, y = point; result = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0: result = not result
    return result

def label_spot(view, all_rings, text, size):
    """Center of the largest visible piece, if the label fits comfortably inside it."""
    pieces = [(area_centroid(r), r) for r in view.screen(all_rings, 1)]
    if not pieces: return None
    (area, (x, y)), ring = max(pieces, key=lambda p: p[0][0])
    width = len(text) * size * 0.56
    if area < (width + 16) * (size + 14) or not inside((x, y), ring): return None
    # Portrait maps may be trimmed at the left or bottom by object-fit, so keep their labels further in.
    margin = view.width * 0.1 if view.height > view.width else 6
    if not (width / 2 + margin < x < view.width - width / 2 - margin and size + 4 < y < view.height - 6): return None
    return x, y

def crop(target, pad=0.16, min_aspect=0.78, max_aspect=1.5, min_span=0.035):
    """Padded box around a boundary, widened or heightened to a pleasant aspect ratio."""
    x0, y0, x1, y1 = bounds(target)
    w, h = max(x1 - x0, min_span), max(y1 - y0, min_span)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w, h = w * (1 + 2 * pad), h * (1 + 2 * pad)
    aspect = w / h
    if aspect < min_aspect: w = h * min_aspect
    elif aspect > max_aspect: h = w / max_aspect
    return cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2

def svg(title, target, neighbors, counties, state, vintage='', labels=True, aspect=None):
    box = crop(target, min_aspect=aspect[0], max_aspect=aspect[1]) if aspect else crop(target)
    view = View(box)
    state_box = bounds(state)
    share = ((box[2] - box[0]) * (box[3] - box[1])) / ((state_box[2] - state_box[0]) * (state_box[3] - state_box[1]))
    stroke = 'vector-effect="non-scaling-stroke" stroke-linejoin="round"'
    body = [f'<path d="{view.path(state)}" fill="{COLORS["land"]}"/>']
    if neighbors: body.append(f'<path d="{view.path([r for _, n in neighbors for r in n])}" fill="none" stroke="{COLORS["line"]}" stroke-width="1" {stroke}/>')
    if counties: body.append(f'<path d="{view.path([r for c in counties for r in c])}" fill="none" stroke="{COLORS["county"]}" stroke-width="1" stroke-dasharray="3 2" {stroke}/>')
    body.append(f'<path d="{view.path(state)}" fill="none" stroke="{COLORS["county"]}" stroke-width="1.25" {stroke}/>')
    # A wide outline under an opaque fill: only the outer half shows, so seams between parts stay hidden.
    shape = view.path(target, 0.25)
    body.append(f'<defs><path id="b" d="{shape}" fill-rule="evenodd"/></defs>')
    body.append(f'<use href="#b" fill="none" stroke="{COLORS["edge"]}" stroke-width="3.5" {stroke}/>')
    body.append(f'<use href="#b" fill="{COLORS["fill"]}"/>')
    show_locator = share < 0.12
    if labels:
        text = []
        avoid = locator_box(view, state_box) if show_locator else None
        for name, rings_ in neighbors:
            spot = label_spot(view, rings_, name, 15)
            if spot and avoid:
                half = len(name) * 15 * 0.28 + 4
                x0, y0, x1, y1 = avoid
                if spot[0] + half > x0 and spot[0] - half < x1 and spot[1] - 14 < y1 and spot[1] + 6 > y0: spot = None
            if spot: text.append(f'<text x="{spot[0]:.0f}" y="{spot[1] + 4:.0f}">{name}</text>')
        if text: body.append(f'<g font-family="Noto Sans,Helvetica,Arial,sans-serif" font-size="15" font-weight="500" fill="{COLORS["label"]}" text-anchor="middle" paint-order="stroke" stroke="{COLORS["land"]}" stroke-width="3" stroke-linejoin="round">{"".join(text)}</g>')
    # The Utah locator inset is drawn by src/BoundaryMap.svelte over the terrain, not baked in here.
    label = f'{title}{f" ({vintage})" if vintage else ""}'
    world = [round(v / UNIT, 8) for v in box]
    return world, (view.width, view.height), show_locator, (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view.width} {view.height}" width="{view.width}" height="{view.height}" role="img">'
            f'<title>{label}</title><rect width="100%" height="100%" fill="{COLORS["paper"]}"/>' + ''.join(body) + '</svg>\n')

def locator_box(view, state_box):
    """Screen rectangle covered by the locator inset, including its frame."""
    sx0, sy0, sx1, sy1 = state_box
    scale = view.width * 0.2 / max(sx1 - sx0, sy1 - sy0)
    w, h = (sx1 - sx0) * scale, (sy1 - sy0) * scale
    ox, oy = view.width - w - 12, 12
    return ox - 6, oy - 6, ox + w + 6, oy + h + 6

def utah_outline(state):
    """public/maps/utah.svg for the locator inset; its bounds place the crop rectangle."""
    box = bounds(state)
    view = View(box, 100)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'utah.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view.width} {view.height}" width="{view.width}" height="{view.height}">'
        f'<path d="{view.path(state, 0.4)}" fill="{COLORS["land"]}" stroke="{COLORS["inset"]}" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>\n')
    (OUT / 'utah-highlight.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view.width} {view.height}" width="{view.width}" height="{view.height}" role="img"><title>Utah statewide boundary</title>'
        f'<path d="{view.path(state, 0.4)}" fill="{COLORS["fill"]}" stroke="{COLORS["edge"]}" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>\n')
    return {'bounds': [round(v / UNIT, 8) for v in box], 'size': [view.width, view.height]}

def main():
    global ARGS
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--use-cache', action='store_true')
    parser.add_argument('--only', action='append', help='Generate only these layers')
    ARGS = parser.parse_args()
    state = [r for f in fetch('state')['features'] for r in rings(f['geometry'])]
    state = [max(state, key=len)]  # the outer state boundary only
    county_rings = {title_case(f['properties']['NAME']): rings(f['geometry']) for f in fetch('county')['features']}
    index = {'state': utah_outline(state)}
    for layer, (_, field, _, label) in LAYERS.items():
        if layer == 'state' or (ARGS.only and layer not in ARGS.only): continue
        grouped = {}
        for f in fetch(layer)['features']:
            if f.get('geometry'): grouped.setdefault(f['properties'][field], []).extend(rings(f['geometry']))
        folder = OUT / layer
        folder.mkdir(parents=True, exist_ok=True)
        index[layer] = {}
        def name_of(value): return title_case(value) if isinstance(value, str) else str(int(value))
        for value, target in grouped.items():
            name = name_of(value)
            key = slug(name)
            title = f'{name} County' if layer == 'county' else name if layer == 'city' else f'{label} {key}'
            others = [(name_of(v), r) for v, r in grouped.items() if v != value]
            context = [] if layer == 'county' else list(county_rings.values())
            bounds, size, show_locator, markup = svg(title, target, others, context, state, VINTAGE.get(layer, ''), aspect=PORTRAIT if layer in ('city', 'county') else None)
            (folder / f'{key}.svg').write_text(markup)
            # Bounds are Web Mercator world coordinates [west, north, east, south], for terrain tiles.
            index[layer][key] = {'title': title, 'bounds': bounds, 'size': size, **({'locator': True} if show_locator else {})}
        features = grouped
        print(f'{layer}: {len(features)} maps')
    (ROOT / 'src/data/boundary-maps.json').write_text(json.dumps(index, separators=(',', ':'), ensure_ascii=False) + '\n')

if __name__ == '__main__': main()
