#!/usr/bin/env python3
"""Normalize all supported result sources, preserving every listed ballot option.

python3 scripts/import-all-results.py [--use-cache]
Official workbook adapters, API publication adapters, reviewed municipal returns,
and the 2022 reviewed baseline feed one contract. Roster-only PDFs stay explicitly
listed as pending vote extraction; OCR alone is never treated as reviewed facts.
"""
import argparse
from collections import defaultdict
import importlib.util
import json
from pathlib import Path
import re
import subprocess
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor

from generate_state_backfill import read_workbook, clean_office, slug, display_name, PARTY_CODES, section_for
from result_contract import validate_contest, atomic_json

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.firecrawl/normalized-results'
COUNTIES = ['Beaver','Box Elder','Cache','Carbon','Daggett','Davis','Duchesne','Emery','Garfield','Grand','Iron','Juab','Kane','Millard','Morgan','Piute','Rich','Salt Lake','San Juan','Sanpete','Sevier','Summit','Tooele','Uintah','Utah','Wasatch','Washington','Wayne','Weber']
DATES = {2014: {'general':'2014-11-04','primary':'2014-06-24'},2016:{'general':'2016-11-08','primary':'2016-06-28'},2017:{'general':'2017-11-07'},2018:{'general':'2018-11-06','primary':'2018-06-26'},2020:{'general':'2020-11-03','primary':'2020-06-30','presidential-primary':'2020-03-03'}}
SKIP_SHEETS = {'straight party votes','amendments','constitutional amd.','cover','toc','front page','voter turnout','total ballots cast','straight ticket','straight party','con. amend.','constitutional amendments'}
AGGREGATE = re.compile(r'^(?:yes|no|for|against|write[ -]?ins?(?: votes)?|adjudicated write[ -]?ins?|total|undervotes?|overvotes?)$', re.I)


def county_id(name): return slug(re.sub(r'\s+County$', '', name, flags=re.I)) + '-county-ut'
def key(value): return re.sub(r'[^a-z0-9]', '', value.lower())
def category(office):
    for prefix, label in [('U.S.', 'Federal'),('State Senate','State Senate'),('State House','State House'),('State School Board','School board')]:
        if office.startswith(prefix): return label
    return 'Local & measures'


def office_name(value):
    value = re.sub(r'\s+', ' ', value).strip().replace('Utah Governor', 'Governor')
    value = re.sub(r'\s*-\s*Write-in Candidates$', '', value, flags=re.I)
    value = re.sub(r'^(State (?:House|Senate|School Board)) (\d+)$', r'\1 District \2', value)
    if value=='U.S. President':value='U.S. President & Vice President'
    return clean_office(value)


def ballot_name(value):
    value = re.sub(r'\s+', ' ', value).strip()
    party = ''
    for label in re.findall(r'\(([^)]+)\)',value):
        mapped = PARTY_CODES.get(label.upper()) or {'ind. american':'Independent American','united utah':'United Utah','democratic':'Democratic','republican':'Republican','libertarian':'Libertarian','constitution':'Constitution','green':'Green','unaffiliated':'Unaffiliated'}.get(label.lower())
        if mapped or re.fullmatch('write-?in', label, re.I):
            party = mapped or party
            value = value.replace('('+label+')','')
    return display_name(re.sub(r'\s+', ' ', value).strip()), party


def integer(value):
    value = value.replace(',', '').strip()
    if not value: return None
    assert re.fullmatch(r'\d+(?:\.0+)?', value), f'Invalid vote cell: {value!r}'
    return int(float(value))


