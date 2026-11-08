#!/usr/bin/env python3
"""Extract structured roster proposals from cached table OCR and independent scan OCR.

No proposals are imported automatically. Output retains original page coordinates,
OCR agreement and table header cells for review, including rejected ambiguities.
"""
import argparse
from collections import Counter
import html
import json
from pathlib import Path
import re
import unicodedata
ROOT=Path(__file__).resolve().parents[1]
PARTIES={'R':'Republican','D':'Democratic','L':'Libertarian','LIB':'Libertarian','SW':'Socialist Workers','NL':'Natural Law'}
ORDINALS={'FIRST':1,'SECOND':2,'THIRD':3,'FOURTH':4,'FIFTH':5,'SIXTH':6,'SEVENTH':7,'EIGHTH':8}


def clean(s):
    return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s))).strip(' :')


def identity(s):
    return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())


def office_prefix(cell):
    """Only consume explicit office/district labels; never inherit across contests."""
    patterns=[
      (r'^(?:UNITED STATES|U\.?\s*S\.?)\s*(?:PRESIDENT\s*(?:&|AND|/)\s*(?:VICE[- ]?PRESIDENT)|PRES\.?\s*/V\.?P\.?)\s*',lambda m:'U.S. President & Vice President'),
      (r'^PRES\.?\s*/V\.?P\.?\s*',lambda m:'U.S. President & Vice President'),
      (r'^(?:UNITED STATES|U\.?\s*S\.?)\s*(?:SENATE|SENATOR)\s*',lambda m:'U.S. Senate'),
      (r'^(?:(?:UNITED STATES|U\.?\s*S\.?)\s*)?(?:CONGRESSIONAL|CONGRESS|HOUSE)(?: OF REPRESENTATIVES?)?\s*(?:DISTRICT|DIST\.?|DST\.?)\s*#?\s*(\d+)\s*',lambda m:('U.S. House' if re.search('CONGRESS|U\\.?\\s*S|UNITED',m[0],re.I) else 'State House')+' District '+m[1]),
      (r'^(?:UTAH|STATE|ST\.?)?\s*SENATE\s*(?:DISTRICT|DIST\.?|DST\.?)\s*#?\s*(\d+)\s*',lambda m:'State Senate District '+m[1]),
      (r'^(?:UTAH|STATE|ST\.?)\s*HOUSE\s*(?:DISTRICT|DIST\.?|DST\.?)?\s*#?\s*(\d+)\s*',lambda m:'State House District '+m[1]),
      (r'^(?:STATE )?SCHOOL BOAR[D]?\s*(?:DISTRICT|DIST\.?|DST\.?)\s*#?\s*(\d+)\s*',lambda m:'State School Board District '+m[1]),
      (r'^(?:UTAH )?GOVERNOR\s*(?:/|AND|&)\s*(?:LT\.?|LIEUTENANT)\s*GOVERNOR\s*',lambda m:'Governor & Lieutenant Governor'),
      (r'^(?:UTAH )?GOVERNOR\s*',lambda m:'Governor'),
      (r'^(?:ATTORNEY GENERAL|A\.?G\.?)\s*',lambda m:'Attorney General'),
      (r'^STATE AUDITOR\s*',lambda m:'State Auditor'),
      (r'^STATE TREASURER\s*',lambda m:'State Treasurer'),
      (r'^SECRETARY OF STATE\s*',lambda m:'Secretary of State'),
    ]
    for pat,value in patterns:
        m=re.match(pat,cell,re.I)
        if m:return value(m),cell[m.end():].strip()
    return None,cell


