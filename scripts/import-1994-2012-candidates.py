#!/usr/bin/env python3
"""Import reviewed 1994–2012 ballot rosters and track remaining source coverage.

Requires xlrd for legacy Excel: uv run --with xlrd python scripts/import-1994-2012-candidates.py --use-cache
PDFs require Poppler's pdftotext. Unreviewed sources are inventoried, never imported.
"""
import argparse
from collections import Counter
import importlib.util
import json
from pathlib import Path
import re
import subprocess

from generate_state_backfill import read_workbook, nearest_heading, deduplicate

spec = importlib.util.spec_from_file_location('pre2017', Path(__file__).with_name('import-pre2017-candidates.py'))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
ROOT, CACHE, STATE, COUNTY = base.ROOT, base.CACHE, base.STATE, base.COUNTY
SOURCES = {
    '2012-general': STATE + '2012-General-Canvass-Report.xls',
    '2012-primary': STATE + '2012-Primary-Canvass-Reports-1.xlsx',
    '2010-general': STATE + '2010Gen.xls',
    '2010-primary': STATE + '2010-Primary-Canvass-Reports.xls',
    '2008-general': STATE + '2008Gen.xls',
    '2011-general': COUNTY + '2011-11-08-general-election-with-recount-results.pdf',
    '2011-primary': COUNTY + '2011-09-13-primary-election.pdf',
    '2009-general': COUNTY + '2009-11-03-municipal-general-election.pdf',
    '2009-primary': COUNTY + '2009-09-15-municipal-primary-election.pdf',
    '2007-general': COUNTY + '2007-11-06-general-election.pdf',
    '2007-primary': COUNTY + '2007-09-11-primary-election.pdf',
}
DATES = dict(zip(SOURCES, ['2012-11-06','2012-06-26','2010-11-02','2010-06-22','2008-11-04',
                          '2011-11-08','2011-09-13','2009-11-03','2009-09-15','2007-11-06','2007-09-11']))
for year, general, primary in [
    (1997, '1997-11-04-municipal-general-election.pdf', '1997-10-07-municipal-primary-election.pdf'),
    (1999, '1999-11-00-municipal-general-election.pdf', '1999-10-05-municipal-primary-election.pdf'),
    (2005, '2005-11-08-municipal-general-election.pdf', '2005-10-04-municipal-primary-election.pdf'),
    (2003, '2003-11-04-municipal-general-election.pdf', '2003-10-07-municipal-primary-election.pdf'),
    (2001, '2001-11-06-municipal-general-election.pdf', '2001-10-02-municipal-primary-election.pdf'),
]:
    for kind, filename in [('general', general), ('primary', primary)]:
        key = f'{year}-{kind}'
        SOURCES[key] = COUNTY + filename
        DATES[key] = filename[:10] if key != '1999-general' else '1999-11-02'

for year in range(1994, 2009, 2):
    if year == 2000:
        SOURCES['2000-primary'] = STATE+'2000Pri.xls'
    else:
        SOURCES[f'{year}-primary'] = STATE+(f'{year}Pri.pdf' if year != 2008 else '08-Primary-Election-Results.pdf')
    DATES[f'{year}-primary'] = {1994:'1994-06-28',1996:'1996-06-25',1998:'1998-06-23',2000:'2000-06-27',2002:'2002-06-25',2004:'2004-06-22',2006:'2006-06-27',2008:'2008-06-24'}[year]
for year, file, date in [(2000,'2000PresPri.pdf','2000-03-10'),(2008,'2008WSPprimary.pdf','2008-02-05')]:
    SOURCES[f'{year}-presidential-primary'] = STATE+file
    DATES[f'{year}-presidential-primary'] = date

for year in range(1994, 2007, 2):
    SOURCES[f'{year}-general'] = STATE+f'{year}Gen.pdf'
    DATES[f'{year}-general'] = {1994:'1994-11-08',1996:'1996-11-05',1998:'1998-11-03',2000:'2000-11-07',2002:'2002-11-05',2004:'2004-11-02',2006:'2006-11-07'}[year]

