"""Explicit per-account review; discovery never grants ownership approval."""
import hashlib
import html
import json
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone
from enrichment_console import say, color

ROOT = Path(__file__).resolve().parents[1]


def digest(value):
    return hashlib.sha256(value).hexdigest()


def snapshot_date(url):
    match = re.search(r'https?://web\.archive\.org/web/(\d{8})\d*(?:[a-z]+_)?/', url)
    if not match:
        return None
    try:
        return datetime.strptime(match[1], '%Y%m%d').date().isoformat()
    except ValueError:
        return None


def ask(prompt, choices=None):
    while True:
        answer = input(color(prompt,'prompt')).strip()
        if choices is None or answer.lower() in choices:
            return answer.lower() if choices else answer
        say('Choose: '+', '.join(choices))


def write_review(path, document):
    path.write_text(json.dumps(document, indent=2)+'\n')
    esc = lambda value: html.escape(str(value), quote=True)
    link = lambda url, label: '<a href="'+esc(url)+'">'+esc(label)+'</a>'
    rows = []
    for person in document['people']:
        for item in person['decisions']:
            rows.append('<tr><td>'+link(person['entityUrl'],person['name'])+'</td><td>'+link(item['candidate']['url'],item['candidate']['platform'])+'</td><td>'+esc(item['decision'])+'</td><td>'+esc(item.get('historical',False))+'</td><td>'+esc(item.get('snapshotDate') or '')+'</td><td>'+esc(item.get('ownershipEvidence',''))+' — '+link(item['candidate']['sourceUrl'],'source')+'</td></tr>')
    path.with_suffix('.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>Account ownership review</title><style>body{margin:3rem;font:15px/1.6 system-ui}td,th{padding:.6rem;text-align:left;vertical-align:top;border-bottom:1px solid #ccc}table{border-collapse:collapse;width:100%}</style><body><h1>Account ownership review</h1><p>Decisions are proposals until explicitly applied. Historical endorsement does not establish current ownership or activity.</p><p>'+link(path.name,'Review manifest')+'</p><table><tr><th>Entity</th><th>Account</th><th>Decision</th><th>Historical</th><th>Snapshot date</th><th>Ownership evidence</th></tr>'+''.join(rows)+'</table></body></html>')


def helper(mode, review_path, plan_path, token=None):
    command = ['node', str(ROOT/'scripts/apply-interactive-enrichment.mjs'), mode, str(review_path), str(plan_path)]
    if token:
        command.append(token)
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise ValueError(result.stderr.strip() or result.stdout.strip() or 'Application failed')
    return json.loads(result.stdout)


def confirm_discovery(seeds):
    for seed in seeds['seeds']:
        if seed.get('manualOverride'):
            say('Existing editorial override for '+seed['name']+':')
            say(json.dumps(seed.get('editorialOverride'),indent=2))
            say('Discovery can continue without editing this override. Any later additions require separate approval.')
            if ask('Continue discovery from the supplied/resolved website? [y/N]: ',['','y','n']) != 'y':
                say('Stopped before discovery; no changes applied.')
                return False
            seed['interactiveDiscovery']=True
    return True


