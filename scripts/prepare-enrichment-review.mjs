import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transformWithEsbuild } from 'vite';
const input=process.argv[2]??'reports/people-enrichment-rerun.json';
const outputPrefix=process.argv[3]??'people-enrichment-review';
if(!/^[a-z0-9-]+$/.test(outputPrefix))throw Error('Invalid output prefix');
try {
 const prior=JSON.parse(await readFile(`reports/${outputPrefix}.json`,'utf8'));
 if(prior.productionChanges>0||prior.batches?.some(b=>b.status&&b.status!=='pending_user_approval'))throw Error('Refusing to overwrite a review set with applied batches; choose a new output prefix');
} catch(error) { if(error.code!=='ENOENT')throw error; }
const firstBatch=Number(process.argv[4]??1);
if(!Number.isInteger(firstBatch)||firstBatch<1)throw Error('Invalid batch start');
const runStem=input.split('/').at(-1).replace(/\.json$/,'');
const run=JSON.parse(await readFile(input,'utf8'));
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const link=(url,label)=>`<a href="${esc(url)}">${esc(label)}</a>`;
const hash=v=>createHash('sha256').update(v).digest('hex');
const action=(await transformWithEsbuild(await readFile('src/lib/anchored-popover.ts','utf8'),'anchored-popover.ts',{loader:'ts',format:'esm'})).code.replace('export {\n  anchoredPopover\n};','');
const shared=(await readFile('src/app.css','utf8')).split('\n').filter(l=>l.startsWith('.evidence-popover')).join('\n').replace('max-height:calc(100dvh - var(--space-6))','max-height:600px');
const css=`:root{--space-2:8px;--space-3:12px;--space-4:16px;--space-4-5:18px;--space-3-5:14px;--space-6:24px;--space-7:28px;--space-1:4px;--space-1-5:6px;--size-popover-max:480px;--border-width-emphasis:3px;--color-rule-soft:var(--border,#ccc);--color-ink:var(--foreground,#222);--color-paper:var(--popover,#fff);--color-muted:var(--muted-foreground,#666);--color-blue:var(--primary,#176ba0);--shadow-md:0 6px 24px #0003;--text-base:14px;--text-lg:18px;--font-serif:Georgia,serif}body{margin:3rem;font:15px/1.6 var(--font-sans,system-ui);color:var(--foreground,#222)}a{color:var(--primary,#176ba0);overflow-wrap:anywhere}article{border-bottom:1px solid var(--border,#ccc);padding:18px 0}li{margin:10px 0}button{font:inherit;cursor:pointer}code{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px;border-bottom:1px solid var(--border,#ccc)}.track{height:10px;background:var(--secondary,#ddd)}.track span{display:block;height:10px;background:var(--chart-1,#287bad)}${shared}`;
const page=(title,body)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body><h1>${esc(title)}</h1>${body}<script type="module">${action}\nfor(const node of document.querySelectorAll('.evidence-popover'))anchoredPopover(node,node.id);</script></body></html>`;
const people=run.people.map(person=>({...person,candidates:person.candidates.map(c=>({...c,reviewId:hash(JSON.stringify([person.id,c.url,c.sourceUrl,c.fetchedAt])).slice(0,12)}))}));
const ready=people.filter(p=>p.candidates.some(c=>c.primaryIdentityMatched));
const exceptions=people.flatMap(p=>p.candidates.filter(c=>!c.primaryIdentityMatched).map(c=>({personId:p.id,name:p.name,...c})));
const batches=[];await mkdir(`reports/${outputPrefix}`,{recursive:true});
for(let start=0;start<ready.length;start+=10){
 const id=`batch-${String(batches.length+firstBatch).padStart(2,'0')}`;
 const records=ready.slice(start,start+10).map(p=>({id:p.id,name:p.name,entityUrl:p.entityUrl,existingLinks:p.existingLinks,offices:p.offices,sources:p.sources,candidates:p.candidates.filter(c=>c.primaryIdentityMatched)}));
 const batch={id,status:'pending_user_approval',generatedAt:run.generatedAt,runSource:input,people:records};
 const contentHash=hash(JSON.stringify(batch));batch.contentHash=contentHash;
 batches.push({id,contentHash,people:records.length,accounts:records.reduce((n,p)=>n+p.candidates.length,0)});
 await writeFile(`reports/${outputPrefix}/${id}.json`,JSON.stringify(batch,null,2)+'\n');
 let body=`<p>${records.length} people. Status: pending your approval. Automated name and office-context checks passed; account ownership still requires review. Approving this batch means approving exactly the account URLs below for these people.</p><p>${link('../'+runStem+'.json','Run evidence')} · ${link(id+'.json','Exact batch manifest')} · ${link('../'+outputPrefix+'.html','All batches')}</p><p>Batch fingerprint: <code>${contentHash}</code></p>`;
 for(const p of records){body+=`<article><h2>${link(p.entityUrl,p.name)}</h2><p>${esc(p.offices.join(' · '))}</p><ul>`;for(const c of p.candidates){
 const pop='evidence-'+c.reviewId;
 body+=`<li>${link(c.url,c.platform+': '+c.url)} — ${link(c.sourceUrl,'source')} <button popovertarget="${pop}">Evidence</button><div id="${pop}" popover class="evidence-popover"><header><strong>${esc(p.name)}</strong><button popovertarget="${pop}" popovertargetaction="hide" aria-label="Close evidence">×</button></header><p>Review ID: ${c.reviewId}. Retrieved ${esc(c.fetchedAt)}. Publication date unknown.</p><p>Anchor: ${esc(c.anchorText||'(unlabeled)')}</p><p>Page excerpt: ${esc(c.identityEvidence.excerpt)}</p><p>${link(c.sourceUrl,'Primary page')} · ${p.sources.map(s=>link(s,'Filing evidence')).join(' · ')}</p></div></li>`;
 }body+='</ul></article>';}
 await writeFile(`reports/${outputPrefix}/${id}.html`,page(`People enrichment ${id}`,body));
}
const manifest={generatedAt:run.generatedAt,status:'pending_user_approval',summary:run.summary,batches,exceptions,unresolvedPeople:people.filter(p=>!p.candidates.length).map(p=>({id:p.id,name:p.name,status:p.status,fetches:p.fetches})),productionChanges:0,discoverySource:run.discoverySource,discoverySummary:run.discoverySummary};
await writeFile(`reports/${outputPrefix}.json`,JSON.stringify(manifest,null,2)+'\n');
let body=`<p>${run.summary.people}-person discovery cohort. ${esc(run.selection)} No published records changed. Approve by batch ID; each batch has a fixed fingerprint and explicit account URLs. Weak identity matches are held outside approval batches.</p><p>${link(runStem+'.html','Full rerun report')} · ${link(outputPrefix+'.json','Review manifest')}</p>`;
if(run.discoverySummary)body+=`<p>Original live discovery: ${run.discoverySummary.requests} requests and ${run.discoverySummary.cacheHits} cache hits; subsequent screening used cached evidence only. ${link(run.discoverySource.split('/').at(-1),'Live discovery evidence')}</p>`;
for(const [status,n] of Object.entries(run.summary.statuses).filter(([,n])=>n))body+=`<p>${esc(status)}: ${n}</p><div class="track"><span style="width:${100*n/run.summary.people}%"></span></div>`;
body+=`<h2>Approval batches</h2><p>${ready.length} people with ${batches.reduce((n,b)=>n+b.accounts,0)} proposals passed automated primary-page identity checks. ${exceptions.length} proposals failed those checks and remain investigation-only; none are silently discarded.</p><table><thead><tr><th>Batch</th><th>People</th><th>Accounts</th><th>Disposition</th></tr></thead><tbody>${batches.map(b=>`<tr><td>${link(outputPrefix+'/'+b.id+'.html',b.id)}</td><td>${b.people}</td><td>${b.accounts}</td><td>Pending approval</td></tr>`).join('')}</tbody></table><h2>Investigation-only proposals</h2><ul>${exceptions.map(c=>`<li>${link('https://www.electionsutah.org/people/'+c.personId+'/',c.name)}: ${link(c.url,c.platform)} — ${link(c.sourceUrl,'source')}; ${esc(c.reason)}</li>`).join('')}</ul>`;
await writeFile(`reports/${outputPrefix}.html`,page('People enrichment review batches',body));
console.log(JSON.stringify({batches,investigationProposals:exceptions.length,productionChanges:0}));
