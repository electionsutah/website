#!/usr/bin/env python3
"""Import reviewed older state roster facts; OCR output is never imported directly."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
from generate_state_backfill import slug
ROOT=Path(__file__).resolve().parents[1]


def normalize(review):
    output=[]
    for fact in review['records']:
        document=review['sources'][fact['sourceDocument']]
        assert fact['page'] in document['sourcePages']
        name,office=fact['name'].strip(),fact['office'].strip()
        assert name and office and not re.fullmatch(r'yes|no|for|against|total|unknown|unopposed',name,re.I)
        assert fact.get('runningMate','') != name
        assert document['electionType'] in {'primary','general'}
        assert not document['electionDate'] or document['electionDate'].startswith(str(document['year'])+'-')
        section='Federal Offices' if office.startswith('U.S.') else 'State Judicial' if office.startswith(('Judge of','Justice of')) else 'State Senate' if office.startswith('State Senate') else 'State House' if office.startswith('State House') else 'State School Board' if office.startswith('State School Board') else 'State Offices'
        status=document['electionType']+'_election'
        label=fact.get('sourcePartyLabel','')
        source_status=('General' if document['electionType']=='general' else 'Primary')+' Election Candidate'
        if fact.get('ballotType')=='retention': source_status+='; Judicial Retention'
        if label and not fact['party']: source_status+=f'; published party label: {label}'
        output.append(dict(id=slug(name),name=name,runningMate=fact.get('runningMate',''),office=office,party=fact['party'],
                           status=status,sourceStatus=source_status,section=section,year=document['year'],electionType=document['electionType'],
                           city='',county='',state='UT',source=document['url']+'#page='+str(fact['page']),lastUpdated=document['electionDate'],
                           contact=dict(address='',phone='',email='',website='',facebook='',twitter='')))
    keys=[(r['year'],r['electionType'],r['id'],slug(r['office']),r['party']) for r in output]
    assert len(keys)==len(set(keys)), 'Duplicate reviewed candidate columns'
    return output


def merge(existing, additions, source_urls):
    # Replace only rows owned by this reviewed manifest, preserving every other import.
    kept=[r for r in existing if r.get('source','').split('#')[0] not in source_urls]
    key=lambda r:(r['year'],r['electionType'],r['id'],slug(r['office']),r['party'])
    seen={key(r) for r in kept}
    return sorted(kept+[r for r in additions if key(r) not in seen],key=lambda r:(r['year'],r['name'],r['office'],r['party']))


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--manifest',type=Path,default=ROOT/'src/data/history/reviewed-state-rosters.json')
    args=ap.parse_args()
    review=json.loads(args.manifest.read_text())
    additions=normalize(review)
    path=ROOT/'src/data/historical-candidates.json'
    path.write_text(json.dumps(merge(json.loads(path.read_text()),additions,{d['url'] for d in review['sources'].values()}),ensure_ascii=False,indent=2)+'\n')
    print('Reviewed candidate records:',dict(sorted(Counter(r['year'] for r in additions).items())))

if __name__=='__main__': main()