def interactive_review(run_path):
    if not sys.stdin.isatty():
        raise ValueError('Interactive review requires a terminal; no data was applied')
    run_path = Path(run_path).resolve()
    raw = run_path.read_bytes()
    run = json.loads(raw)
    people = run.get('people', [])
    if any(person.get('kind','people') != 'people' for person in people):
        raise ValueError('Interactive application currently supports people only; other entity types remain discovery-only')
    if not any(person.get('candidates') for person in people):
        say('No retrieved accounts are available to review:')
        for person in people:
            say(person['name']+': '+person.get('reason',person.get('status','unknown')))
        if len(people)==1 and ask('[r]etry discovery with a website / [q]uit [q]: ',['','r','q'])=='r':
            website=ask('Website or archived snapshot URL: ')
            if website:
                command=[sys.executable,str(ROOT/'scripts/enrichment_pipeline.py'),'--entity','people/'+people[0]['id'],'--website',website,'--interactive','--refresh']
                subprocess.run(command,cwd=ROOT,check=False)
        return
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    review_path = ROOT/'reports'/f'account-review-{stamp}.json'
    plan_path = review_path.with_name(review_path.stem+'-plan.json')
    document = {'version':1,'generatedAt':stamp,'runSource':str(run_path),'runHash':digest(raw),'people':[]}
    say('\n1/4 Review retrieved links. Approve only after inspecting ownership evidence; default is hold.')
    say('Run evidence: '+str(run_path))
    try:
        for person in people:
            reviewed = {key:person.get(key,[]) for key in ('id','name','entityUrl','existingLinks','sources','offices')}
            reviewed['decisions'] = []
            document['people'].append(reviewed)
            if person.get('manualOverride'):
                say('Existing editorial override: '+json.dumps(person.get('editorialOverride'),indent=2))
                say('Approved new links can be appended to this override; existing links, clears, exclusions and other fields stay intact.')
                if ask('[a]ppend approved additions to this override / [s]kip this person [s]: ',['','a','s'])!='a':
                    continue
                reviewed['overrideAction']='append'
            from enrichment_pipeline import account
            known={c['url'] for link in person.get('existingLinks',[]) if (c:=account(link['url']))}
            for candidate in person.get('candidates',[]):
                if candidate['url'] in known:
                    reviewed['decisions'].append({'candidate':candidate,'decision':'already_recorded'})
                    say('Already recorded; keeping existing link: '+candidate['url'])
                    continue
                say('\n'+person['name']+' — '+candidate['url'])
                say('Primary source: '+candidate['sourceUrl'])
                say('Filing evidence: '+' '.join(person.get('sources',[])))
                say('Anchor: '+candidate.get('anchorText',''))
                say('Context: '+(candidate.get('identityEvidence') or {}).get('excerpt',''))
                say('Reason: '+candidate.get('reason',''))
                item = {'candidate':candidate,'decision':'hold'}
                reviewed['decisions'].append(item)
                choice = ask('[a]pprove / [r]eject / [h]old / [q]uit [h]: ', ['', 'a','r','h','q'])
                if choice == 'q':
                    write_review(review_path,document)
                    say('Saved partial review: '+str(review_path))
                    return
                item['decision'] = {'a':'approve','r':'reject'}.get(choice,'hold')
                if choice in ('a','r'):
                    item['ownershipEvidence'] = ask('Explain identity/ownership evidence (required): ')
                    if not item['ownershipEvidence']:
                        item['decision']='hold'
                if item['decision']=='approve':
                    say('2/4 Classify evidence: archived/historical endorsement is separate from current ownership.')
                    date = snapshot_date(candidate['sourceUrl'])
                    historical = bool(person.get('historical') or date or candidate.get('archivedAccountUrl'))
                    item['historical'] = historical or ask('Treat as historical evidence? [Y/n]: ',['','y','n']) != 'n'
                    if item['historical']:
                        item['snapshotDate'] = date
                        if not date:
                            value=ask('Known historical evidence date YYYY-MM-DD, or Enter if unknown: ')
                            if value:
                                item['snapshotDate']=datetime.strptime(value,'%Y-%m-%d').date().isoformat()
                        if ask('Type HISTORICAL to approve historical endorsement only: ') != 'HISTORICAL':
                            item['decision']='hold'
                    else:
                        if ask('Type OWNERSHIP to confirm the cited page identifies this person and endorses this exact account: ') != 'OWNERSHIP':
                            item['decision']='hold'
                write_review(review_path,document)
        write_review(review_path,document)
        approved=sum(d['decision']=='approve' for p in document['people'] for d in p['decisions'])
        if not approved:
            say('No approved links; saved review with zero production changes: '+str(review_path))
            return
        say('\n3/4 Preview approved changes. Existing links and editorial overrides are protected.')
        plan=helper('plan',review_path,plan_path)
        for change in plan['changes']:
            link=change['link']
            say('ADD '+link['platform']+' → '+link['url'],'success')
            say('  Destination: '+change['destination'])
            say('  Evidence: '+link['source'],'link')
            say('  Classification: '+link['disposition'],'warning' if link['disposition']=='historical' else 'success')
        say('Review: '+str(review_path.with_suffix('.html')))
        say('Exact plan: '+str(plan_path))
        token=plan['fingerprint']
        if ask('Type APPLY '+token[:12]+' to publish this exact plan, or Enter to stop: ') != 'APPLY '+token[:12]:
            say('Stopped before application; review and plan saved.')
            return
        say('\n4/4 Apply approved links, run link checks, and record audit.')
        applied=helper('apply',review_path,plan_path,token)
        say('Applied '+str(applied['accounts'])+' approved links. Checks: '+applied['validation'],'success')
        say('Application audit: '+applied['auditFile'],'link')
    except (EOFError,KeyboardInterrupt):
        write_review(review_path,document)
        say('\nReview saved; no additional application requested: '+str(review_path))