PARTIES = {'R':'Republican', 'D':'Democratic', 'C':'Constitution', 'L':'Libertarian',
           'G':'Green', 'GP':'Green', 'U':'Unaffiliated', 'J':'Justice', 'PC':'Personal Choice',
           'REPUBLICAN':'Republican', 'DEMOCRATIC':'Democratic', 'CONSTITUTION':'Constitution',
           'LIBERTARIAN':'Libertarian','GREEN PARTY':'Green', 'PEACE AND FREEDOM':'Peace and Freedom',
           'PARTY FOR SOCIALISM AND LIBERATION':'Party for Socialism and Liberation'}


def office_name(value):
    value = re.sub(r'\s+', ' ', value).strip().replace('Distict', 'District').replace('Distrtict', 'District')
    value = re.sub(r' - Write-In Candidates$', '', value, flags=re.I)
    value = re.sub(r'^United States Senate$', 'U.S. Senate', value)
    value = re.sub(r'^Congressional District', 'U.S. House District', value)
    value = value.replace('U.S House', 'U.S. House')
    value = re.sub(r'^School Board (\d+)$', r'State School Board District \1', value)
    if value == 'Republican for President': value = 'U.S. President & Vice President'
    if value == 'President & Vice President': value = 'U.S. President & Vice President'
    return base.office_name(value)


def ballot_name(value):
    value = re.sub(r'\s+', ' ', value).strip()
    match = re.search(r'\s*(?:"([^"]+)"|\(([^)]+)\))\s*$', value)
    party = ''
    if match:
        code = (match[1] or match[2]).upper().strip()
        if code in PARTIES or re.fullmatch(r'WRITE\s*-?\s*IN', code):
            value = value[:match.start()].strip()
            party = PARTIES.get(code, '')
        else:
            raise ValueError(('Unknown party suffix', value, code))
    return value, party


def workbook(path):
    if path.suffix == '.xlsx':
        return {s: {r-1: {c-1:v for c,v in cells.items()} for r,cells in rows.items()}
                for s,rows in read_workbook(path).items()}
    import xlrd
    book = xlrd.open_workbook(path)
    return {s.name: {r: {c:v for c,v in enumerate(s.row_values(r)) if isinstance(v,str) and v.strip()}
                     for r in range(s.nrows)} for s in book.sheets()}


def state_records(key, path):
    output = []
    primary = key.endswith('primary')
    for sheet, rows in workbook(path).items():
        if key == '2000-primary' and sheet != '2000 Primary Election': continue
        if sheet.strip().lower() in {'straight party','straight party votes','amendments','constitutional amd.',
                                     'constitutional amendments','justice court'}: continue
        heading_row, candidate_row = (2,3) if primary and not key.startswith('2000') else (0,1)
        headings = {c:re.sub(r'\s+', ' ',v).strip() for c,v in rows.get(heading_row,{}).items() if c>=(3 if key.startswith('2000') else 4) and v}
        if not headings: continue
        if sheet.strip() == 'Judicial' and key.startswith('2012'):
            for heading in headings.values():
                match = re.fullmatch(r'(.+), ((?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Supreme|Court of).+)',heading)
                if not match: raise ValueError((key,heading))
                item = base.record(key, match[1], 'Judge of the '+match[2], section='State Judicial')
                item['sourceStatus'] = 'Judicial Retention Candidate'
                output.append(item)
            continue
        judicial = sheet.strip() in {'Judicial','Judges'}
        for col, candidate in rows.get(candidate_row,{}).items():
            if col<(3 if key.startswith('2000') else 4) or not candidate.strip(): continue
            heading = nearest_heading(headings,col)
            if key == '2000-primary':
                name, party = ballot_name(candidate)
            elif primary:
                match = re.search(r'\s+(Republican|Democratic|Constitution)$',heading)
                if heading == 'Republican for President':
                    party, heading = 'Republican', 'U.S. President & Vice President'
                else:
                    if not match and heading not in {'Attorney General', 'State Auditor'}: raise ValueError((key,heading))
                    party, heading = (match[1], heading[:match.start()]) if match else ('', heading)
                name = candidate
            else: name,party = ballot_name(candidate)
            office = ('Judge of the '+heading) if judicial else office_name(heading)
            item = base.record(key,name,office,party,section='State Judicial' if judicial else None)
            if judicial: item['sourceStatus'] = 'Judicial Retention Candidate'
            # Some old canvasses publish surname-only tickets; retain exactly that identity.
            if item['office'] in {'U.S. President & Vice President','Governor & Lieutenant Governor'} and ' & ' in item['name'] and len(set(item['name'].split(' & ',1))) == 2:
                item['name'],item['runningMate'] = item['name'].split(' & ',1)
                item['id'] = base.slug(item['name'])
            if item['office'].startswith('U.S.'): item['section']='Federal Offices'
            output.append(item)
    assert output, key
    return output


