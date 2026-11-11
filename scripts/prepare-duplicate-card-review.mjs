/** Prepare immutable approval proposals and refresh the living review ledger. Never applies production changes. */
import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const today=new Date().toISOString().slice(0,10);
const audit=await readJson('reports/lingering-duplicate-cards.json');
let previous={cases:{},batches:{},events:[]};
try{previous=await readJson('reports/duplicate-card-review-status.json')}catch(error){if(error.code!=='ENOENT')throw error}
const caseId=rows=>'DC-'+hash([...new Set(rows.map(r=>r.recordId))].sort()).slice(0,12);
const all=[];
for(const [kind,list] of [['exact',audit.exact],['labels',audit.labels]])for(const issue of list)all.push({kind,issue,rows:issue.rows.map(r=>({...r,personId:issue.personId,name:issue.name,year:issue.year}))});
for(const issue of audit.identityReview)all.push({kind:'identity',issue,rows:issue.rows.map(r=>({...r,office:r.office,stage:r.electionType,status:r.sourceStatus}))});
const cases={};
for(const item of all){
 const id=caseId(item.rows);const row=item.rows[0];
 const entry=cases[id]??{id,personIds:[...new Set(item.rows.map(r=>r.personId))],name:[...new Set(item.rows.map(r=>r.name))].join(' / '),year:row.year,office:row.office,rows:item.rows,categories:[],status:'needs_evidence',recommendation:'Investigate before merging.',reason:'Resolve the recorded identity, affiliation, stage or reporting-scope ambiguity first.',firstSeenOn:today};
 entry.categories=[...new Set([...entry.categories,item.kind])];cases[id]=entry;
 const p=entry.personIds[0];
 if(item.kind!=='identity'&&/state-school-board/.test(item.rows[0].officeId)&&row.year===2018){entry.status=p==='kami-alvarez'?'needs_evidence':'ready_for_review';entry.recommendation=p==='kami-alvarez'?'Hold: recover the missing declaration reference.':'Merge into one candidacy, preserving declaration and evidenced ballot stages.';entry.reason='Same known person, year and district. The declaration and canvass encode affiliation differently (Unaffiliated / Not reported). Preserve both imported labels; do not fill a missing party value by inference.';}
 if(['joe-buchman','perry-t-myers','jonathan-la-rele-peterson','vance-hansen'].includes(p)){entry.status='ready_for_review';entry.recommendation='Merge declaration and general-ballot evidence; retain any write-in designation.';entry.reason='Same known candidate, year and office. Confirmed ballot evidence controls the election stage; a declaration stored under primary must not invent primary participation.';}
 if(row.year===2025){entry.status='needs_status_review';entry.recommendation='Reconcile primary-ending status, then review office-label consolidation.';entry.reason='The imported primary record says Out in Primary while the same candidate also appears on the general ballot. Do not silently retain that contradiction or infer advancement from a default winner flag.';}
 if(['paul-lloyd-selleneit','terry-williams'].includes(p)){entry.status='needs_evidence';entry.recommendation='Hold primary and general write-in paths for stage/affiliation review.';entry.reason='The general record explicitly carries the WI label; do not carry the primary party into the general ballot without evidence.';}
 if(['fred-hayes','seth-stewart'].includes(p)){entry.status='needs_status_review';entry.recommendation='Resolve competing terminal statuses or filing attempts before merging.';entry.reason='Disqualified, Withdrew, and Out in Convention describe different events. The available timeline dates and source status chronology need review.';}
 if(['dennis-jones','robert-johnson'].includes(p)){entry.status='keep_separate';entry.recommendation='Keep the municipal candidacies separate; investigate a possible person-profile collision.';entry.reason='The published municipalities and counties differ. A shared name is not identity evidence for consolidation.';}
 if(['dave-bierschied','katherine-williams'].includes(p)){entry.status='needs_scope_review';entry.recommendation='Verify cross-county district/reporting coverage before merging.';entry.reason='Grand and San Juan feeds may represent county slices or a larger district. Preserve separate totals and do not add them together without coverage evidence.';}
 if(item.kind==='identity'){entry.status='needs_identity_review';entry.recommendation='Compare primary identity documents before changing person IDs or parsing a ticket.';entry.reason=item.issue.reason;}
 if(entry.personIds.includes('derek-kitchen')){entry.status='ready_identity_review';entry.recommendation='Review a person alias and three-record timeline consolidation together.';entry.reason='The archived declaration URL names Derek Lloyd Kitchen and Senate District 2. The primary/general canvasses use the expanded name; old routes and source IDs must remain supported.';}
 if(entry.personIds.some(id=>['john-fultz','kay-s-jensen','sam-snyder'].includes(id))){entry.status='keep_separate';entry.recommendation='Keep distinct people/records unless a source correction establishes identity.';entry.reason='Short-name similarity within one newspaper return does not prove that the candidates are the same person.';}
}
// Preserve prior decisions and the audit trail; a disappeared flag is not an approval/application.
for(const [id,old] of Object.entries(previous.cases)){
 if(cases[id])cases[id]={...cases[id],...old,lastSeenOn:today};
 else cases[id]={...old,status:old.status==='applied'?'applied':'not_in_latest_audit',lastCheckedOn:today};
}
let oldAudit;
try{oldAudit=JSON.parse(execFileSync('git',['show','HEAD:reports/lingering-duplicate-cards.json'],{encoding:'utf8'}))}catch{}
for(const issue of oldAudit?.exact??[]){const id=caseId(issue.rows);if(!cases[id])cases[id]={id,personIds:[issue.personId],name:issue.name,year:issue.year,office:issue.rows[0].office,rows:issue.rows,categories:['exact'],status:'not_in_latest_audit',recommendation:'No approval needed in this review batch.',reason:'This case disappeared after a pre-existing source/status correction. It is not counted as an approved or applied proposal in this workflow.',firstSeenOn:today,lastCheckedOn:today};}
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
let batch;
try{
 const {peopleById}=await server.ssrLoadModule('/src/lib/entities.ts');
 const {candidacyHistory,candidacyEvents}=await server.ssrLoadModule('/src/lib/candidacy-history.ts');
 const {resultForFiling}=await server.ssrLoadModule('/src/lib/filing-results.ts');
 const {tidySnapshot}=await server.ssrLoadModule('/src/lib/result-names.ts');
 const names=['brittney-cummins','cindy-davis','craig-k-pitts','laura-collier-belnap','linda-b-hansen'];
 const existing=await readJson('src/data/reviewed-candidacy-groups.json');
 const proposals=[];const snapshots=new Map();
 for(const personId of names){
  const person=peopleById.get(personId);const records=person.filings.filter(f=>f.year===2018&&f.officeName.startsWith('State School Board'));
  if(records.some(r=>existing.some(g=>g.recordIds.includes(r.recordId))))throw Error('A proposed record was already applied');
  const ids=new Set(records.map(r=>r.recordId));const relevant=candidacyHistory(person.filings).filter(h=>h.records.some(r=>ids.has(r.recordId)));
  if(relevant.length!==2)throw Error(`Refresh review: ${personId} currently has ${relevant.length} cards`);
  const canonical=records.find(r=>r.status==='filed');if(!canonical?.source)throw Error('Declaration source required for this batch');
  const links=[],matched=[];
  for(const row of records.filter(r=>r.status!=='filed')){
   const stage=row.electionType;if(!snapshots.has(stage))snapshots.set(stage,tidySnapshot(await readJson(`public/data/results/2018-${stage}.json`)));
   const snapshot=snapshots.get(stage),contest=resultForFiling(row,snapshot);if(!contest||!contest.official)throw Error(`Official result mismatch: ${personId}`);
   links.push({electionType:stage,contestId:contest.id,source:contest.source,county:contest.county??null,city:contest.city??''});matched.push({contest,snapshot});
  }
  const group={id:`${personId}-2018-school-board-review`,reviewedOn:today,personId,year:2018,electionType:'general',canonicalRecordId:canonical.recordId,recordIds:records.map(r=>r.recordId),resultContestId:links.find(l=>l.electionType==='general').contestId,resultSource:links.find(l=>l.electionType==='general').source,resultLinks:links,reason:'User-reviewed declaration/canvass consolidation: exact known candidate, year and district agree. The declaration and canvasses encode affiliation differently; preserve all source labels and do not infer primary participation from the declaration alone.',sources:records.map(r=>({recordId:r.recordId,url:r.source,officeId:r.officeId,partyId:r.partyId,county:r.county,city:r.city,status:r.status,personId:r.personId,year:r.year,electionType:r.electionType}))};
  const issue=Object.values(cases).find(c=>c.personIds.length===1&&c.personIds[0]===personId&&c.year===2018);if(!issue)throw Error('Missing audit case');
  const events=candidacyEvents({filing:{...canonical,electionType:'general',status:'general_election'},records},undefined,matched);
  const proposal={caseId:issue.id,personId,name:person.name,office:canonical.officeName,officeId:canonical.officeId,year:2018,beforeCards:2,afterCards:1,recordCount:records.length,sourceSnapshots:records.map(r=>({recordId:r.recordId,personId:r.personId,year:r.year,electionType:r.electionType,officeId:r.officeId,partyId:r.partyId,status:r.status,sourceStatus:r.sourceStatus,county:r.county,city:r.city,source:r.source})),proposedGroup:group,proposedEvents:events.map(e=>({title:e.title,date:e.date,summary:e.summary,source:e.source,sourceLabel:e.sourceLabel})),recommendation:'Approve display consolidation only. Retain every record, ID, result, source link and imported party label.'};
  proposal.contentHash=hash(proposal);proposals.push(proposal);
 }
 const payload={version:1,batchId:'duplicate-cards-01',title:'2018 school-board declaration/canvass consolidation',preparedOn:today,scope:'Five known people; five cards removed from display; eleven source records retained. No production changes until this exact batch is approved.',cases:proposals};
 batch={...payload,contentHash:hash(payload)};
 const path='reports/duplicate-card-approvals/batch-01.json';
 try{const saved=await readJson(path);if(saved.contentHash!==batch.contentHash)throw Error('Existing immutable batch differs; create a new batch instead');batch=saved}catch(error){if(error.code!=='ENOENT')throw error;await writeFile(path,JSON.stringify(batch,null,2)+'\n')}
 for(const c of batch.cases){cases[c.caseId].status=previous.cases[c.caseId]?.status==='applied'?'applied':'pending_approval';cases[c.caseId].batchId=batch.batchId;cases[c.caseId].recommendation=c.recommendation;}
}finally{await server.close()}
const ledger={version:1,updatedOn:today,approvalPolicy:'Only an explicit approval of an immutable batch authorizes application. Preserve manifests and append application audit events; do not count a disappeared audit flag as approval.',cases,batches:{...previous.batches,[batch.batchId]:{id:batch.batchId,title:batch.title,status:previous.batches[batch.batchId]?.status??'pending_approval',contentHash:batch.contentHash,manifest:'duplicate-card-approvals/batch-01.json',report:'duplicate-card-approvals/batch-01.html',cases:batch.cases.map(c=>c.caseId)}},events:previous.events};
if(!ledger.events.some(e=>e.type==='batch_prepared'&&e.contentHash===batch.contentHash))ledger.events.push({type:'batch_prepared',on:today,batchId:batch.batchId,contentHash:batch.contentHash,productionChanges:0});
await writeFile('reports/duplicate-card-review-status.json',JSON.stringify(ledger,null,2)+'\n');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Duplicate cards approval batch 01</title><style>body{margin:3rem;color:#302f2b;font:16px/1.6 system-ui}main{max-width:1000px}a{color:#005b8f}h1,h2{font-family:Georgia,serif}article{border-top:1px solid #ccc;padding:1.5rem 0}table{border-collapse:collapse;width:100%}td,th{text-align:left;vertical-align:top;padding:.5rem;border-bottom:1px solid #ddd}code{overflow-wrap:anywhere;font-size:12px}</style></head><body><main><h1>Approval batch 01</h1><p><strong>Pending approval · no production changes applied.</strong></p><p>${esc(batch.scope)} Approval applies only to <code>${batch.batchId}</code>, fingerprint <code>${batch.contentHash}</code>.</p><p>The declaration and canvass name the same candidate and district. Their affiliation labels differ; those original values remain on the source records. A Filed declaration stored under “primary” does not establish primary ballot participation. Cindy Davis has an actual primary canvass record; the other four proposed timelines contain Filed and General Election only.</p>${batch.cases.map(c=>`<article><h2><a href="https://www.electionsutah.org/people/${esc(c.personId)}/">${esc(c.name)}</a></h2><p><a href="https://www.electionsutah.org/offices/${esc(c.officeId)}/">${esc(c.office)}</a> · <a href="https://www.electionsutah.org/elections/2018/">2018</a></p><p><strong>Two cards → one candidacy.</strong> ${c.recordCount} source records retained. ${esc(c.recommendation)}</p><h3>Proposed timeline</h3><ul>${c.proposedEvents.map(e=>`<li>${esc(e.title)}${e.date?` · ${esc(e.date)}`:''}${e.summary?` · ${esc(e.summary)}`:''} — <a href="${esc(e.source)}">${esc(e.sourceLabel)}</a></li>`).join('')}</ul><h3>Preserved source records</h3><table><thead><tr><th>Stage/status</th><th>Imported affiliation</th><th>Evidence</th></tr></thead><tbody>${c.sourceSnapshots.map(r=>`<tr><td>${esc(r.electionType)} · ${esc(r.sourceStatus)}</td><td>${esc(r.partyId)}</td><td><a href="${esc(r.source)}">Original source</a><br><code>${esc(r.recordId)}</code></td></tr>`).join('')}</tbody></table></article>`).join('')}<p><a href="batch-01.json">Immutable manifest</a> · <a href="../lingering-duplicate-cards.html">Living review report</a></p></main></body></html>`;
await writeFile('reports/duplicate-card-approvals/batch-01.html',html);
console.log(JSON.stringify({batch:batch.batchId,people:batch.cases.length,records:batch.cases.reduce((n,c)=>n+c.recordCount,0),contentHash:batch.contentHash,productionChanges:0}));
