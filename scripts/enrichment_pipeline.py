#!/usr/bin/env python3
"""Bounded primary-site account discovery. Writes proposals, never edits entity data.

python3 scripts/enrichment_pipeline.py --entity people/ENTITY_ID
python3 scripts/enrichment_pipeline.py --seeds .firecrawl/enrichment/people-seeds.json
Raw HTML/cache stay in ignored .firecrawl/enrichment. --offline replays cache only.
--refresh uses conditional requests. --backend firecrawl uses FIRECRAWL_API_KEY;
--backend direct is the explicit credit-free fallback (default).
"""
import argparse
import concurrent.futures
import hashlib
import gzip
import io
from functools import lru_cache
import html
from html.parser import HTMLParser
import ipaddress
import json
from pathlib import Path
import re
import shlex
import subprocess
import threading
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode

ROOT = Path(__file__).resolve().parents[1]
STATES = {'not_attempted','no_account_found','not_applicable','blocked','retrieval_failed','ambiguous','verified','historical'}
PLATFORMS = {'facebook.com':'facebook','fb.com':'facebook','instagram.com':'instagram','twitter.com':'x','x.com':'x','linkedin.com':'linkedin','youtube.com':'youtube','bsky.app':'bluesky','threads.net':'threads','threads.com':'threads','tiktok.com':'tiktok','truthsocial.com':'truthsocial','rumble.com':'rumble','substack.com':'substack'}
DENIED = {'share','sharer','sharer.php','intent','login','signin','accounts','watch','watch.php','reel','reels','stories','posts','status','statuses','shorts','live','embed','events','groups','search','explore','hashtag','hashtags','dialog','plugins','feed','photo','photo.php','photos','videos','video','p','tv','permalink.php','story.php','home','messages','oauth','i','redirect'}
LOCK = threading.Lock()

