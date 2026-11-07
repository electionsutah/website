#!/usr/bin/env python3
"""Parse cached Deseret News returns into attributed facts; never infer outcomes.

Run --extract with .firecrawl/municipal-{year}.html source downloads present.
The reviewed fact manifest is committed; copyrighted article HTML remains ignored.
"""
import json,re,sys,unicodedata
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def write(p,v): (ROOT/p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def slug(s):return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')
def norm(s):return slug(s).replace('-','')
class Paragraphs(HTMLParser):
 def __init__(self):super().__init__();self.active=False;self.text=[];self.rows=[]
 def handle_starttag(self,t,a):
  if t=='p':self.active=True;self.text=[]
 def handle_data(self,d):
  if self.active:self.text.append(d)
 def handle_endtag(self,t):
  if t=='p' and self.active:self.rows.append(''.join(self.text).strip());self.active=False
if '--extract' in sys.argv:
 places=read('.firecrawl/place-map.json'); lookup={norm(p['name']):p for p in places if p['type']!='County'}
 for p in places:
  if p['type']=='County':lookup[norm(p['name'])]=p
 aliases={'Bear River':'Bear River City','Mt. Pleasant':'Mount Pleasant','Hyde Park City':'Hyde Park','East Carbon City':'East Carbon','North Logan City':'North Logan','West Valley':'West Valley City','Taylorsville-Bennion':'Taylorsville'}
 for a,b in aliases.items():
  if norm(b) in lookup:lookup[norm(a)]=lookup[norm(b)]
 # Historical incorporated towns absent from the present-day municipality reference.
 historical={'Hiawatha':'Carbon','Sunnyside':'Carbon','Ophir':'Tooele'}
 for name,county in historical.items():lookup[norm(name)]=dict(name=name,county=county,id=f'{slug(county)}/{slug(name)}',type='Town')
 school={'Box Elder School District':'Box Elder','Cache School District':'Cache','Garfield School District':'Garfield','Juab School District':'Juab','North Sanpete School District':'Sanpete','Wasatch School District':'Wasatch'}
 for name,county in school.items():lookup[norm(name)]=dict(name=name,county=county,id=slug(county),type='School district')
 sources={c['year']:c['source'] for c in read('reports/alton-election-research.json')['contests']}
 contests=[];issues=[];notes=[];headings={}; serial={}
 for year,url in sorted(sources.items()):
  parser=Paragraphs();parser.feed((ROOT/f'.firecrawl/municipal-{year}.html').read_text());rows=parser.rows
  # Repair paragraph breaks and missing delimiters without changing reported facts.
  if year==1991:
   rows=[s.replace('AlpineFour-year','Alpine\nFour-year') for s in rows];rows='\n'.join(rows).splitlines()
   for i,s in enumerate(rows):
    if s.startswith('Dettamanti,'):rows[i-1]+=' '+s;rows[i]=''
  rows='\n'.join(rows).replace('%.Midway','%.\nMidway').splitlines()
  if year==1995:
   rows=[s.replace('208. Write-in candidates: James Beason','208; James Beason (write-in)').replace('Edna Romano,','Edna Romano (write-in),') if 'Write-in candidates:' in s else s for s in rows]
  if year==1995:rows=[s.replace('North Sanpete School','North Sanpete School District') if s=='North Sanpete School' else s for s in rows]
  place=None;pending=None
  for index,line in enumerate(rows):
   line=line.strip()
   line=re.sub(r'^1 of 1 precinct>\s*','',line)
   line=re.sub(r'^OFour-year','Four-year',line)
   line=re.sub(r'^([24])-Year Council',lambda m:('Four' if m[1]=='4' else 'Two')+'-year council',line)
   line=re.sub(r'^Milford City Council','City Council',line)
   if not line or line=='.' or line=='District':continue
   if norm(line) in lookup:
    place=lookup[norm(line)];pending=None;headings.setdefault(str(year),[]).append(place['name']);continue
   if re.fullmatch(r'\d+ ?of \d+ precincts?',line):continue
   if place is None:continue
   if year==1991 and place['name']=='Enterprise' and line.startswith('McMullin,'):
    issues.append(dict(year=year,place=place['name'],reason='Source begins mid-contest; office and full candidate name are missing',row=index));continue
   # A separate ballot-question heading precedes its response paragraph in 1989.
   if year==1989 and not re.search(r'\d',line) and not line.startswith('Mayor -'):
    pending=line;continue
   candidate=bool(re.match(r'(Mayor|(?:Four|Two)-year council|(?:City |Town |Municipal )?Council|Special Service District)',line,re.I))
   if candidate:
    m=re.match(r'(.+)(?:\s+-+\s+)(.*)',line) if re.search(r'\s+-+\s+',line) else re.match(r'(.+?)(?:(?<=term)\s+|(?<=elected\))\s+)(.*)',line)
    if not m:issues.append(dict(year=year,place=place['name'],row=index,reason='Unparsed candidate contest'));continue
    title,body=m.groups()
    if body.startswith('('):
     m2=re.match(r'(\([^)]*\))\s*(?:-\s*|n\s+)?(.*)',body);title+=' '+m2[1];body=m2[2]
    elected=re.search(r'\((\d+|one|two|three|four|five|six) elected\)',title,re.I)
    words={'one':1,'two':2,'three':3,'four':4,'five':5,'six':6}
    if '(vote for 2)' in title.lower():title=re.sub(r'\(vote for 2\)','(two elected)',title,flags=re.I);elected=re.search(r'\((two) elected\)',title)
    seats=(int(elected[1]) if elected[1].isdigit() else words[elected[1].lower()]) if elected else 1 if title.lower()=='mayor' or re.search(r'\b(seat|ward|district)\b',title,re.I) else None
    title=re.sub(r'\s*\([^)]*elected\)','',title,flags=re.I).strip(' ,-')
    if title.lower()=='mayor':office='Mayor'
    else:
     term=re.search(r'([24])-year',title,re.I)
     term_year=term[1] if term else '4' if re.search(r'Four-year',title,re.I) else '2' if re.search(r'Two-year',title,re.I) else None
     descriptor=re.sub(r'(?i)(?:Four|Two)-year council|(?:City |Town |Municipal )?Council|[24]-year[ -]*(?:terms?|seat)?','',title)
     descriptor=re.sub(r'\s+',' ',descriptor.replace(',',' ').replace(' - ',' ')).strip(' ,-')
     office=('Special Service District' if title.startswith('Special Service') else 'Town Council' if 'Town Council' in title or place['name']=='Alton' else 'City Council' if 'City Council' in title else 'Municipal Council' if 'Municipal Council' in title else 'Council')
     descriptor=descriptor.strip()
     if descriptor=='S':descriptor=''
     if descriptor and office!='Special Service District':office+=' '+descriptor.title()
     if term_year:office+=f' ({term_year}-year term)'
    kind='candidate'
   else:
    if pending: title,body=pending,line;pending=None
    elif ' - ' in line:title,body=line.rsplit(' - ',1)
    else:
     notes.append(dict(year=year,place=place['name'],reason='Narrative or unavailable election entry',row=index));continue
    office=title.strip();seats=None;kind='measure'
   options=[];problems=[]
   # Alta 1993 separates the two mayoral candidates with a comma.
   if year==1993 and place['name']=='Alta' and office=='Mayor':body=body.replace('101, Maximilian','101; Maximilian')
   for item in body.strip().rstrip('.').split(';'):
    item=item.strip().strip('.')
    if not item or item.lower()=='unopposed':continue
    item=item.rstrip('>').rstrip('.')
    item=re.sub(r'\. Canvass may.*$','',item)
    if re.search(r'other (?:candidates|people)',item):problems.append('Unnamed write-in recipients are omitted; reported named-candidate subtotal is incomplete.');continue
    if year==1989 and place['name']=='Emery' and '7O' in item:
     name=item.split(',')[0];votes=None
     item=name+' 0';problems.append('Glenys C. Sitterud: printed tally 7O is ambiguous; vote count is unknown.')
     ambiguous=True
    else:ambiguous=False
    # The first integer following the name is the vote count, never the percent.
    m=re.match(r'(.+?)(?:,?\s+)(-?\d[\d,]*)(?:\s*,?\s*\d+%|\s*%|\s*\([^)]*\))?\.?$',item)
    if not m:
     if 'wins on write-in vote' in item:name=item.split(' wins')[0];votes=None
     elif 'won, unopposed' in item:name=item.split(', won')[0];votes=None
     elif 'withdrew' in item:name=item.split(', withdrew')[0];votes=None
     elif ' and ' in item or 'winners:' in item:
      names=re.split(r' and |\. defeated: ',item.replace('winners: ',''))
      for n in names:options.append(dict(name=re.sub(r'\s*\(inc\.\)','',n).strip(' .'),votes=None,writeIn=False,winner=None))
      problems.append('Names published without vote counts; outcomes remain unverified.');continue
     else:problems.append('Unparsed option: '+item);continue
    else:name=m[1].rstrip(', ');votes=int(m[2].replace(',',''))
    if ambiguous or '0,000' in item:votes=None
    writein='write-in' in item.lower() or bool(re.search(r'\bWI\b',item))
    name=re.sub(r'\((?:inc\.?|write-in|write-in,? inc\.?|[RD]-inc\.?)\)','',name,flags=re.I)
    name=re.sub(r',?\s+write-in\b','',name,flags=re.I)
    name=re.sub(r'\s+WI$','',name)
    name=name.strip(' ,')
    name=re.sub(r',?\s+(GOP|Dem|Rep|Ind|R|D)$','',name).strip(' ,')
    name=re.sub(r'\s+',' ',name)
    name=name.replace('(withdrew)','').replace('(interim inc.)','').replace('No official candidates filed, write-ins only. ','').strip()
    if votes is not None and votes<0:problems.append(f'{name}: negative printed tally retained as unknown');votes=None
    party=re.search(r'\b(GOP|Dem|Rep|Ind)\b',item) or re.search(r'\(([RD])-inc',item)
    options.append(dict(name=name,votes=votes,writeIn=writein,winner=None,**({'status':'withdrew'} if 'withdrew' in item else {}),**({'party':{'GOP':'Republican','Rep':'Republican','Dem':'Democratic','Ind':'Independent','R':'Republican','D':'Democratic'}[party[1]]} if party else {})))
   if not options:issues.append(dict(year=year,place=place['name'],row=index,reason='No parsed options',details=problems));continue
   key=(year,place['id'],office);serial[key]=serial.get(key,0)+1
   duplicate=serial[key]>1
   if duplicate:problems.append('The source repeats this office under the same place heading; entries are retained separately without resolving the discrepancy.')
   c=dict(id=f'{year}-{slug(place["name"])}-{slug(office)}'+(f'-entry-{serial[key]}' if duplicate else ''),placeId=place['id'],municipality=place['name'],county=place['county'],jurisdictionType=place['type'],year=year,electionDate={1989:'1989-11-07',1991:'1991-11-05',1993:'1993-11-02',1995:'1995-11-07'}[year],office=office,kind=kind,source=url,official=False,seats=seats,totalCandidateVotes=sum(o['votes'] or 0 for o in options),options=options,notes=['Contemporary newspaper returns are unofficial. Outcomes are not inferred.']+(['Some vote counts are unavailable or illegible; the subtotal includes only known tallies.'] if any(o['votes'] is None for o in options) else [])+problems)
   if problems:issues.append(dict(year=year,place=place['name'],row=index,contestId=c['id'],reason='Option review required',details=problems))
   contests.append(c)
 write('reports/historical-newspaper-elections.json',dict(reviewedOn='2026-11-06',sources=[dict(year=y,url=u)for y,u in sorted(sources.items())],contests=contests,issues=issues,narrativeEntries=notes,sourcePlaces=headings))
 print('Extracted',len(contests),'contests;',sum(len(c['options'])for c in contests),'options;',len(issues),'issues;',len(notes),'narratives')
# Import reviewed structured facts, including records with unavailable tallies.
if '--import' in sys.argv:
 report=read('reports/historical-newspaper-elections.json')
 existing=read('src/data/researched-candidates.json')
 key=lambda r:(r['year'],slug(r['name']),r['office'],r['county'],r.get('city',''))
 seen={key(r)for r in existing}
 records=[]
 for c in report['contests']:
  if c['kind']!='candidate':continue
  for o in c['options']:
   row=dict(id=f"{slug(o['name'])}-{slug(c['county'])}-{slug(c['municipality'])}",name=o['name'],office=c['office'],party=o.get('party',''),status=o.get('status','general_election'),sourceStatus='Unofficial newspaper general-election returns',section='Municipal Offices' if c['office']!='Special Service District' else 'Special District Offices',year=c['year'],electionType='general',city=c['municipality'],county=c['county'],state='UT',source=c['source'],lastUpdated='',contact=dict(address='',phone='',email='',website='',facebook='',twitter=''))
   if key(row) not in seen:records.append(row);seen.add(key(row))
 write('src/data/newspaper-candidates.json',records)
 print('Imported',len(records),'additional newspaper candidate appearances; existing Alton rows retained.')