def parse_workbook(path, source, year, stage):
    contests = []
    if path.suffix=='.xls':
        import xlrd
        book=xlrd.open_workbook(path)
        sheets={sheet.name:{r+1:{c+1:str(v).strip() for c,v in enumerate(sheet.row_values(r)) if v!=''} for r in range(sheet.nrows)} for sheet in book.sheets()}
    else:sheets=read_workbook(path)
    legacy=load_module('legacy_workbook','import-1994-2012-candidates.py') if year<2014 else None
    for sheet, rows in sheets.items():
        if not any(v for cells in rows.values() for v in cells.values()):continue
        if year==2000 and sheet!='2000 Primary Election':continue
        if sheet.lower().strip() in SKIP_SHEETS or 'turnout' in sheet.lower() or sheet.startswith('Rejected '): continue
        # Workbook versions have explicit header layouts; never infer names from vote rows.
        special = year == 2017
        presidential = stage == 'presidential-primary'
        candidate_row = 2 if (year == 2014 and stage == 'general') or special or presidential else 4 if stage == 'primary' else 3
        heading_row = 3 if year == 2014 and stage == 'primary' else 1
        if year<2014:
            candidate_row=4 if stage=='primary' and year!=2000 else 2
            heading_row=3 if stage=='primary' and year!=2000 else 1
            if sheet.strip() in ['Judicial','Judges'] and year in [2008,2010]:candidate_row=3;heading_row=2
        first = 4 if year==2000 else 5 if year<=2014 else 3 if presidential else 2
        if sheet.strip()=='Justice Court':candidate_row=3;heading_row=2;first=3
        headings = {c:v for c,v in rows.get(heading_row,{}).items() if c>=first and v}
        if not headings and special: headings = {2:'U.S. House District 3'}
        if special: headings = {2:'U.S. House District 3'}
        if presidential: headings = {3:'U.S. President & Vice President'}
        assert headings, (path.name,sheet,'missing headings')
        totals = [(r,cs) for r,cs in rows.items() if re.fullmatch(r'totals?|total votes cast per candidate'+('|votes' if special else ''),cs.get(1,'').strip(),re.I)]
        assert len(totals)==1, (path.name,sheet,'expected one candidate-total row',len(totals))
        total_row, total_cells = totals[0]
        groups = {}
        for col, raw in rows.get(candidate_row,{}).items():
            if col<first or not raw:continue
            heading_col = max(c for c in headings if c<=col)
            office = headings[heading_col]
            party = ''
            if stage == 'primary':
                if year <= 2014 and year!=2000:
                    if office=='Republican for President':office='U.S. President & Vice President Republican'
                    match = re.search(r' (Republican|Democratic|Constitution)$',office)
                    assert match or office in ['Attorney General','State Auditor'], office
                    if match:party=match[1];office=office[:match.start()]
                else:
                    party_cols={c:v for c,v in rows.get(3,{}).items() if v and c<=col}
                    party=party_cols[max(party_cols)] if party_cols else ''
                    if party.lower() in ['non-partisan','nonpartisan']:party=''
            if presidential:party=sheet
            office=legacy.office_name(office) if legacy else office_name(office)
            name, ballot_party=legacy.ballot_name(raw) if legacy else ballot_name(raw)
            party=ballot_party or party
            judicial = sheet.lower().strip() in ['judicial','judges','justice court']
            response=bool(re.fullmatch('yes|no|for|against',name,re.I))
            kind='retention' if judicial else 'measure' if response else 'candidate'
            if judicial and year in [2008,2010]:
                judge_name=office
                court_headings={c:v for c,v in rows[1].items() if c>=first and v and c<=heading_col}
                court=court_headings[max(court_headings)] if court_headings else 'Justice Court'
                office='Judge of the '+court
            elif judicial:
                judge=re.match(r'(.+?),?\s+((?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Judge of the|Justice of the|Utah Supreme Court|Supreme Court|Utah Court of Appeals|Court of Appeals|\d+\w* (?:District|Dist)|[A-Z][a-z]+(?: [A-Z][a-z]+)* (?:Municipal|Justice)).*)$',office)
                assert judge,(path.name,office)
                judge_name,court=judge.groups()
                office=court if court.startswith(('Judge of','Justice of')) else ('Justice of the ' if 'Supreme' in court else 'Judge of the ')+court
            group=groups.setdefault((heading_col,office,party if stage!='general' else ''),{'name':office,'kind':kind,'columns':[],'party':party if stage!='general' else ''})
            if judicial:group['judgeName']=judge_name.rstrip(', ')
            group['columns'].append((col,name,party))
        for (heading_col,office,_),group in groups.items():
            cid=f'{year}-{stage}-{slug(sheet)}-{heading_col}'
            opts=[dict(id=f'{cid}-{col}',name=name,party=party,votes=integer(total_cells.get(col,'')),winner=None,sourceName=rows[candidate_row][col]) for col,name,party in group['columns']]
            counties=[]
            for r,cells in rows.items():
                county=re.sub(r' County$','',cells.get(1,'').strip())
                if r<=candidate_row or r>=total_row or county not in COUNTIES:continue
                if not any(cells.get(col,'') for col,_,_ in group['columns']):continue
                # Blank cells within a participating county are retained as missing, not zero.
                values=[integer(cells.get(col,'')) for col,_,_ in group['columns']]
                if any(v is None for v in values):continue
                copts=[dict(o,votes=v) for o,v in zip(opts,values)]
                counties.append(dict(id=county_id(county),total=sum(values),options=copts,reporting=None))
            total=sum(o['votes'] for o in opts) if all(o['votes'] is not None for o in opts) else None
            contest=dict(id=cid,name=office,category='Judicial retention' if group['kind']=='retention' else category(office),kind=group['kind'],county=None,seats=1,total=total,options=sorted(opts,key=lambda o:-(o['votes'] or 0)),counties=counties,reporting=None,source=source,sourceSheet=sheet,sourceTotalRow=total_row,electionDate=DATES[year][stage],year=year,electionType=stage,official=True,asOf='',party=group['party'])
            if 'judgeName' in group:contest['judgeName']=group['judgeName']
            contests.append(validate_contest(contest))
    assert contests,path
    # Some workbooks put named write-ins in a separate panel of the same race.
    merged={}
    for contest in contests:
        identity=(contest['name'],contest['party'],contest.get('judgeName',''),contest['kind'])
        if identity not in merged:
            merged[identity]=contest
            contest['sourceLocations']=[dict(sheet=contest['sourceSheet'],totalRow=contest['sourceTotalRow'])]
            continue
        previous=merged[identity]
        previous['options'].extend(contest['options'])
        previous['options'].sort(key=lambda o:-(o['votes'] or 0))
        previous['total']=sum(o['votes'] for o in previous['options']) if all(o['votes'] is not None for o in previous['options']) else None
        previous['sourceLocations'].append(dict(sheet=contest['sourceSheet'],totalRow=contest['sourceTotalRow']))
        counties={row['id']:row for row in previous['counties']}
        for row in contest['counties']:
            if row['id'] in counties:
                counties[row['id']]['options'].extend(row['options']);counties[row['id']]['total']+=row['total']
            else:previous['counties'].append(row)
        validate_contest(previous)
    return list(merged.values())


