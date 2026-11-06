#!/usr/bin/env python3
"""Intersect UGRC boundaries for office profiles (never candidate addresses).
Run: uv run --with shapely --with pyproj python scripts/generate-office-communities.py [--use-cache]
Uses full-resolution polygons projected to Utah UTM 12N. Overlaps below 1 hectare
are omitted to suppress boundary slivers; this is an approximate community guide,
not an address-level eligibility determination. Caches are ignored by git.
"""
import argparse, hashlib, json, re
from datetime import date
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from shapely import make_valid
from shapely.geometry import shape
from shapely.ops import transform
from pyproj import Transformer
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.firecrawl/office-communities'
BASE='https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/'
LAYERS={
 'city':('UtahMunicipalBoundaries','NAME'),
 'county':('UtahCountyBoundaries','NAME'),
 'state-house':('UtahHouseDistricts2022to2032','DIST'),
 'state-senate':('UtahSenateDistricts2022to2032','DIST'),
 'school-board':('UtahSchoolBoardDistricts2022to2032','DIST'),
 'us-house':('political_us_congress_districts_2026_to_2032','DISTRICT')}
parser=argparse.ArgumentParser();parser.add_argument('--use-cache',action='store_true');args=parser.parse_args()
CACHE.mkdir(parents=True,exist_ok=True)
project=Transformer.from_crs(4326,26912,always_xy=True).transform
geometries={};sources=[]
for layer,(service,field) in LAYERS.items():
 path=CACHE/f'{layer}.json';url=BASE+service+'/FeatureServer/0'
 if not args.use_cache or not path.exists():
  features=[];offset=0
  while True:
   query={'where':'1=1','outFields':field,'outSR':4326,'f':'geojson','resultOffset':offset,'resultRecordCount':1000}
   with urlopen(Request(url+'/query?'+urlencode(query),headers={'User-Agent':'ElectionsUtah-Communities/1.0'}),timeout=120) as r: data=json.load(r)
   if 'features' not in data: raise RuntimeError(data)
   features+=data['features']
   if not data.get('exceededTransferLimit') and not data.get('properties',{}).get('exceededTransferLimit'):break
   if not data['features']:raise RuntimeError('Empty truncated page')
   offset+=len(data['features'])
  path.write_text(json.dumps({'features':features,'retrievedOn':date.today().isoformat()}))
 raw=path.read_bytes();data=json.loads(raw)
 sources.append({'layer':layer,'url':url,'retrievedOn':data['retrievedOn'],'sha256':hashlib.sha256(raw).hexdigest()})
 geometries[layer]=[(str(f['properties'][field]),transform(project,make_valid(shape(f['geometry'])))) for f in data['features'] if f.get('geometry')]
 print(layer,len(geometries[layer]),flush=True)
def slug(s):return re.sub('[^a-z0-9]+','-',s.lower()).strip('-')
def title(s):return s.title() if s.isupper() else s
# Dissolve multipart features sharing a municipality name.
from shapely.ops import unary_union
for layer in geometries:
 groups={}
 for key,g in geometries[layer]:groups.setdefault(key,[]).append(g)
 geometries[layer]=[(key,unary_union(gs)) for key,gs in groups.items()]
municipalities=[]
for name,g in geometries['city']:
 counties=[{'name':title(c)+' County','id':slug(c)} for c,cg in geometries['county'] if g.intersection(cg).area>=10000]
 municipalities.append({'name':name,'key':slug(name),'counties':counties})
def members(target,layer):
 return [{'name':title(n)+(' County' if layer=='county' else ''),'key':slug(n),'partial':g.intersection(target).area/g.area<0.995} for n,g in geometries[layer] if g.intersection(target).area>=10000]
regions={}
for layer in ['county','state-house','state-senate','school-board','us-house']:
 for key,g in geometries[layer]:
  regions[f'{layer}/{slug(key)}']={'municipalities':members(g,'city'),'counties':members(g,'county')}
result={'method':'Full-resolution UGRC polygon intersections in EPSG:26912; overlaps below 10,000 square metres omitted as possible boundary slivers. Partial means less than 99.5% of the municipality overlaps. Municipalities are not a complete list of settlements.','sources':sources,'municipalities':municipalities,'regions':regions}
(ROOT/'src/data/office-communities.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
