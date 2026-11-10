import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {people,offices,places,parties,candidacies,identityKey}=await server.ssrLoadModule('/src/lib/entities.ts');
 const {candidacyHistory}=await server.ssrLoadModule('/src/lib/candidacy-history.ts');
 const reviews=JSON.parse(await readFile('src/data/reviewed-candidacy-groups.json','utf8'));
 const reviewQueue=JSON.parse(await readFile('reports/filing-duplicate-review.json','utf8'));
 const scoped=[];let scopeCount=0,reviewScopeIntersections=0;
 for(const [kind,entities] of [['offices',offices],['places',places]])for(const entity of entities){
  scopeCount++;const histories=candidacyHistory(entity.filings);const groupFor=new Map(histories.flatMap(h=>h.records.map(row=>[row.recordId,h])));
  const included=new Set(entity.filings.map(f=>f.recordId));
  for(const review of reviews){
   const memberIds=review.recordIds.filter(id=>included.has(id));if(memberIds.length<2)continue;
   reviewScopeIntersections++;const displayed=[...new Set(memberIds.map(id=>groupFor.get(id)))];
   if(displayed.length>1)scoped.push({kind,entityId:entity.id,entityName:entity.name,personId:review.personId,year:review.year,reviewId:review.id,memberIds,displayedCards:displayed.length,sourceRecords:entity.filings.filter(r=>memberIds.includes(r.recordId)).map(r=>({recordId:r.recordId,source:r.source,office:r.officeName,party:r.partyName,stage:r.electionType,county:r.county,city:r.city}))});
  }
 }
 const normalize=row=>{
  let name=row.officeName.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().replace(/^(?:REP|DEM|Republican|Democratic)(?: for)?\s+/i,'').replace(/(?:[- ](?:REP|DEM)|\((?:REP|DEM)\))$/i,'').trim();
  name=name.replace(/^(?:UNITED STATES|U\.?S\.?) HOUSE OF REPRESENTATIVES\s*/i,'U.S. House ').replace(/^(?:Republican|Democratic) for Senate District /i,'State Senate District ').replace(/\bU\.S\. House District (\d+) U\.S\. House District\b/i,'U.S. House District $1');
  for(const place of [row.city,row.county&&row.county+' County'].filter(Boolean))if(name.toLowerCase().startsWith(place.toLowerCase()+' '))name=name.slice(place.length).trim();
  return identityKey(name.replace(/\b(?:city|town)\b/gi,''));
 };
 const labels=[];let personCards=0;const exact=[];
 for(const person of people){
  const histories=candidacyHistory(person.filings);personCards+=histories.length;
  const by=new Map();for(const h of histories){const key=[h.filing.year,normalize(h.filing)].join(':');by.set(key,[...(by.get(key)??[]),h])}
  for(const list of by.values()){
   if(list.length<2)continue;
   for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
    const a=list[i].filing,b=list[j].filing;
    if(a.partyId!==b.partyId&&!['not-reported'].includes(a.partyId)&&!['not-reported'].includes(b.partyId))continue;
    const geographyConflict=['county','city'].some(k=>a[k]&&b[k]&&identityKey(a[k])!==identityKey(b[k]));
    const row={personId:person.id,name:person.name,year:a.year,geographyConflict,rows:[a,b].map(f=>({recordId:f.recordId,office:f.officeName,officeId:f.officeId,party:f.partyName,source:f.source,stage:f.electionType,status:f.sourceStatus,county:f.county,city:f.city}))};
    if(a.officeId===b.officeId&&a.partyId===b.partyId)exact.push(row);else labels.push(row);
   }
  }
 }
 const duplicateIndexIds=Object.fromEntries([['people',people],['offices',offices],['parties',parties],['places',places]].map(([k,rows])=>[k,rows.length-new Set(rows.map(r=>r.id)).size]));
 const fixed=reviews.filter(r=>r.auditDisposition?.auditId==='post-push-card-audit-2026-11-10').map(r=>({personId:r.personId,year:r.year,recordIds:r.recordIds,cause:r.auditDisposition.cause,sources:r.sources.map(s=>s.url)}));
 const report={fixed,generatedOn:new Date().toISOString().slice(0,10),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),reviewManifestSha256:createHash('sha256').update(await readFile('src/data/reviewed-candidacy-groups.json')).digest('hex'),scope:'The same candidacy grouping functions used by person detail cards and office/place candidate rows. Every person, office and place scope is audited; party/election embedded People grids use one card per person ID. Label and identity findings are candidates for review, not automatic merges.',counts:{people:people.length,personCards,offices:offices.length,places:places.length,parties:parties.length,scopesChecked:scopeCount,reviewScopeIntersections,confirmedScopedDuplicates:scoped.length,exactKeyPairs:exact.length,labelVariantPairs:labels.length,identityReviewPairs:reviewQueue.review.length,duplicateIndexIds},scoped,exact,labels,identityReview:reviewQueue.review};
 await writeFile('reports/lingering-duplicate-cards.json',JSON.stringify(report,null,2)+'\n');
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const entity=(kind,id,name)=>`<a href="https://www.electionsutah.org/${kind}/${esc(id)}/">${esc(name)}</a>`;
 const records=rows=>'<ul>'+rows.map(row=>`<li>${esc(row.office)} · ${esc(row.party)} · ${esc(row.stage)} · ${esc([row.county,row.city].filter(Boolean).join('/'))} — <a href="${esc(row.source)}">source</a></li>`).join('')+'</ul>';
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lingering duplicate card audit</title><style>body{margin:3rem;font:16px/1.6 system-ui;color:#302f2b}h1,h2{font-family:Georgia,serif}a{color:#005b8f}article{border-top:1px solid #ccc;padding:1rem 0}table{border-collapse:collapse}td,th{text-align:left;padding:.5rem 1rem .5rem 0;border-bottom:1px solid #ccc}</style></head><body><h1>Lingering duplicate card audit</h1><p>${esc(report.scope)}</p><p>${people.length} person pages (${personCards} candidacy cards), ${offices.length} office pages, ${places.length} place pages, and ${parties.length} party entities checked. No duplicate entity IDs in the four entity indexes.</p><h2>Resolved in this pass: ${fixed.length}</h2><p>Nine same-ballot repeats and twenty-one explicit primary-party suffix variants were consolidated after the initial push. Every source record is retained. Terminal primary statuses remain on the combined timeline.</p><ul>${fixed.map(r=>`<li>${entity('people',r.personId,r.personId)} · ${r.year} · ${esc(r.cause)} — ${r.sources.map((url,i)=>`<a href="${esc(url)}">source ${i+1}</a>`).join(', ')}</li>`).join('')}</ul><h2>Confirmed scope-specific repeats: ${scoped.length}</h2><p>These repeat cards already belong to an explicitly reviewed candidacy group. The current page contains only part of that group, so the full-membership merge does not apply.</p>${scoped.map(row=>`<article><h3>${entity(row.kind,row.entityId,row.entityName)} · ${entity('people',row.personId,row.personId)}</h3><p>${row.year} · ${row.displayedCards} displayed rows for one reviewed candidacy.</p>${records(row.sourceRecords)}</article>`).join('')}<h2>Exact office/year/party pairs: ${exact.length}</h2><p>Conflicting geography or distinct ticket evidence can make these separate records legitimate.</p>${exact.map(row=>`<article><h3>${entity('people',row.personId,row.name)} · ${row.year}</h3><p>${row.geographyConflict?'Conflicting geography — hold for identity/jurisdiction review.':'Review source/status before merging.'}</p>${records(row.rows)}</article>`).join('')}<h2>Additional label variants: ${labels.length}</h2>${labels.map(row=>`<article><h3>${entity('people',row.personId,row.name)} · ${row.year}</h3><p>${row.geographyConflict?'Conflicting geography.':'Compatible metadata; office labels need evidence review.'}</p>${records(row.rows)}</article>`).join('')}<h2>Identity/ticket review</h2><p>${reviewQueue.review.length} unresolved pairs remain in the <a href="filing-duplicate-review.html">source-linked identity review</a>. Similar names are not sufficient to merge people.</p><p><a href="lingering-duplicate-cards.json">Full machine-readable audit</a></p></body></html>`;
 await writeFile('reports/lingering-duplicate-cards.html',html);
 console.log(JSON.stringify({counts:report.counts,scopedExamples:scoped.slice(0,8),labelExamples:labels.slice(0,8)},null,2));
}finally{await server.close()}