def load_module(name, filename):
    spec=importlib.util.spec_from_file_location(name, ROOT/'scripts'/filename)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module


def workbook_sources(use_cache):
    inventory=json.loads((ROOT/'reports/state-election-source-inventory.json').read_text())
    output=[]
    for election in inventory['elections']:
        year=election['yearLabel']
        if year not in DATES:continue
        for source in election['sources']:
            url=source['url']
            if not url.endswith('.xlsx'):continue
            stage='presidential-primary' if 'Presidential' in election['label'] else 'primary' if 'Primary' in election['label'] else 'general'
            path=CACHE/url.rsplit('/',1)[1]
            if not use_cache or not path.exists():
                with urlopen(Request(url,headers={'User-Agent':'ElectionsUtahData/1.0'}),timeout=60) as response:path.write_bytes(response.read())
            output.extend(parse_workbook(path,url,year,stage))
    legacy=load_module('legacy_sources','import-1994-2012-candidates.py')
    for source_key,url in legacy.SOURCES.items():
        if not url.endswith(('.xls','.xlsx')):continue
        year=int(source_key[:4]);stage=source_key.split('-',1)[1]
        DATES.setdefault(year,{})[stage]=legacy.DATES[source_key]
        path=legacy.CACHE/url.rsplit('/',1)[1]
        if not use_cache or not path.exists():
            with urlopen(Request(url,headers={'User-Agent':'ElectionsUtahData/1.0'}),timeout=60) as response:path.write_bytes(response.read())
        output.extend(parse_workbook(path,url,year,stage))
    return output


