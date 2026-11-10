#!/usr/bin/env python3
"""Triage immutable exception evidence using local records only; never apply changes."""
import json,re,hashlib,html
from pathlib import Path
from collections import Counter,defaultdict
from urllib.parse import urlsplit
from enrichment_pipeline import ROOT,account,party_accounts

INPUT=ROOT/'reports/people-enrichment-next-200-review.json'
RUN=ROOT/'reports/people-enrichment-next-200-screened.json'
OUT=ROOT/'reports/people-enrichment-exceptions'
LABELS={
 'organization':'Exclude from person accounts: organizations',
 'post_or_topic':'Exclude from person accounts: posts and topics',
 'unrelated_site':'Exclude: unrelated or repurposed website',
 'duplicate':'Duplicate account proposal',
 'identity_conflict':'Hold: account already attached to another person record',
 'current_person_review':'Review: people with 2026 filings',
 'historical_person_review':'Review: earlier filing years',
 'unresolved':'Hold: identity evidence is insufficient'
}

def main():
 source=json.loads(INPUT.read_text());run=json.loads(RUN.read_text());people={p['id']:p for p in run['people']}
 published=json.loads((ROOT/'src/data/person-link-enrichment.json').read_text());owners=defaultdict(set)
 for pid,entry in published.items():
  for link in entry.get('links',[]):
   c=account(link['url'])
   if c:owners[c['url'].lower()].add(pid)
 seen=set();rows=[]
 for c in source['exceptions']:
  p=people[c['personId']];url=c['url'].strip();anchor=c['anchorText'];u=urlsplit(url);key=(p['id'],url.lower());reason=''
  institutional=any(x in url.lower() for x in ['linkedin.com/company/utah-senate','facebook.com/utahsenate','x.com/utahsenate','instagram.com/utahsenate','ucdij78nlhsdqn44sq9nf0uA'.lower(),'facebook.com/utahpubliceducation','youtube.com/@usbe-media','x.com/utboardofed'])
  if url.lower() in party_accounts() or institutional:
   category='organization';reason='Party, legislative chamber or state education board account; not the named person.'
  elif re.search(r'facebook\.com/\d+_\d+',url) or anchor.strip().startswith('#') or 'comment on facebook' in anchor.lower():
   category='post_or_topic';reason='Individual post, topic or comment endpoint, rather than a person account.'
  elif 'slot' in url.lower() or p['id'] in ['sharon-hilton','tenna-hartman'] or url in ['https://facebook.com/113431180365167']:
   category='unrelated_site';reason='Cached evidence points to gambling content, an unrelated organization, or another business, rather than the person.'
  elif key in seen:
   category='duplicate';reason='Same person and account already present in this exception set (case-insensitive handle match).'
  elif owners.get(url.lower(),set())-{p['id']}:
   category='identity_conflict';reason='Already attached to other person record(s): '+', '.join(sorted(owners[url.lower()]-{p['id']}))+'. Resolve identity before adding.'
  elif c['identityEvidence']['nameMatched']:
   category='historical_person_review' if p.get('historical') else 'current_person_review'
   reason='Primary page contains the person’s name. '+('Earlier filing-year record; verify continuity and current-versus-archival context.' if p.get('historical') else 'Review source context, redirects and account ownership.')
   if c['platform']=='youtube' and 'tiktok' in anchor.lower():reason+=' Anchor is mislabeled TikTok; destination is YouTube.'
  else:category='unresolved';reason='Cached page does not establish identity.'
  seen.add(key)
  rows.append({**c,'triageId':hashlib.sha256(json.dumps([p['id'],c['url'],c['sourceUrl'],c['fetchedAt']]).encode()).hexdigest()[:12],'category':category,'triageReason':reason,'latestFilingYear':p.get('latestYear'),'historical':p.get('historical'),'entityUrl':p['entityUrl'],'offices':p['offices'],'status':'pending_review'})
 assert len(rows)==205
 counts=Counter(r['category'] for r in rows)
 OUT.mkdir(exist_ok=True)
 # Reuse the actual shared evidence-popover CSS and transpiled anchoredPopover action from the reviewed report.
 template=(ROOT/'reports/people-enrichment-review/batch-01.html').read_text()
 css=re.search(r'<style>(.*?)</style>',template,re.S)[1]
 script=re.search(r'<script type="module">(.*?)</script>',template,re.S)[1]
 esc=lambda x:html.escape(str(x),quote=True)
 link=lambda u,t:f'<a href="{esc(u)}">{esc(t)}</a>'
 def page(title,body):return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>'+css+'</style></head><body><h1>'+esc(title)+'</h1>'+body+'<script type="module">'+script+'</script></body></html>'
 def cards(group):
  body=''
  for r in group:
   pop='ev-'+r['triageId']
   body+=f'<article><h2>{link(r["entityUrl"],r["name"])}</h2><p>Latest filing year: {r["latestFilingYear"]}. {esc(" / ".join(r["offices"]))}</p><p>{link(r["url"],r["platform"]+": "+r["url"])} — {link(r["sourceUrl"],"source")}</p><p>{esc(r["triageReason"])}</p><button popovertarget="{pop}">Evidence</button><div id="{pop}" popover class="evidence-popover"><header><strong>{esc(r["name"])}</strong><button popovertarget="{pop}" popovertargetaction="hide" aria-label="Close evidence">×</button></header><p>Anchor: {esc(r["anchorText"] or "unlabeled")}</p><p>{esc(r["identityEvidence"]["excerpt"])}</p><p>Retrieved {esc(r["fetchedAt"])}; publication date unknown. {link(r["sourceUrl"],"Primary page")}</p></div></article>'
  return body
 groups=[]
 for category in LABELS:
  items=[r for r in rows if r['category']==category]
  if not items:continue
  filename=category+'.html'
  (OUT/filename).write_text(page(LABELS[category],'<p>Cached-evidence triage; no proposals in this report have been applied. Recommendations remain pending review.</p><p>'+link('../people-enrichment-exceptions.html','All exception groups')+' · '+link('ledger.json','Full evidence ledger')+'</p>'+cards(items)))
  groups.append({'category':category,'label':LABELS[category],'proposals':len(items),'people':len({r['personId'] for r in items}),'file':filename})
 batches=[];number=1
 for category in ['current_person_review','historical_person_review']:
  items=[r for r in rows if r['category']==category];ids=list(dict.fromkeys(r['personId'] for r in items))
  for start in range(0,len(ids),10):
   selected=[r for r in items if r['personId'] in ids[start:start+10]];bid=f'exception-batch-{number:02}';number+=1
   manifest={'id':bid,'status':'pending_user_approval','category':category,'proposalCount':len(selected),'peopleCount':len(ids[start:start+10]),'proposals':selected}
   manifest['contentHash']=hashlib.sha256(json.dumps(manifest,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
   (OUT/(bid+'.json')).write_text(json.dumps(manifest,indent=2)+'\n')
   (OUT/(bid+'.html')).write_text(page(bid+' — '+LABELS[category],'<p>Pending your review. Approval applies only to the account proposals listed here. No changes applied.</p><p>'+link(bid+'.json','Exact manifest')+' · '+link('../people-enrichment-exceptions.html','All groups')+'</p>'+cards(selected)))
   batches.append({'id':bid,'category':category,'people':manifest['peopleCount'],'proposals':len(selected),'file':bid+'.html','contentHash':manifest['contentHash']})
 result={'source':str(INPUT.relative_to(ROOT)),'networkRequests':0,'productionChanges':0,'total':len(rows),'counts':dict(counts),'groups':groups,'reviewBatches':batches,'proposals':rows}
 (OUT/'ledger.json').write_text(json.dumps(result,indent=2)+'\n')
 body='<p>All 205 investigation-only proposals have been triaged using cached primary pages and existing entity data. No new network requests or exception-account additions. Batches 5–6 were separately approved and applied.</p><p>'+link('people-enrichment-exceptions/ledger.json','Complete triage evidence')+'</p>'
 for g in groups:body+=f'<p>{link("people-enrichment-exceptions/"+g["file"],g["label"])}: {g["proposals"]} proposals, {g["people"]} people</p><div class="track"><span style="width:{100*g["proposals"]/205}%"></span></div>'
 body+='<h2>Person-account review batches</h2><ul>'+''.join(f'<li>{link("people-enrichment-exceptions/"+b["file"],b["id"])} — {b["people"]} people, {b["proposals"]} accounts; {esc(LABELS[b["category"]])}</li>' for b in batches)+'</ul><p>Organizational accounts are not missing person accounts. Earlier filing year does not imply that an account is inactive or that the person no longer holds office. Existing duplicate person records are held for identity resolution; this workflow does not merge people.</p>'
 (ROOT/'reports/people-enrichment-exceptions.html').write_text(page('Review of 205 enrichment exceptions',body))
 print(json.dumps({'total':len(rows),'counts':dict(counts),'batches':batches,'productionChanges':0}))
if __name__=='__main__':main()