def now(): return datetime.now(timezone.utc)
def stamp(): return now().isoformat()
def canonical(value, base=None):
    try:
        u=urlsplit(urljoin(base,value) if base else value)
        if u.scheme not in ('http','https') or not u.hostname or u.username or u.password: return None
        host=u.hostname.lower().removeprefix('www.')
        if host=='localhost' or '.' not in host: return None
        try:
            if not ipaddress.ip_address(host).is_global: return None
        except ValueError: pass
        host={'twitter.com':'x.com','fb.com':'facebook.com','threads.net':'threads.com'}.get(host,host)
        # Wayback paths embed the original URL; keep its http(s):// separator intact.
        path=re.sub(r'(?<!:)/{2,}','/',u.path).rstrip('/') or '/'
        query=urlencode([(k,v) for k,v in parse_qsl(u.query) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid','gclid','hl','ref','ref_src')])
        # Preserve transport for fetch keys; account normalization explicitly uses HTTPS.
        return urlunsplit((u.scheme,host+(f':{u.port}' if u.port else ''),path,query,''))
    except (ValueError,TypeError): return None

def account(value, base=None):
    url=canonical(value,base)
    if not url: return None
    u=urlsplit(url); host=u.hostname; platform=next((v for h,v in PLATFORMS.items() if host==h or host.endswith('.'+h)),None)
    if not platform: return None
    parts=[p for p in u.path.split('/') if p]
    if not parts or any(p.lower() in DENIED for p in parts): return None
    if platform=='facebook' and re.fullmatch(r'\d+_\d+',parts[0]): return None
    query=dict(parse_qsl(u.query))
    if platform=='facebook' and parts[0]=='profile.php':
        if not query.get('id','').isdigit(): return None
        path='/profile.php'; q=urlencode({'id':query['id']})
    else:
        if platform=='linkedin' and (len(parts)!=2 or parts[0] not in ('in','company')): return None
        if platform=='youtube' and not (len(parts)==1 and parts[0].startswith('@') or len(parts)==2 and parts[0] in ('channel','user','c')): return None
        if platform=='bluesky' and (len(parts)!=2 or parts[0]!='profile'): return None
        if platform not in ('linkedin','youtube','bluesky','rumble') and len(parts)!=1: return None
        if platform=='rumble' and not (len(parts)==2 and parts[0] in ('c','user')): return None
        path='/'+('/'.join(parts)); q=''
    return {'platform':platform,'url':urlunsplit(('https',host.removeprefix('m.').removeprefix('mobile.'),path,q,''))}

@lru_cache(maxsize=1)
def party_accounts():
    data=json.loads((ROOT/'src/data/party-enrichment.json').read_text())
    return {candidate['url'].lower() for entry in data.values() for link in entry.get('links',[]) if (candidate:=account(link['url']))}

class Page(HTMLParser):
    def __init__(self,text):
        super().__init__();self.links=[];self.text=[];self.jsonld=[];self.current=None;self.script=None;self.hidden=0
        self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('script','style'): self.hidden+=1
        if tag=='script' and a.get('type','').lower()=='application/ld+json': self.script=''
        if tag=='a' and a.get('href'): self.current=[a['href'],a.get('aria-label','')+' '+a.get('title','')]
    def handle_data(self,text):
        if self.script is not None: self.script+=text
        if not self.hidden: self.text.append(text)
        if self.current: self.current[1]+=' '+text
    def handle_endtag(self,tag):
        if tag=='a' and self.current: self.links.append(tuple(self.current));self.current=None
        if tag=='script' and self.script is not None:
            try: self.jsonld.append(json.loads(self.script))
            except ValueError: pass
            self.script=None
        if tag in ('script','style'): self.hidden=max(0,self.hidden-1)
    def candidates(self):
        found=list(self.links)
        def walk(obj):
            if isinstance(obj,dict):
                same=obj.get('sameAs',[])
                if isinstance(same,str): same=[same]
                if isinstance(same,list): found.extend((v,'JSON-LD sameAs '+str(obj.get('name',''))) for v in same if isinstance(v,str))
                for v in obj.values(): walk(v)
            elif isinstance(obj,list):
                for v in obj: walk(v)
        walk(self.jsonld);return found

def tokens(s): return set(re.findall(r'[a-z0-9]+',s.lower()))
def identity(seed,page):
    text=' '.join(page.text); words=tokens(text); name=[w for w in re.findall(r'[a-z]+',seed['name'].lower()) if len(w)>1]
    name_ok=bool(name) and name[0] in words and name[-1] in words
    contexts=[sorted((tokens(o)-{'district','state','of','the','u','s'}) & words) for o in seed.get('offices',[])]
    context_ok=any(c for c in contexts)
    return {'nameMatched':name_ok,'officeContextMatched':context_ok,'matchedOfficeTerms':contexts,'excerpt':re.sub(r'\s+',' ',text)[:350]}

class Fetcher:
    def __init__(self,cache,offline=False,refresh=False,backend='direct'):
        self.cache=cache;cache.mkdir(parents=True,exist_ok=True);self.offline=offline;self.refresh=refresh;self.backend=backend;self.stats={'requests':0,'cacheHits':0,'conditional304':0};self.locks={}
    def fetch(self,value):
        url=canonical(value)
        if not url: return {'status':'not_applicable','url':value,'error':'Invalid or non-public URL'}
        key=hashlib.sha256(url.encode()).hexdigest()
        with LOCK: lock=self.locks.setdefault(key,threading.Lock())
        with lock: return self._fetch(url,key)
    def _fetch(self,url,key):
        meta=self.cache/(key+'.json'); prior=json.loads(meta.read_text()) if meta.exists() else None
        if prior and not self.refresh and (self.offline or prior['nextReviewAt']>stamp()):
            with LOCK:self.stats['cacheHits']+=1
            return dict(prior,cacheHit=True)
        if self.offline: return {'url':url,'status':'not_attempted','error':'No reusable cache entry'}
        fetched=stamp(); result={'url':url,'fetchedAt':fetched,'status':'retrieval_failed','backend':self.backend}
        with LOCK:self.stats['requests']+=1
        try:
            if self.backend=='firecrawl':
                # CLI consumes the configured API key; never pass or print it.
                target=self.cache/(key+'.firecrawl.json')
                proc=subprocess.run(['firecrawl','scrape',url,'--format','html','--json','-o',str(target)],capture_output=True,text=True,timeout=35)
                if proc.returncode: raise RuntimeError('Firecrawl request failed; no authentication fallback attempted')
                payload=json.loads(target.read_text()); payload=payload.get('data',payload); text=payload.get('html','')
                effective=url; code=200; headers={}
            else:
                head=self.cache/(key+'.headers'); body=self.cache/(key+'.body')
                command=['curl','--silent','--show-error','--compressed','--location','--max-redirs','4','--proto','=https,http','--proto-redir','=https,http','--max-time','18','--max-filesize','3000000','-A','ElectionsUtah/1.0 public account discovery','-D',str(head),'-o',str(body),'-w','%{http_code}\n%{url_effective}',url]
                if prior:
                    for field,header in [('etag','If-None-Match'),('lastModified','If-Modified-Since')]:
                        if prior.get(field): command[1:1]=['-H',f'{header}: {prior[field]}']
                proc=subprocess.run(command,capture_output=True,text=True,timeout=22)
                if proc.returncode: raise RuntimeError('Transport failure or request/size budget exceeded')
                code,effective=proc.stdout.strip().split('\n',1);code=int(code)
                headers={k.lower():v.strip() for k,v in re.findall(r'^([^:\r\n]+):([^\r\n]+)',head.read_text(errors='replace'),re.M)}
                if code==304 and prior:
                    with LOCK:self.stats['conditional304']+=1
                    result=dict(prior,lastCheckedAt=fetched,nextReviewAt=(now()+timedelta(days=30)).isoformat());meta.write_text(json.dumps(result,indent=2));return result
                raw=body.read_bytes() if body.exists() else b''
                if raw.startswith(b'\x1f\x8b'):
                    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as compressed: raw=compressed.read(3000001)
                if len(raw)>3000000: raise RuntimeError('Decoded response exceeds size budget')
                text=raw.decode('utf-8',errors='replace')
            result.update(httpStatus=code,finalUrl=effective,etag=headers.get('etag'),lastModified=headers.get('last-modified'))
            if code in (401,403,429): result['status']='blocked'
            elif code!=200: result['status']='retrieval_failed'
            elif '<html' not in text.lower() and '<a ' not in text.lower(): result['error']='Not an HTML document'
            elif re.search(r'just a moment|verify you are human|checking your browser|captcha',text[:15000],re.I): result['status']='blocked'
            else:
                digest=hashlib.sha256(text.encode()).hexdigest(); dest=self.cache/(digest+'.html')
                if not dest.exists(): dest.write_text(text)
                result.update(status='verified',contentHash=digest,bodyFile=str(dest.relative_to(ROOT)),lastSuccessfulFetchAt=fetched,evidenceDate=None)
        except (RuntimeError,subprocess.TimeoutExpired,ValueError,OSError) as error: result['error']=str(error)
        if prior and result['status']!='verified':
            result['previousSuccess']=prior.get('previousSuccess') or {k:prior[k] for k in ('bodyFile','contentHash','lastSuccessfulFetchAt') if k in prior}
        result['nextReviewAt']=(now()+timedelta(days=30 if result['status']=='verified' else 7)).isoformat()
        meta.write_text(json.dumps(result,indent=2));return result

def discover(seed,fetcher,max_pages=2):
    record={**seed,'status':'not_attempted','candidates':[],'fetches':[],'manualReviewRequired':True}
    if seed.get('manualOverride'): return dict(record,status='ambiguous',reason='Editorial override present; preserve it and review manually')
    urls=seed.get('websites',[])[:1]
    if not urls:return dict(record,status='not_applicable',reason='No primary website seed')
    seen=set(); candidates={}; evidence=None
    while urls and len(record['fetches'])<max_pages:
        url=urls.pop(0); key=canonical(url)
        if not key or key in seen:continue
        seen.add(key); result=fetcher.fetch(url);record['fetches'].append({k:v for k,v in result.items() if k!='previousSuccess'})
        if result['status']!='verified':continue
        page=Page((ROOT/result['bodyFile']).read_text()); evidence=identity(seed,page)
        final=result.get('finalUrl',url); origin=urlsplit(url).hostname.removeprefix('www.'); dest=urlsplit(final).hostname.removeprefix('www.')
        redirected=origin!=dest
        for href,anchor in page.candidates():
            candidate=account(href,final)
            if not candidate:continue
            # Generic institutional seeds and cross-domain redirects never establish person ownership.
            institutional=bool(re.search(r'\.gov$|utgop\.org$|organizeutah\.org$|utahdemocrats\.org$|utahforwardparty\.org$',dest))
            label_platform=next((platform for label,platform in [('threads','threads'),('tiktok','tiktok'),('youtube','youtube'),('instagram','instagram'),('facebook','facebook'),('linkedin','linkedin'),('twitter','x')] if label in anchor.lower()),None)
            safe=seed.get('kind','people')=='people' and evidence['nameMatched'] and evidence['officeContextMatched'] and not institutional and not redirected and not seed.get('historical',False) and not anchor.strip().startswith('#') and (label_platform is None or label_platform==candidate['platform']) and candidate['url'].lower() not in party_accounts()
            candidates[candidate['url']]={**candidate,'entityId':seed['id'],'sourceUrl':final,'anchorText':re.sub(r'\s+',' ',anchor).strip()[:160],'identityEvidence':evidence,'fetchedAt':result['fetchedAt'],'evidenceDate':None,'disposition':'ambiguous','reason':'Primary-site candidate; ownership needs review' if safe else 'Entity ownership, historical identity, page context, institutional ownership, redirect or account label needs review','primaryIdentityMatched':safe}
        if not candidates:
            for href,anchor in page.links:
                target=urljoin(final,href); u=urlsplit(target)
                if u.hostname==urlsplit(final).hostname and re.search(r'contact|about|social',href+' '+anchor,re.I) and canonical(target) not in seen:
                    urls.append(target);break
    record['candidates']=list(candidates.values());record['identityEvidence']=evidence
    if candidates:record['status']='ambiguous'
    elif any(f['status']=='verified' for f in record['fetches']): record['status']='no_account_found'
    elif any(f['status']=='blocked' for f in record['fetches']):record['status']='blocked'
    elif record['fetches']:record['status']=record['fetches'][-1]['status']
    return record

def report(result,path):
    esc=lambda x:html.escape(str(x),quote=True)
    link=lambda url,label:f'<a href="{esc(url)}">{esc(label)}</a>'
    rows=[]
    for r in result['people']:
        evidence=' '.join(link(f.get('finalUrl',f['url']),f.get('httpStatus',f['status'])) for f in r['fetches'])
        accounts='<br>'.join(link(c['url'],c['platform'])+' — '+link(c['sourceUrl'],'source')+' · '+esc(c['reason']) for c in r['candidates'])
        rows.append(f'<tr><td>{link(r["entityUrl"],r["name"])}</td><td>{esc(r["status"])}</td><td>{accounts or "—"}</td><td>{evidence}</td></tr>')
    bars=''.join(f'<div class="bar"><span>{esc(k)}: {v}</span><div style="width:{100*v/max(1,len(result["people"]))}%"></div></div>' for k,v in result['summary']['statuses'].items() if v)
    out='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entity enrichment trial</title><style>body{margin:3rem;font:15px/1.6 var(--font-sans,system-ui);color:var(--foreground,#222)}a{color:var(--primary,#176ba0)}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:10px;text-align:left;border-bottom:1px solid var(--border,#ccc);vertical-align:top}.scroll{overflow:auto}.bar{margin:12px 0}.bar div{height:10px;min-width:2px;background:var(--chart-1,#287bad)}code{overflow-wrap:anywhere}</style></head><body><h1>Entity enrichment trial</h1><p>'+esc(result['selection'])+'</p><p>'+esc(f"{len(result['people'])} entities · {result['summary']['accountProposals']} account proposals · {result['summary']['requests']} network requests · {result['summary']['cacheHits']} cache hits · {result['summary']['modelCalls']} model calls")+'</p><p>Account URLs are review proposals; no production data was changed. A successful fetch is not verified entity ownership. No account activity checks. Search, directories and Wikidata discovery are deferred; this bounded trial exercises primary-site extraction and cache controls.</p><p>Reproduce: <code>'+esc(result.get('reproduce','See pipeline --help for seed-file options.'))+'</code>. Add <code>--offline</code> for cache replay or <code>--refresh</code> for conditional revalidation.</p><p>Source: '+link(path.with_suffix('.json').name,'machine-readable trial evidence')+'</p>'+bars+'<div class="scroll"><table><thead><tr><th>Entity</th><th>Outcome</th><th>Account proposals and sources</th><th>Fetch evidence</th></tr></thead><tbody>'+''.join(rows)+'</tbody></table></div></body></html>'
    path.write_text(out)

def load_entity(selector):
    if not re.fullmatch(r'(people|parties|places|offices)/[a-z0-9-]+(?:/[a-z0-9-]+)*',selector):
        raise ValueError('Use --entity KIND/ID, where KIND is people, parties, places, or offices')
    result=subprocess.run(['node',str(ROOT/'scripts/prepare-entity-enrichment.mjs'),selector],cwd=ROOT,capture_output=True,text=True,timeout=120)
    if result.returncode: raise ValueError(result.stderr.strip() or 'Entity resolution failed')
    return json.loads(result.stdout)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    source=parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--seeds',help='Prepared cohort JSON file')
    source.add_argument('--entity',metavar='KIND/ID',help='Existing people, parties, places, or offices entity; requires installed Node dependencies')
    parser.add_argument('--offline',action='store_true')
    parser.add_argument('--refresh',action='store_true')
    parser.add_argument('--backend',choices=['direct','firecrawl'],default='direct')
    parser.add_argument('--workers',type=int,default=6)
    parser.add_argument('--max-pages',type=int,default=2)
    parser.add_argument('--output',help='JSON output path; a companion HTML report is also written')
    args=parser.parse_args()
    if not 1<=args.workers<=8 or not 1<=args.max_pages<=3:parser.error('workers must be 1–8 and max-pages 1–3')
    try:
        seeds=load_entity(args.entity) if args.entity else json.loads(Path(args.seeds).read_text())
    except (ValueError,OSError,subprocess.TimeoutExpired) as error:
        parser.error(str(error))
    if not args.output:
        args.output=f'reports/{args.entity.replace("/","-")}-enrichment.json' if args.entity else 'reports/people-enrichment-trial.json'
    fetcher=Fetcher(ROOT/'.firecrawl/enrichment/cache',args.offline,args.refresh,args.backend)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool: people=list(pool.map(lambda seed:discover(seed,fetcher,args.max_pages),seeds['seeds']))
    statuses={s:sum(p['status']==s for p in people) for s in sorted(STATES)}
    result={'generatedAt':stamp(),'selection':seeds['selection'],'summary':{'people':len(people),'statuses':statuses,'accountProposals':sum(len(p['candidates']) for p in people),'productionChanges':0,**fetcher.stats,'backend':args.backend,'modelCalls':0},'people':people}
    command=['python3','scripts/enrichment_pipeline.py','--entity' if args.entity else '--seeds',args.entity or args.seeds,'--backend',args.backend,'--max-pages',str(args.max_pages),'--workers',str(args.workers),'--output',args.output]
    command += (['--offline'] if args.offline else []) + (['--refresh'] if args.refresh else [])
    result['reproduce']=shlex.join(command)
    output=ROOT/args.output;output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,indent=2)+'\n');report(result,output.with_suffix('.html'));print(json.dumps(result['summary']))
if __name__=='__main__':main()