def api_sources(use_cache):
    """Read every listed state/county option, including zero-vote candidates and aggregates."""
    local=load_module('local_import','import-local-contests.py')
    output=[]
    cities=local.municipalities(use_cache)
    for election,year,stage,date in local.ELECTIONS:
        state=local.fetch_json(f'{local.API}/Utah/{election}/data',f'Utah_{election}_data.json',use_cache)
        localities=state['jurisdiction']['childLocalities']
        def load(row):
            locality=row['shortName']
            return locality,local.fetch_json(f'{local.API}/{locality}/{election}/data',f'{locality}_{election}_data.json',use_cache)
        with ThreadPoolExecutor(6) as pool:publications=[('Utah',state),*pool.map(load,localities)]
        for locality,data in publications:
            if not data:continue
            for item in data.get('ballotItems',[]):
                if locality!='Utah' and item.get('parentId'):continue
                rounds=item.get('rankedChoiceSummaryResults') or []
                options=(rounds[0]['ballotOptions'] if rounds else local.options_of(item))
                if rounds:
                    first_ids={o['id'] for o in options}
                    options=options+[{**o,'voteCount':None} for o in {o['id']:o for round in rounds for o in round['ballotOptions']}.values() if o['id'] not in first_ids]
                if not options:continue
                raw=local.text(item['name'])
                state_party=re.match(r'^(Republican|Democratic)(?: Candidate)? For (.+)$',raw,re.I) if locality=='Utah' else None
                county=next((name for name in COUNTIES if county_id(name)==locality),'')
                # Reuse the reviewed local office/geography classifier, without dropping unmatched contests.
                classified=local.classify(raw,county,cities[county],year) if county else None
                office=classified[1] if classified and classified[0]!='Unmatched' else office_name(state_party[2] if state_party else raw)
                city=classified[2] if classified and classified[0]!='Unmatched' else ''
                party=classified[3] if classified else state_party[1].title() if state_party else local.text(item.get('partyName'))
                opts=[]
                for option in options:
                    name,oparty=local.candidate_party(option,party)
                    # candidate_party deliberately rejects ballot responses; retain the published label here.
                    name=name or local.text(option['name']) or '[Unnamed ballot option]'
                    votes=option.get('voteCount')
                    opts.append(dict(id=option['id'],name=name,party=oparty,votes=votes,winner=option.get('isWinner'),isCandidate=bool(local.candidate_name(option)) and not bool(AGGREGATE.fullmatch(name)),sourceName=local.text(option['name'])))
                is_retention='retained' in raw.lower() or 'judicial retention' in raw.lower()
                kind='retention' if is_retention else 'measure' if item.get('contestType')=='BallotMeasure' or all(AGGREGATE.fullmatch(o['name']) for o in opts) else 'candidate'
                # Known 2023 primary publication contains roster placeholders, not published zero results.
                published=not (election=='primary09052023_Demo' and not any(o['votes'] for o in opts))
                if not published:
                    for option in opts:option['votes']=None
                output.append(validate_contest(dict(id=f'{election}-{locality}-{item["id"]}',name=office,rawName=raw,category=category(office),kind=kind,county=locality if county else None,city=city,section=classified[0] if classified else section_for(office),seats=local.seats(item,office),total=(sum(o['votes'] for o in opts) if rounds and all(o['votes'] is not None for o in opts) else item.get('voteTotal')) if published else None, publishedTotal=item.get('voteTotal'),rankedChoiceRounds=rounds,totalBasis='first-round votes' if rounds else 'published contest total',options=sorted(opts,key=lambda o:-(o['votes'] or 0)),counties=[],reporting=item.get('reportingStatus'),source=f'{local.PUBLIC}/{locality}/elections/{election}/ballot-items/{item["id"]}',official=data['election'].get('isOfficialResults',False),asOf=data['election'].get('asOf',''),year=year,electionDate=date,electionType=stage,party=party)))
    return output


