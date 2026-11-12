/** Prepare batches 04–05 from existing evidence. No production writes or network requests. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=new Date().toISOString().slice(0,10);
const ledger=await read('reports/duplicate-card-review-status.json');
const existing=await read('src/data/reviewed-candidacy-groups.json');
const configs=[
 {number:'04',title:'2018 Vance Hansen write-in candidacy',cases:[['vance-hansen',2018]],note:'The declaration is imported under primary with status Filed and source label Write-In. It is filing evidence, not a primary ballot. Consolidate with the official general canvass; retain Filed and General Election only, the Unaffiliated affiliation, and original Write-In source evidence.'},
 {number:'05',title:'2012 primary/general candidacies with missing affiliations',cases:[['john-frugal-dougall',2012],['john-swallow',2012]],note:'Each pair has the same established person ID, year, and office, with an explicit primary and general ballot record. One source reports Utah Republican Party and the other Not reported. Prefer the named imported affiliation for the consolidated card; retain the original affiliation on each stage record. This does not fill a missing stage affiliation or resolve conflicting named parties.'}
];
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {peopleById,identityKey}=await server.ssrLoadModule('/src/lib/entities.ts');
 const {candidacyHistory,candidacyEvents}=await server.ssrLoadModule('/src/lib/candidacy-history.ts');
 const {resultForFiling}=await server.ssrLoadModule('/src/lib/filing-results.ts');
 const {tidySnapshot}=await server.ssrLoadModule('/src/lib/result-names.ts');
 const snapshots=new Map();
 for(const config of configs){
  const proposals=[];
  for(const [personId,year] of config.cases){
   const person=peopleById.get(personId);assert(person);
   const issue=Object.values(ledger.cases).find(c=>c.personIds.length===1&&c.personIds[0]===personId&&c.year===year);assert(issue);
   const records=issue.rows.map(r=>person.filings.find(f=>f.recordId===r.recordId));assert(records.every(Boolean));assert.equal(records.length,2);
   assert.equal(new Set(records.map(r=>r.officeId)).size,1);
   assert.equal(candidacyHistory(records).length,2,'Proposed cards must still be separate');
   assert(!existing.some(g=>g.recordIds.some(id=>records.some(r=>r.recordId===id))));
   assert.equal(new Set(records.filter(r=>r.partyId!=='not-reported').map(r=>r.partyId)).size,1);
   const canonical=config.number==='04'?records.find(r=>r.status==='filed'):records.find(r=>r.electionType==='general');assert(canonical?.source);
   const links=[],matched=[];
   for(const row of records.filter(r=>r.status!=='filed')){
    const key=`${year}-${row.electionType}`;
    if(!snapshots.has(key))snapshots.set(key,tidySnapshot(await read(`public/data/results/${key}.json`)));
    const snapshot=snapshots.get(key),contest=resultForFiling(row,snapshot);assert(contest?.official,`${personId}: official ${key} match`);
    const option=contest.options.find(o=>identityKey(o.name)===identityKey(person.name));assert(option&&option.votes>=0,`${personId}: exact candidate result`);
    links.push({electionType:row.electionType,contestId:contest.id,source:contest.source,county:contest.county??null,city:contest.city??''});matched.push({contest,snapshot});
   }
   assert(links.some(l=>l.electionType==='general'));
   if(config.number==='04')assert.deepEqual(links.map(l=>l.electionType),['general']);
   else assert.deepEqual(new Set(links.map(l=>l.electionType)),new Set(['primary','general']));
   const main=links.find(l=>l.electionType==='general');
   const proposedGroup={id:`${personId}-${year}-affiliation-review`,reviewedOn:today,personId,year,electionType:'general',canonicalRecordId:canonical.recordId,recordIds:records.map(r=>r.recordId),resultContestId:main.contestId,resultSource:main.source,resultLinks:links,reason:config.note,sources:records.map(r=>({recordId:r.recordId,url:r.source,officeId:r.officeId,partyId:r.partyId,county:r.county,city:r.city,status:r.status,personId:r.personId,year:r.year,electionType:r.electionType}))};
   const named=records.find(r=>r.partyId!=='not-reported');
   const filing={...canonical,electionType:'general',status:'general_election',partyId:named.partyId,partyName:named.partyName};
   const events=candidacyEvents({filing,records},undefined,matched);
   assert.deepEqual(events.map(e=>e.title),config.number==='04'?['Filed','General Election']:['Filed','Primary','General Election']);
   const proposal={caseId:issue.id,personId,name:person.name,office:canonical.officeName,officeId:canonical.officeId,year,beforeCards:2,afterCards:1,recordCount:records.length,sourceSnapshots:records.map(r=>({recordId:r.recordId,personId:r.personId,year:r.year,electionType:r.electionType,officeId:r.officeId,partyId:r.partyId,status:r.status,sourceStatus:r.sourceStatus,county:r.county,city:r.city,source:r.source})),proposedGroup,proposedEvents:events.map(e=>({title:e.title,date:e.date,summary:e.summary,source:e.source,sourceLabel:e.sourceLabel})),displayAffiliation:named.partyName,recommendation:config.note};
   proposal.contentHash=hash(proposal);proposals.push(proposal);
  }
  const payload={version:1,batchId:`duplicate-cards-${config.number}`,title:config.title,preparedOn:today,scope:`${proposals.length} candidacies; ${proposals.length*2} cards to ${proposals.length}; all ${proposals.length*2} source records retained. No production changes until explicit approval.`,cases:proposals};
  let batch={...payload,contentHash:hash(payload)};
  const path=`reports/duplicate-card-approvals/batch-${config.number}.json`;
  try{const saved=await read(path);assert.equal(saved.contentHash,batch.contentHash,'Immutable batch changed; prepare a new number');batch=saved}catch(e){if(e.code!=='ENOENT')throw e;await writeFile(path,JSON.stringify(batch,null,2)+'\n')}
  for(const p of proposals){ledger.cases[p.caseId].status='pending_approval';ledger.cases[p.caseId].batchId=batch.batchId;ledger.cases[p.caseId].recommendation=config.note;ledger.cases[p.caseId].reason=config.note;}
  ledger.batches[batch.batchId]={id:batch.batchId,title:batch.title,status:'pending_approval',contentHash:batch.contentHash,manifest:`duplicate-card-approvals/batch-${config.number}.json`,report:`duplicate-card-approvals/batch-${config.number}.html`,cases:proposals.map(p=>p.caseId)};
  if(!ledger.events.some(e=>e.type==='batch_prepared'&&e.contentHash===batch.contentHash))ledger.events.push({type:'batch_prepared',on:today,batchId:batch.batchId,contentHash:batch.contentHash,productionChanges:0});
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Approval batch ${config.number}</title><style>body{margin:3rem;font:16px/1.6 system-ui;color:#302f2b}main{max-width:1000px}a{color:#005b8f}article{border-top:1px solid #ccc;padding:1rem 0}table{border-collapse:collapse;width:100%}td,th{text-align:left;vertical-align:top;padding:.5rem;border-bottom:1px solid #ddd}code{overflow-wrap:anywhere}</style></head><body><main><h1>Batch ${config.number}: ${esc(config.title)}</h1><p><strong>Pending approval. No production changes applied.</strong> ${esc(batch.scope)}</p><p>${esc(config.note)}</p><p>Only this fingerprint is proposed: <code>${batch.contentHash}</code>.</p>${proposals.map(p=>`<article><h2><a href="https://www.electionsutah.org/people/${p.personId}/">${esc(p.name)}</a></h2><p><a href="https://www.electionsutah.org/offices/${p.officeId}/">${esc(p.office)}</a> · <a href="https://www.electionsutah.org/elections/${p.year}/">${p.year}</a>. Two cards → one; display affiliation: ${esc(p.displayAffiliation)}.</p><h3>Proposed timeline and counts</h3><ul>${p.proposedEvents.map(e=>`<li>${esc(e.title)}${e.date?` · ${esc(e.date)}`:''}${e.summary?` · ${esc(e.summary)}`:''} — <a href="${esc(e.source)}">${esc(e.sourceLabel)}</a></li>`).join('')}</ul><h3>Unchanged source records</h3><table><tr><th>Stage/status</th><th>Imported affiliation</th><th>Source evidence</th></tr>${p.sourceSnapshots.map(r=>`<tr><td>${esc(r.electionType)} · ${esc(r.sourceStatus)}</td><td>${esc(r.partyId)}</td><td><a href="${esc(r.source)}">Original source</a><br><code>${esc(r.recordId)}</code></td></tr>`).join('')}</table></article>`).join('')}<p><a href="batch-${config.number}.json">Immutable manifest</a> · <a href="../lingering-duplicate-cards.html">Living review report</a></p></main></body></html>`;
  await writeFile(`reports/duplicate-card-approvals/batch-${config.number}.html`,html);
  console.log(JSON.stringify({batch:batch.batchId,cases:proposals.length,contentHash:batch.contentHash,productionChanges:0}));
 }
 ledger.updatedOn=today;
 await writeFile('reports/duplicate-card-review-status.json',JSON.stringify(ledger,null,2)+'\n');
}finally{await server.close()}
