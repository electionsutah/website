// Run only after explicit user approval of the supplied immutable batch manifests.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const paths=process.argv.slice(2);
if(!paths.length)throw Error('Supply explicitly approved batch JSON paths');
const date=new Date().toISOString().slice(0,10);
const dataPath='src/data/person-link-enrichment.json';const data=JSON.parse(await readFile(dataPath,'utf8'));
const labels={x:'X (Twitter)',linkedin:'LinkedIn',youtube:'YouTube',tiktok:'TikTok',facebook:'Facebook',instagram:'Instagram',threads:'Threads',substack:'Substack'};
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const audits=[];
try {
 const {peopleById}=await server.ssrLoadModule('/src/lib/entities.ts');
 const {resolveEntityLinks}=await server.ssrLoadModule('/src/lib/entity-links.ts');
 const {editorialData}=await server.ssrLoadModule('/src/lib/editorial.ts');
 for(const path of paths){
  const batch=JSON.parse(await readFile(path,'utf8'));const {contentHash,...payload}=batch;
  if(createHash('sha256').update(JSON.stringify(payload)).digest('hex')!==contentHash)throw Error('Manifest fingerprint mismatch');
  const auditPath=path.replace(/\.json$/,'-application.json');
  try {await readFile(auditPath);throw Error('Batch already applied');}catch(e){if(e.code!=='ENOENT')throw e;}
  const audit={batchId:batch.id,contentHash,approvedOn:date,approval:'Explicit user approval in conversation',applied:[],excluded:[]};
  for(const p of batch.people){
   if(editorialData.people[p.id])throw Error(`Editorial override requires separate review: ${p.id}`);
   const current=peopleById.get(p.id);if(!current)throw Error('Unknown person');
   const urls=links=>resolveEntityLinks(links).map(l=>l.url).sort();
   if(JSON.stringify(urls(current.links??[]))!==JSON.stringify(urls(p.existingLinks)))throw Error(`Links changed: ${p.id}`);
   const entry=data[p.id]??{verifiedOn:date,identityEvidence:[],sources:[],notes:[],links:p.existingLinks.map(l=>({...l,url:resolveEntityLinks([l])[0].url,source:l.source??p.candidates[0].sourceUrl,verifiedOn:date}))};
   for(const l of entry.links)if(l.source&&!entry.sources.includes(l.source))entry.sources.push(l.source);
   for(const c of p.candidates){
    if(!c.primaryIdentityMatched||c.entityId!==p.id)throw Error('Unapproved identity exception');
    const url=new URL(c.url.trim()).href;
    if(/facebook\.com\/(?:\d+_\d+|photo\.php)|\/status\/|\/posts\/|\/intent\//.test(url))throw Error(`Not an account: ${url}`);
    if(entry.links.some(l=>new URL(l.url.includes('://')?l.url:'https://'+l.url).href===url))throw Error('Duplicate account');
    entry.links.push({url,platform:c.platform,label:labels[c.platform]??c.platform,source:c.sourceUrl,verifiedOn:date,evidenceFetchedAt:c.fetchedAt,reviewId:c.reviewId});
    if(!entry.sources.includes(c.sourceUrl))entry.sources.push(c.sourceUrl);
    const evidence={publishedName:p.name,match:`Campaign page identifies ${p.name} and ${p.offices.join(' / ')} and publishes the approved social account link.`,source:c.sourceUrl};
    if(!entry.identityEvidence.some(e=>e.source===evidence.source&&e.match===evidence.match))entry.identityEvidence.push(evidence);
    audit.applied.push({personId:p.id,url,source:c.sourceUrl,reviewId:c.reviewId});
   }
   entry.verifiedOn=date;for(const l of entry.links)l.verifiedOn=date;
   entry.notes.push(`Social accounts approved in ${batch.id} (${contentHash.slice(0,12)}) on ${date}. Primary-page endorsement checked; current posting activity not checked. Existing links retained.`);
   data[p.id]=entry;
  }
  audits.push({path,auditPath,audit,batch});
 }
} finally {await server.close();}
// Complete preflight for all supplied manifests before touching production data.
await writeFile(dataPath+'.tmp',JSON.stringify(data,null,2)+'\n');await rename(dataPath+'.tmp',dataPath);
for(const {path,auditPath,audit,batch} of audits){
 await writeFile(auditPath,JSON.stringify(audit,null,2)+'\n');
 const indexPath=dirname(path)+'.json',index=JSON.parse(await readFile(indexPath,'utf8'));
 Object.assign(index.batches.find(b=>b.id===batch.id),{status:'applied',appliedAccounts:audit.applied.length,excludedAccounts:0,applicationReport:auditPath.replace(/^reports\//,'')});
 index.productionChanges=index.batches.reduce((n,b)=>n+(b.appliedAccounts??0),0);await writeFile(indexPath,JSON.stringify(index,null,2)+'\n');
 const detail=path.replace(/\.json$/,'.html');let text=await readFile(detail,'utf8');
 text=text.replace('</h1>',`</h1><p><strong>Applied:</strong> ${audit.applied.length} approved accounts across ${batch.people.length} people. <a href="${basename(auditPath)}">Application audit</a>.</p>`).replace('Status: pending your approval.','Status: approved and applied.');await writeFile(detail,text);
 const overview=dirname(path)+'.html';text=await readFile(overview,'utf8');text=text.replace('</h1>',`</h1><p><strong>${batch.id} applied:</strong> ${audit.applied.length} accounts across ${batch.people.length} people. <a href="${auditPath.replace(/^reports\//,'')}">Application audit</a>.</p>`).replace('No published records changed.','Approved batches have been applied; see application audits.');
 const marker=new RegExp(`(${batch.id}<\\/a><\\/td><td>\\d+<\\/td><td>\\d+<\\/td><td>)Pending approval`);text=text.replace(marker,'$1Applied');await writeFile(overview,text);
 console.log(JSON.stringify({batch:batch.id,people:batch.people.length,applied:audit.applied.length}));
}