def municipal_pdf_sources(use_cache):
    """Reuse reviewed text parsers and retain the totals they previously discarded.
    Scope remains Salt Lake County mayor/council contests, not every PDF contest.
    """
    output=[]
    for module_name,filename in [('pre2017_votes','import-pre2017-candidates.py'),('earlier_votes','import-1994-2012-candidates.py')]:
        module=load_module(module_name,filename)
        if hasattr(module,'base'):
            module.base.SOURCES.update(module.SOURCES);module.base.DATES.update(module.DATES)
        for source_key,url in module.SOURCES.items():
            year=int(source_key[:4])
            if year%2==0 or not url.endswith('.pdf'):continue
            stage=source_key.split('-',1)[1]
            path=module.CACHE/(url.rsplit('/',1)[1] if module_name=='earlier_votes' else source_key+'.pdf')
            if not use_cache or not path.exists():
                with urlopen(Request(url,headers={'User-Agent':'ElectionsUtahData/1.0'}),timeout=60) as response:path.write_bytes(response.read())
            text=subprocess.check_output(['pdftotext','-layout',str(path),'-'],text=True)
            groups=defaultdict(list)
            for row in module.municipal_records(source_key,text):groups[(row['office'],row['city'])].append(row)
            for (office,city),rows in groups.items():
                cid=f'{source_key}-{slug(office)}'
                options=[dict(id=f'{cid}-{i}',name=r['name'],party=r['party'],votes=r['votes'],winner=None) for i,r in enumerate(rows)]
                # The published percentage denominator includes aggregate write-ins omitted by the
                # legacy roster parser, so don't claim these sums are full contest vote shares.
                output.append(validate_contest(dict(id=cid,name=office,category='Local & measures',kind='candidate',year=year,electionType=stage,electionDate=module.DATES[source_key],county=county_id('Salt Lake'),city=city,seats=None,total=sum(o['votes'] for o in options),options=options,counties=[],reporting=None,source=url,official=True,asOf='',totalBasis='listed named-candidate votes',coverage='Reviewed mayor/council parser; unnamed write-in totals and other contests are outside this adapter.')))
    return output


def existing_sources():
    output=[]
    for year in [2022,2024,2026]:
        name='2022-shift-baseline.json' if year==2022 else f'{year}-results.json'
        data=json.loads((ROOT/'public/data'/name).read_text())
        for c in data['contests']:
            # Prefer the detailed, current snapshot over older cached API publications.
            output.append(validate_contest(dict(c,kind='retention' if c['category']=='Judicial retention' else 'candidate' if c['category']!='Local & measures' else 'unknown',year=year,electionDate=data['electionDate'],electionType='general',official=data['official'],asOf=data['asOf'])))
    for c in json.loads((ROOT/'src/data/municipal-results.json').read_text()):
        opts=[dict(o,id=f'{c["id"]}-{i}',party=o.get('party',''),winner=o.get('winner')) for i,o in enumerate(c['options'])]
        output.append(validate_contest(dict(c,name=c['office'],category='Local & measures',county=county_id(c['placeId'].split('/')[0].replace('-',' ').title()),city=c['municipality'],total=c['totalCandidateVotes'],options=opts,counties=[],reporting=None,electionType=c.get('electionType','general'),asOf='',official=c['official'])))
    return output