def municipal_records(key, text):
    output = []
    # Some 1999 PDF tables put name, total and percentage on separate lines.
    text = re.sub(r'([^\n]+)\n\s*([\d,]+)\n\s*(\d*\.\d+%)', r'\1    \2    \3', text)
    text = re.sub(r'(COUNCIL|AT-)\s*\n\s*(MEMBER|#\d|LARGE)', r'\1 \2', text)
    text = re.sub(r'([A-Z ]+)\n\s*(COUNCIL \d+)', r'\1 \2', text)
    text = text.replace('AT- LARGE', 'AT LARGE')
    text = re.sub(r'\bTAYLORSVIL\b', 'TAYLORSVILLE', text)
    text = text.replace('CNCL MMBR', 'COUNCIL')
    text = text.replace('SLC ', 'SALT LAKE CITY ').replace('HOLLADAY-COTTONWOOD', 'HOLLADAY').replace('HOLL-COTT', 'HOLLADAY')
    text = re.sub(r'\s*-?VOTE FOR \d+', '', text, flags=re.I)
    text = re.sub(r'([24]) YEAR\s*\nTERM', r'\1 YEAR TERM', text)
    # The 1999 general PDF contradicts its district-6 section heading with a
    # repeated district-4 subheading. Withhold that ambiguous section.
    if key == '1999-general':
        text = re.sub(r'SALT LAKE CITY COUNCIL 06.*?(?=TAYLORSVILLE|$)', 'BALLOT BOARD\n', text, flags=re.S)
    city = office = ''
    for line in text.splitlines():
        line = line.strip().replace('<', '')
        candidate = re.fullmatch(r'(.+?)\s+([\d,]+)\s+\d*\.\d+\s*%?', line)
        if candidate:
            name = candidate[1].strip().lstrip('*').strip()
            if not office or name.lower().startswith(('precincts counted', 'precincts reporting', 'registered voters', 'ballots cast', 'times counted', 'number of', 'total votes', 'prcnts counted')): continue
            if re.fullmatch(r'(?:write[- ]?in(?: votes)?|no other candidate|for|against|yes|no)', name, re.I): continue
            name = re.sub(r'\s*\(WRITE[- ]IN\)$', '', name, flags=re.I)
            output.append(dict(base.record(key, name, office, city=city), votes=int(candidate[2].replace(',', ''))))
            continue
        if line == 'Back To Top':
            office = ''
            continue
        # Reset before heading recognition, including abbreviated recreation districts.
        if re.search(r'\b(?:SCHOOL|BOARD|BRD|JUDGE|COURT|CANYON|RECREATION|REFERENDUM|BOND|PROPOSITION|INITIATIVE|PROP)\b', line):
            office = ''
            continue
        # Statistical rows and wrapped table contents are not contest headings.
        if not re.search(r'COUNCIL|CNCL|MAYOR|MUNICIPAL|CITY$|BOND|PROPOSITION|DISTRICT|BOARD|REFERENDUM|INCORPORATION|INITIATIVE|AT[- ]LARGE|JUDGE|COURT|QUESTION|PROP\b|BRD', line): continue
        if re.search(r'BOND|PROPOSITION|BOARD|REFERENDUM|INCORPORATION|INITIATIVE|CANYON|JUDGE|COURT|QUESTION|PROP\b|BRD', line):
            office = ''
            continue
        heading = re.sub(r'^FOR ', '', line)
        heading = re.sub(r'\s+NP\s*$', '', heading)
        heading = re.sub(r'\s*\(RECOUNT\)', '', heading)
        heading = re.sub(r'^MUNICIPAL ', '', heading)
        for old, new in [(' CTY ', ' CITY '), (' CNCL ', ' COUNCIL '), (' @ LRG', ' AT LARGE'),
                         (' AT LRG', ' AT LARGE'), ('AT-LRG', 'AT LARGE'), ('AT-LARGE', 'AT LARGE'),
                         ('SOUTH SL CITY', 'SOUTH SALT LAKE CITY'), ('COTTONWOOD CITY', 'COTTONWOOD HEIGHTS CITY'),
                         ('SALT LAKE COUNCIL', 'SALT LAKE CITY COUNCIL')]:
            heading = heading.replace(old, new)
        for possible in sorted(base.CITIES, key=len, reverse=True):
            if heading == possible.upper() or heading.startswith(possible.upper()+' '):
                city = possible
                heading = heading[len(possible):].strip()
                heading = re.sub(r'^CITY\b', '', heading).strip()
                office = ''
                break
        heading = re.sub(r'^CITY ', '', heading)
        heading = heading.replace('COUNCIL COUNCIL MEMBER', 'COUNCIL').replace('COUNCIL MEMBER', 'COUNCIL')
        heading = re.sub(r' CITY (?:CNCL|COUNCIL)(?= |$)', '', heading)
        heading = re.sub(r'\bDIST(?:RICT)?\s*#?', 'DISTRICT ', heading)
        heading = re.sub(r'^COUNCIL #?0?(\d+)\b', r'COUNCIL DISTRICT \1', heading)
        term = re.search(r'([24])[- ]?(?:YEAR|YR)(?: TERM)?', heading, flags=re.I)
        term_number = term[1] if term else ''
        heading = re.sub(r'\(?[24][- ]?(?:YEAR|YR)(?: TERM)?\)?', '', heading, flags=re.I)
        heading = re.sub(r'\s+', ' ', heading).strip()
        heading = heading.replace('COUNCIL AT LARGE AT LARGE', 'COUNCIL AT LARGE')
        if heading == 'COUNCIL' and term_number: heading = 'COUNCIL AT LARGE'
        if city and re.match(r'^(?:COUNCIL|MAYOR)\b', heading):
            office = city+' '+heading.title().replace('At Large', 'at Large')
            if term_number == '2': office += ' (2-Year Term)'
    assert output, key
    return output