def parse_candidate(cell):
    cell=clean(cell)
    office,name=office_prefix(cell)
    if not office:return None
    party=re.search(r'\s*(?:\(([A-Z. /-]+)\)|[“"]([A-Z. /-]+)[”"])\s*$',name)
    code=''
    if party:
        code=(party[1] or party[2]).strip();name=name[:party.start()].strip()
    # Reject a heading or a response even when OCR repeats an office prefix.
    if not name or re.search(r'\d|YES|NO CANDIDATE|UNOPPOSED|FOR |AGAINST|COUNTY|DISTRICT|RETENTION|COURT|REGISTERED|VOTING',name,re.I):return None
    if len(name.split())<2 and office not in {'U.S. President & Vice President','Governor & Lieutenant Governor'}:return None
    if re.search(r'\([^)]*$',name):return None
    mate=''
    if office in {'U.S. President & Vice President','Governor & Lieutenant Governor'}:
        if '/' in name:name,mate=[p.strip() for p in name.split('/',1)]
        elif ' & ' in name:name,mate=[p.strip() for p in name.split(' & ',1)]
        elif office=='U.S. President & Vice President' and len(name.split())==2:
            name,mate=name.split()
    if mate.lower() in {'unknown','unopposed'}:mate=''
    return {'name':name,'runningMate':mate,'office':office,'party':PARTIES.get(code,''),'sourcePartyLabel':code}


def native_matches(fact,pages):
    target=identity(fact['name'])
    matches=[]
    for page in pages:
        for item in page['items']:
            if item['confidence']>=.8 and target in identity(item['text']):
                # Names must match as words, not as a substring of another surname.
                tokens=' '.join(re.findall(r'[a-z0-9]+',unicodedata.normalize('NFKD',item['text']).encode('ascii','ignore').decode().lower()))
                wanted=' '.join(re.findall(r'[a-z0-9]+',unicodedata.normalize('NFKD',fact['name']).encode('ascii','ignore').decode().lower()))
                if re.search(r'(?<!\w)'+re.escape(wanted)+r'(?!\w)',tokens):
                    matches.append({'page':page['page'],**item})
    return matches


def table_proposals(text,pages):
    output=[];seen=set()
    for table in re.findall(r'(?:^\|.*\n)+',text+'\n',re.M):
        for row in table.splitlines():
            if re.match(r'^\|[ :|-]+\|$',row):continue
            cells=[clean(c) for c in row.strip().strip('|').split('|')]
            # County vote rows contain numbers and must never supply candidate names.
            if sum(bool(re.fullmatch(r'[\d,.% ]+',c)) for c in cells if c)>1:continue
            for cell in cells:
                fact=parse_candidate(cell)
                if not fact:continue
                key=(fact['name'],fact['office'],fact['sourcePartyLabel'])
                if key in seen:continue
                seen.add(key)
                evidence=native_matches(fact,pages)
                output.append({**fact,'tableCell':cell,'nativeEvidence':evidence,'reviewStatus':'ocr_agreement' if evidence else 'needs_name_review'})
    return output


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--cache',type=Path,default=ROOT/'.firecrawl/state-history')
    args=ap.parse_args()
    inventory=json.loads((ROOT/'reports/state-election-source-inventory.json').read_text())
    report=[]
    for source in inventory['elections']:
        year=source['yearLabel'];kind=source['kind']
        if year>=1994 or year==1960:continue
        markdown=args.cache/f'{year}-{kind}.md'
        pdf_name=source['sources'][0]['url'].rsplit('/',1)[1]
        native=args.cache/'verified-ocr'/(Path(pdf_name).stem+'.json')
        if not markdown.exists():continue
        pages=json.loads(native.read_text()) if native.exists() else []
        candidates=table_proposals(markdown.read_text(),pages)
        report.append({'key':f'{year}-{kind}','year':year,'kind':kind,'url':source['sources'][0]['url'],'pageCount':len(pages),
                       'candidates':candidates,'statusCounts':dict(Counter(c['reviewStatus'] for c in candidates))})
    output=args.cache/'candidate-proposals.json';output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print([(d['key'],len(d['candidates']),d['statusCounts']) for d in report])

if __name__=='__main__':main()