def reviewed_primary_sources():
    """Reviewed full ballots from official documents; never fill missing API cells."""
    rows=json.loads((ROOT/'src/data/reviewed-primary-results.json').read_text())
    for row in rows:
        assert row['official'] and row['electionType']=='primary' and type(row['reviewedSelection']) is bool
        assert row['sourcePage']>0 and len(row['sourceSha256'])==64
        validate_contest(row)
        assert row['votesPublished'] and row['optionTotalsReconcile'], row['id']
    return rows


def deduplicate(contests):
    # Same-publication/API overlap: compare exact source URL and election stage, not similar names.
    merged={}
    for c in contests:
        identity=(c['year'],c['electionType'],c['source'].lower(),c['id'] if c.get('sourceSheet') else '' if '/ballot-items/' in c['source'] else (key(c['name']),c.get('city',''),c.get('party','')))
        if identity in merged:
            # A current per-contest publication supersedes an older cache of the same artifact.
            previous=merged[identity]
            if c.get('asOf','') < previous.get('asOf',''):continue
            previous_options={o['id']:o for o in previous['options']}
            c['options']=[{**previous_options.get(o['id'],{}),**o,'name':previous_options.get(o['id'],o)['name'],'party':previous_options.get(o['id'],o)['party']} for o in c['options']]
            if c['kind']=='unknown':c['kind']=previous['kind']
            if c.get('county'):
                c['name']=previous['name'];c['city']=previous.get('city','');c['section']=previous.get('section','County Offices')
            if c.get('kind')=='retention' and 'judgeName' in previous:c['judgeName']=previous['judgeName']
            merged[identity]=c
        else:merged[identity]=c
    return list(merged.values())


