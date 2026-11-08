#!/usr/bin/env python3
"""Inventory the official historical index without confusing source gaps with empty elections."""
import argparse
from collections import Counter
from datetime import date
import json
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
INDEX = 'https://vote.utah.gov/historical-election-results/'


def build_inventory(snapshot, datasets, old_inventory, reviews=None):
    reviews = reviews or {}
    records = [r for rows in datasets for r in rows]
    year_counts = Counter(r['year'] for r in records)
    source_counts = Counter(r.get('source','').split('#')[0] for r in records)
    pending = {r['year']:r for r in old_inventory}
    elections = []
    for line in snapshot['markdown'].splitlines():
        if not line.startswith('- '): continue
        urls = re.findall(r'\]\((https://vote\.utah\.gov/[^)]+\.(?:pdf|xlsx?))\)',line,re.I)
        if not urls: continue
        label = re.sub(r'\[([^]]+)\]\([^)]+\)',r'\1',line[2:]).strip()
        label = re.sub(r'\s*\(\s*(?:PDF|Excel)\s*\)\s*',' ',label,flags=re.I).strip(' ()')
        match = re.match(r'(\d{4})\s+(.*)',label)
        if not match: continue
        year = int(match[1]); title = match[2].strip()
        kind = 'presidential-primary' if 'Presidential' in title else 'special-primary' if 'Special' in title and 'Primary' in title else 'special-general' if 'Special' in title else 'primary' if 'Primary' in title else 'general'
        sources = []
        for url in dict.fromkeys(urls):
            filename = url.rsplit('/',1)[-1]
            file_year = re.match(r'((?:19|20)\d{2})',filename)
            mismatch = bool(file_year and int(file_year[1]) != year)
            verification = reviews.get(url, {})
            verified_year = verification.get('documentYear')
            count = source_counts[url]
            sources.append({'url':url,'format':filename.rsplit('.',1)[1].lower(),'recordsUsingThisSource':count,
                            'filenameYearMismatch':mismatch,'verifiedDocumentYear':verified_year,
                            'needsYearVerification':mismatch and verified_year != year,
                            'verification':verification})
        matched = sum(s['recordsUsingThisSource'] for s in sources)
        mismatch = any(s['needsYearVerification'] for s in sources)
        remaining = list(pending.get(year,{}).get('remainingWork',[])) if kind=='general' else []
        remaining += [issue for source in sources for issue in source['verification'].get('remainingWork',[])]
        status = 'year_mismatch' if mismatch else 'partially_imported' if matched and remaining else 'source_used' if matched else 'source_not_imported'
        if status == 'source_not_imported' and year == 2020 and kind in {'general','primary'}:
            status = 'covered_by_existing_pipeline'
        elections.append({'yearLabel':year, 'ocrCached':(ROOT/f'.firecrawl/state-history/{year}-{kind}.md').exists(),'label':label,'kind':kind,'status':status,
                          'existingRecordsForYear':year_counts[year], 'recordsUsingLinkedSources':matched,
                          'remainingKnownWork':remaining, 'coverageNote':('The existing 2020 generator reads these canvass workbooks but its records link to the election-records landing page.' if status == 'covered_by_existing_pipeline' else ''),'sources':sources})
    return {'indexUrl':INDEX,'retrievedOn':date.today().isoformat(),
            'scope':'Source-level audit. A source not imported does not mean the election year has no records. Alternate formats are grouped by election; unrelated primary, special, and presidential contests stay separate.',
            'elections':elections}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--index',type=Path,default=ROOT/'.firecrawl/state-history-current.json')
    args = ap.parse_args()
    data = ROOT/'src/data'
    datasets = [json.loads((data/name).read_text()) for name in ['historical-candidates.json','local-candidates.json','researched-candidates.json','newspaper-candidates.json'] if (data/name).exists()]
    reviews=json.loads((ROOT/'src/data/history/state-source-reviews.json').read_text())
    manifest=json.loads((ROOT/'src/data/history/reviewed-state-rosters.json').read_text())
    for key,source in manifest['sources'].items():
        reviews.setdefault(source['url'],{}).update(documentYear=source['year'],reviewMethod=source['reviewMethod'],rosterScope=source['scope'],remainingWork=source.get('remainingWork',[]),reviewedCandidateColumns=sum(r['sourceDocument']==key for r in manifest['records']))
    report = build_inventory(json.loads(args.index.read_text()),datasets,json.loads((ROOT/'reports/historical-backfill-1994-2012.json').read_text()),reviews)
    path = ROOT/'reports/state-election-source-inventory.json'
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(f'{len(report["elections"])} election documents/groups: {dict(Counter(e["status"] for e in report["elections"]))}')

if __name__=='__main__': main()