def reviewed_records():
    output = {}
    path = ROOT/'src/data/history/reviewed-canvass-rosters.tsv'
    for line in path.read_text().splitlines():
        if not line.strip() or line.startswith('#'): continue
        key, page, office, party, names = line.split('|')
        assert key in SOURCES, key
        for name in names.split(';'):
            item = base.record(key, name, office, party)
            item['electionType'] = 'primary' if key.endswith('primary') else 'general'
            item['source'] += '#page='+page
            if office.startswith('U.S.'): item['section'] = 'Federal Offices'
            if office.startswith(('Judge of', 'Justice of')):
                item['section'] = 'State Judicial'
                item['sourceStatus'] = 'Judicial Retention Candidate'
            output.setdefault(key, []).append(item)
    return output


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--use-cache',action='store_true')
    args=parser.parse_args()
    CACHE.mkdir(parents=True,exist_ok=True)
    base.SOURCES.update(SOURCES); base.DATES.update(DATES)
    additions=[]; counts={}
    reviewed = reviewed_records()
    for key,url in SOURCES.items():
        path=CACHE / url.rsplit('/',1)[1]
        if key in reviewed:
            rows = reviewed[key]
            counts[key] = len(rows); additions.extend(rows)
            print(key, len(rows))
            continue
        if not args.use_cache or not path.exists():
            subprocess.run(['curl','--fail','-sSL',url,'-o',str(path)],check=True)
        if path.suffix in {'.xls','.xlsx'}: rows=state_records(key,path)
        else: rows=municipal_records(key,subprocess.check_output(['pdftotext','-layout',str(path),'-'],text=True))
        counts[key]=len(rows); additions.extend(rows)
        print(key,len(rows))
    additions=deduplicate(additions)
    archive=ROOT/'src/data/historical-candidates.json'
    imported_years={r['year'] for r in additions}
    existing=json.loads(archive.read_text())
    archive.write_text(json.dumps(deduplicate([r for r in existing if r['year'] not in imported_years]+additions),ensure_ascii=False,indent=2)+'\n')
    newspaper = json.loads((ROOT/'src/data/newspaper-candidates.json').read_text())
    inventory=[]
    for year in range(2012,1993,-1):
        sources=[{'key':key,'url':url,'ballotEntries':counts[key]} for key,url in SOURCES.items() if key.startswith(str(year))]

        newspaper_count = sum(r['year']==year for r in newspaper)
        for source in sources:
            if source['key'] in reviewed:
                source['reviewedPages'] = sorted({int(r['source'].rsplit('#page=',1)[1]) for r in reviewed[source['key']]})
        if year==1995:
            sources = [{'key':'1995-existing-newspaper', 'url':next(r['source'] for r in newspaper if r['year']==1995)}]
        inventory.append({'year':year, 'existingNewspaperRecords':newspaper_count,'records':sum(r['year']==year for r in additions),
                          'remainingWork': {1996:['Judicial-retention page 17 remains for review.'],1998:['One obscured Third Juvenile Court name on page 11 remains unresolved.'],1999:['Salt Lake City general district 6 has conflicting headings; omitted.','August Holladay incorporation primary remains for review.'],2000:['General legislative, school-board and judicial rosters remain for review.'],2002:['General legislative, school-board and judicial rosters remain for review.'],2004:['General legislative, school-board and judicial rosters remain for review.'],2006:['General single-county House pages 8–18 remain for review.','Published PDF repeats Senate tables on pages 19–20 where multi-county House coverage is expected; county sources are needed.']}.get(year, []),
                          'status':('partial' if year in {1996,1998,2000,2002,2004,2006,1999} else 'imported') if year in imported_years else 'existing_unofficial' if newspaper_count else 'pending',
                          'coverage':'Existing statewide unofficial newspaper returns' if year==1995 else 'Selected official state canvass ballot roster' if year%2==0 else 'Salt Lake County municipal ballot roster',
                          'limitations': ('Existing newspaper records are preserved in their separate dataset; no new 1995 records are added by this importer. ' if year==1995 else '') + ('General-election import covers selected reviewed PDF pages; additional pages remain for review. ' if year in {1996,1998,2000,2002,2004,2006} else '') + ('Older canvasses vary in legislative coverage; additional county sources are needed for full statewide coverage. ' if year in {1994,1996,1998,2000,2002,2004,2006} else '') + ('1999 general Salt Lake City District 6 withheld because section and subheading conflict; Holladay incorporation primary remains pending. ' if year==1999 else '') +
                          ('Justice-court sheet excluded; surname-only tickets retained as published. ' if year in {2008,2010} else '') +
                          'Ballot rosters are not complete filing lists; no outcomes inferred. Unpublished or ambiguous party labels are left blank.',
                          'sources':sources, 'sourceIndex': 'https://www.saltlakecounty.gov/clerk/elections/election-results/' if year%2 else 'https://vote.utah.gov/historical-election-results/'})
    (ROOT/'reports/historical-backfill-1994-2012.json').write_text(json.dumps(inventory,indent=2)+'\n')
    print('Distinct records:',dict(sorted(Counter(r['year'] for r in additions).items())))

if __name__=='__main__': main()