def candidate_rows(contests):
    local=load_module('candidate_labels','import-local-contests.py')
    rows={}
    for c in contests:
        if c['kind']!='candidate':continue
        for option in c['options']:
            name,party=local.candidate_party(dict(name=option['name'],party=dict(name=option['party'])), '')
            if not name:continue
            if option.get('isCandidate') is False or AGGREGATE.fullmatch(name) or name=='[Unnamed ballot option]':continue
            mate=''
            if c['name'] in ['U.S. President & Vice President','Governor & Lieutenant Governor'] and re.search(r', | & ',name):
                lead,partner=re.split(r', | & ',name,maxsplit=1)
                if slug(lead)!=slug(partner):name,mate=lead,partner
            row=dict(id=slug(name),name=display_name(name),runningMate=display_name(mate),office=c['name'],party=party,year=c['year'],electionType=c['electionType'],status='general_election' if c['electionType']=='general' else 'primary_election',sourceStatus='General Election Candidate' if c['electionType']=='general' else 'Primary Election Candidate',section=section_for(c['name']),county=next((n for n in COUNTIES if county_id(n)==c.get('county')),''),city=c.get('city',''),state='UT',source=c['source'],lastUpdated=c['electionDate'],contact=dict(address='',phone='',email='',website='',facebook='',twitter=''))
            if c.get('county'):row['section']=c.get('section') or ('Municipal Offices' if c.get('city') else 'County Offices')
            identity=(row['year'],row['electionType'],key(row['name']),key(row['office']),key(row['party']),key(row['county']),key(row['city']))
            rows[identity]=row
    # Results remain complete in the snapshots; avoid rebundling roster records already
    # present in the directory's authoritative filing/editorial datasets.
    existing=defaultdict(set)
    identity=lambda r:(r['year'],slug(r['name']).replace('-',''),slug(office_name(r['office'])).replace('-',''),slug(r.get('county','')).replace('-',''),slug(r.get('city','')).replace('-',''))
    for filename in ['historical-candidates.json','local-candidates.json','researched-candidates.json','newspaper-candidates.json','2026-candidates.json']:
        for source in json.loads((ROOT/'src/data'/filename).read_text()):
            row=dict(source)
            if filename=='2026-candidates.json':row.update(year=2026,electionType='general' if row['status']=='general_election' else 'primary')
            existing[identity(row)].add('*' if row['status']=='filed' else row['electionType'])
    return sorted([r for r in rows.values() if '*' not in existing[identity(r)] and r['electionType'] not in existing[identity(r)]],key=lambda r:(r['year'],r['electionType'],r['office'],r['name']))


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--use-cache',action='store_true')
    parser.add_argument('--reviewed-only',action='store_true',help='Apply reviewed document results to existing normalized snapshots without network requests')
    args=parser.parse_args()
    CACHE.mkdir(parents=True,exist_ok=True)
    reviewed=reviewed_primary_sources()
    if args.reviewed_only:
        reviewed_ids={row['id'] for row in reviewed}
        existing_index=json.loads((ROOT/'src/data/result-index.json').read_text())
        contests=[c for row in existing_index for c in json.loads((ROOT/'public'/row['url'].lstrip('/')).read_text())['contests'] if c['id'] not in reviewed_ids]
        contests.extend(reviewed)
    else:
        contests=deduplicate([*workbook_sources(args.use_cache),*api_sources(args.use_cache),*municipal_pdf_sources(args.use_cache),*existing_sources(),*reviewed])
    groups=defaultdict(list)
    for c in contests:groups[(c['year'],c['electionType'])].append(c)
    # Validate the full run before replacing any previously good output.
    for c in contests:validate_contest(c)
    index=[]
    for (year,stage),items in sorted(groups.items()):
        assert len({c['id'] for c in items})==len(items), (year,stage,'duplicate contest ids')
        name=f'{year}-{stage}.json'
        snapshot=dict(schemaVersion=1,election=f'{year} {stage}',electionDate=items[0]['electionDate'],asOf='',official=all(c['official'] for c in items),source='',fetchedAt='',counties=[dict(id=county_id(n),name=n+' County',asOf=None) for n in COUNTIES],contests=items)
        atomic_json(ROOT/'public/data/results'/name,snapshot)
        index.append(dict(year=year,electionType=stage,url=f'/data/results/{name}',contests=len(items),options=sum(len(c['options']) for c in items),unpublished=sum(not c['votesPublished'] for c in items)))
    atomic_json(ROOT/'src/data/result-candidates.json',candidate_rows(contests))
    atomic_json(ROOT/'public/data/results/index.json',index)
    # Keep the availability index available synchronously to avoid unsupported-year fetches.
    atomic_json(ROOT/'src/data/result-index.json',index)
    inventory=json.loads((ROOT/'reports/state-election-source-inventory.json').read_text())
    imported={c['source'].split('#')[0] for c in contests if not c.get('reviewedSelection')}
    partial={c['source'].split('#')[0] for c in contests if c.get('reviewedSelection')}
    pending=[dict(year=e['yearLabel'],election=e['label'],source=s['url'],status='Selected contest imported; remaining document contests pending vote extraction' if s['url'] in partial else 'Vote extraction pending; roster coverage is separate') for e in inventory['elections'] for s in e['sources'] if s['url'] not in imported]
    atomic_json(ROOT/'reports/result-import-coverage.json',dict(datasets=index,scope='All listed options from supported adapters. Reviewed official primary selections include full candidate ballots for their named contests only. Historic PDF rosters are separate from verified vote extraction; municipal PDF adapters cover reviewed mayor/council contests only.',unpublishedContests=[dict(id=c['id'],source=c['source'],year=c['year'],electionType=c['electionType']) for c in contests if not c['votesPublished']],sourceDiscrepancies=[dict(id=c['id'],name=c['name'],source=c['source'],year=c['year'],electionType=c['electionType']) for c in contests if c.get('optionTotalsReconcile') is False or c.get('countyTotalsReconcile') is False],pendingSources=pending))
    print(f'Normalized {len(contests)} contests, {sum(len(c["options"]) for c in contests)} listed options across {len(groups)} election/stage datasets. {sum(not c["votesPublished"] for c in contests)} contests retain unpublished votes as null.')
    for r in index:print(r)

if __name__=='__main__':main()
