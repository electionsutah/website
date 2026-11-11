import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const {peopleById,identityKey,filings}=await server.ssrLoadModule('/src/lib/entities.ts');
 const {candidacyHistory,candidacyEvents,terminalStatus}=await server.ssrLoadModule('/src/lib/candidacy-history.ts');
 const {reviewedCandidacies}=await server.ssrLoadModule('/src/lib/reviewed-candidacies.ts');
 const {resultForFiling}=await server.ssrLoadModule('/src/lib/filing-results.ts');
 const {tidySnapshot}=await server.ssrLoadModule('/src/lib/result-names.ts');
 const {resultPerson}=await server.ssrLoadModule('/src/lib/result-people.ts');
 const reviews=JSON.parse(await readFile('src/data/reviewed-candidacy-groups.json','utf8'));
 const stageSnapshots=new Map();
 for(const year of new Set(reviews.map(r=>r.year)))for(const stage of ['primary','general'])stageSnapshots.set(`${year}:${stage}`,tidySnapshot(JSON.parse(await readFile(`public/data/results/${year}-${stage}.json`,'utf8'))));
 const people=[];
 const seenIds=new Set();
 for(const review of reviews){
  const primary=stageSnapshots.get(`${review.year}:primary`),general=stageSnapshots.get(`${review.year}:general`);
  for(const id of review.recordIds){assert(!seenIds.has(id),'Reviewed groups may not overlap');seenIds.add(id)}
  const person=peopleById.get(review.personId);const original=JSON.stringify(person.filings);
  const histories=candidacyHistory(person.filings);const matched=histories.filter(h=>h.reviewId===review.id);assert.equal(matched.length,1);
  const history=matched[0];assert.equal(history.records.length,review.recordIds.length);
  if(review.id.endsWith('-2018-school-board-review')){
   assert.equal(history.filing.partyId,'unaffiliated','Named imported affiliation takes precedence over Not reported');
   assert(history.records.some(row=>row.partyId==='not-reported'),'Original missing affiliation remains on its source record');
  }
  if(review.year===2023)assert.equal(candidacyHistory(person.filings.filter(f=>f.year===2023)).length,1,`${person.name}: one 2023 candidacy`);
  if(person.id==='michael-farrell')assert(histories.some(h=>h.filing.year===2026&&h.filing.officeId==='state-house-district-23'),'A distinct office is never folded into the congressional race');
  assert.equal(new Set(histories.flatMap(h=>h.records)).size,person.filings.length);
  const main=resultForFiling(history.filing,history.filing.electionType==='general'?general:primary);assert(main);
  if(review.id.endsWith('-2023-congressional-review')){
   assert.equal(history.filing.partyId,'unaffiliated');
   assert.equal(main.official,false,'Imported general results retain their unofficial designation');
   const expected={'joe-buchman':1281,'perry-t-myers':2276,'jonathan-la-rele-peterson':2};
   assert.equal(main.options.find(o=>identityKey(o.name)===identityKey(person.name))?.votes,expected[person.id]);
   if(person.id==='jonathan-la-rele-peterson')assert(history.records.some(r=>r.sourceStatus==='Write-In'),'Original write-in designation survives consolidation');
  }
  const other=[];
  for(const stage of new Set(review.resultLinks.map(link=>link.electionType))){
   const row=history.records.find(row=>row.electionType===stage&&row.status!=='filed')??history.records.find(row=>row.electionType===stage);
   const result=resultForFiling(row,stage==='general'?general:primary);assert(result,`${person.name}: ${stage} result`);
   const option=result.options.find(option=>identityKey(option.name)===identityKey(person.name));assert(option&&option.votes>=0);
   if(stage==='primary'&&review.year===2023)assert.equal(result.official,true);
   other.push({contest:result,snapshot:stage==='general'?general:primary});
  }
  const events=candidacyEvents(history,undefined,other);
  const terminal=[...history.records].reverse().find(row=>terminalStatus(row));
  assert.deepEqual(events.map(e=>e.title),['Filed',...(review.resultLinks.some(r=>r.electionType==='primary')?['Primary']:[]),...(review.resultLinks.some(r=>r.electionType==='general')?['General Election']:[]),...(terminal?[terminalStatus(terminal)]:[])]);
  assert(events.filter(e=>['Primary','General Election'].includes(e.title)).every(e=>e.summary&&e.date),'Every actual ballot milestone has counts and a date');
  assert.equal(JSON.stringify(person.filings),original);
  assert.equal(reviewedCandidacies(history.records.map((row,i)=>i===0?{...row,source:'https://example.org/changed'}:row)).length,0,'Changed evidence requires review');
  people.push({id:person.id,name:person.name,year:review.year,beforeCards:review.recordIds.length,afterCards:1,recordsPreserved:history.records.length,stages:events.filter(e=>['Primary','General Election'].includes(e.title)).map(e=>({title:e.title,date:e.date,summary:e.summary,source:e.source})),sources:review.sources});
 }
 assert.equal(people.length,reviews.length);
 assert.equal(reviews.filter(r=>r.year===2023&&!r.id.endsWith('-2023-congressional-review')&&r.sources.some(s=>s.officeId==='u-s-house-district-2')).length,7,'Original congressional cohort remains intact');
 assert(people.filter(p=>p.year===2026).length>=35,'Batch review covers current prefix-label duplicates');
 const aaron=candidacyHistory(peopleById.get('aaron-wiley').filings).find(h=>h.filing.year===2026);
 assert.equal(aaron.records.length,2);assert.equal(aaron.filing.status,'defeated','The later primary-ending status is retained');
 assert.equal(aaron.filing.officeName,'State House District 21');
 const brandon=candidacyHistory(peopleById.get('brandon-wiseman').filings).filter(h=>h.filing.year===2023);
 assert.equal(brandon.length,1);assert.equal(brandon[0].records.length,2);assert.equal(brandon[0].filing.officeName,'Minersville Town Council');
 assert.equal(reviews.filter(r=>r.auditDisposition?.auditId==='post-push-card-audit-2026-11-10').length,30);
 const sources=JSON.parse(await readFile('src/data/reviewed-primary-results.json','utf8'));
 const batches=[];
 for(const [year,count,options] of [[2008,7,14],[2022,14,30]]){
  const rows=sources.filter(c=>c.year===year);assert.equal(rows.length,count);assert.equal(rows.flatMap(c=>c.options).length,options);
  const snapshot=JSON.parse(await readFile(`public/data/results/${year}-primary.json`,'utf8'));
  for(const row of rows){
   const imported=snapshot.contests.find(c=>c.id===row.id);assert(imported?.official&&imported.votesPublished);assert.equal(imported.total,imported.options.reduce((n,o)=>n+o.votes,0));assert.equal(imported.sourceSha256,row.sourceSha256);
   for(const option of imported.options){
    const person=resultPerson(option.name,imported);assert(person,`${year}: ${option.name} has an identified profile`);
    const filing=person.filings.find(f=>f.year===year&&f.electionType==='primary'&&f.officeName===imported.name);assert(filing,`${year}: ${option.name} has a primary ballot record`);
    assert.equal(resultForFiling(filing,tidySnapshot(snapshot))?.id,imported.id,`${year}: ${option.name} connects to the reviewed primary totals`);
   }
  }
  batches.push({year,contests:rows.length,ballotCandidates:options,source:rows[0].source,scope:year===2022?'All statewide/multi-county contests in the certified document; single-county canvasses are separate.':'Complete regular-primary document.'});
 }
 const index=JSON.parse(await readFile('src/data/result-index.json','utf8'));
 const snapshots=new Map(await Promise.all(index.filter(d=>d.electionType==='primary').map(async d=>[d.year,tidySnapshot(JSON.parse(await readFile('public'+d.url,'utf8')))])));
 let nonpartisanPrimaryCounts=0;
 for(const filing of filings.filter(f=>f.partyId==='nonpartisan'&&f.electionType==='primary')){
  const snapshot=snapshots.get(filing.year);const contest=snapshot&&resultForFiling(filing,snapshot);
  if(!contest?.votesPublished)continue;
  const primaryEvent=candidacyEvents({filing,records:[filing]},{contest,snapshot}).find(event=>event.title==='Primary');
  assert(primaryEvent?.summary&&primaryEvent.date,'Published nonpartisan primary counts reach the timeline');
  nonpartisanPrimaryCounts++;
 }
 assert(nonpartisanPrimaryCounts>700,'Sitewide nonpartisan primary regression coverage');
 const local=peopleById.get('garrett-wolfley').filings.find(f=>f.year===2025&&f.electionType==='primary');
 const localResult=resultForFiling(local,snapshots.get(2025));assert.equal(localResult.options.find(o=>o.name==='Garrett Wolfley').votes,119);
 assert.equal(resultForFiling({...local,source:'https://example.org/other'},snapshots.get(2025)),undefined,'Term omission requires the same exact ballot source');
 assert.equal(resultForFiling({...local,officeName:'Panguitch Mayor'},snapshots.get(2025)),undefined);
 assert.equal(resultForFiling({...local,county:'Salt Lake'},snapshots.get(2025)),undefined);
 assert.equal(resultForFiling({...local,city:'Tropic'},snapshots.get(2025)),undefined);
 assert.equal(resultForFiling(local,{...snapshots.get(2025),contests:[localResult,localResult]}),undefined,'Ambiguous ballot records are withheld');
 const currentPrimary=stageSnapshots.get('2026:primary');
 const currentBallots=filings.filter(f=>f.year===2026&&f.electionType==='primary'&&(f.status==='primary_election'||f.status==='defeated'&&/primary/i.test(f.sourceStatus)));
 for(const filing of currentBallots)assert(resultForFiling(filing,currentPrimary)?.votesPublished,`${filing.name}: every explicit 2026 primary ballot retains a published match`);
 const report={currentPrimaryBallotsMatched:currentBallots.length,nonpartisanPrimaryCounts,reviewedOn:'2026-11-10',people,ballotBatches:batches,duplicateCardsRemoved:people.reduce((n,p)=>n+p.beforeCards-p.afterCards,0),scope:'Reviewed 2023 congressional and 2026 party-prefix candidacies, plus all published contests in the 2008 regular-primary and 2022 statewide/multi-county primary canvasses. Each merged group has exact source-record membership and validated stage/office/party context. No broad fuzzy identity merge or unavailable-results claim is made.'};
 await writeFile('reports/candidacy-batch-review.json',JSON.stringify(report,null,2)+'\n');
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Candidacy batch review</title><style>body{margin:3rem;font:16px/1.6 system-ui;color:#302f2b}h1,h2{font-family:Georgia,serif}table{border-collapse:collapse;width:100%;margin:1rem 0 2rem}td,th{padding:.7rem;border-bottom:1px solid #ccc;text-align:left;vertical-align:top}a{color:#005b8f}small{overflow-wrap:anywhere}</style></head><body><h1>Candidacy batch review</h1><p>${esc(report.scope)}</p><h2>${people.length} candidacies reviewed across ${new Set(people.map(p=>p.id)).size} profiles</h2><p>${report.duplicateCardsRemoved} duplicate cards removed from display; ${people.reduce((n,p)=>n+p.recordsPreserved,0)} original source records retained. Primary and general election dates and votes stay separate.</p><table><thead><tr><th>Person</th><th>Cycle and cards</th><th>Preserved milestones and evidence</th></tr></thead><tbody>${people.map(p=>`<tr><td><a href="https://www.electionsutah.org/people/${p.id}/">${esc(p.name)}</a></td><td>${p.year}: ${p.beforeCards} → ${p.afterCards}</td><td>${p.stages.map(s=>`<a href="${esc(s.source)}">${esc(s.title)}</a> · ${esc(s.date)} · ${esc(s.summary)}`).join('<br>')}</td></tr>`).join('')}</tbody></table><h2>Complete source batches imported</h2><table><thead><tr><th>Year</th><th>Contests</th><th>Candidate ballot appearances</th><th>Coverage and source</th></tr></thead><tbody>${batches.map(b=>`<tr><td><a href="https://www.electionsutah.org/elections/${b.year}/">${b.year}</a></td><td>${b.contests}</td><td>${b.ballotCandidates}</td><td>${esc(b.scope)} <a href="${esc(b.source)}">Official canvass</a></td></tr>`).join('')}</tbody></table><h2>2026 primary coverage</h2><p>All ${currentBallots.length} explicit 2026 primary ballot records now match published imported vote totals. Declaration-only, withdrawn and other non-ballot statuses are excluded from that claim. County-reported totals are labeled and are never added together.</p><h2>Nonpartisan primary timelines</h2><p>${nonpartisanPrimaryCounts} matched primary records now retain their published counts and dated primary milestone. A general ballot or party label alone still does not create a primary milestone. Source-specific term annotation omissions are matched only with the same ballot URL, candidate, stage, and geography.</p><h2>Remaining source and identity work</h2><p><a href="primary-coverage-audit.html">Primary coverage audit</a> lists every primary ballot record without a published match. Missing imports, unmatched records, and empty publication feeds are separate states. Declaration-only or withdrawn records are not assumed to represent a primary ballot.</p><p><a href="filing-duplicate-review.html">Identity and filing exception queue</a> retains unresolved geography, ticket parsing, and name variants. They have not been merged on name similarity. Older scanned canvasses and county-only primary results need further extraction and evidence review.</p><p><a href="candidacy-batch-review.json">Full evidence and machine-readable report</a> · <a href="becky-edwards-filing-merge.html">Becky test-case details</a></p></body></html>`;
 await writeFile('reports/candidacy-batch-review.html',html);
 console.log(`Reviewed ${people.length} candidacies: ${report.duplicateCardsRemoved} duplicate cards removed; ${batches.reduce((n,b)=>n+b.contests,0)} source-batch contests and ${batches.reduce((n,b)=>n+b.ballotCandidates,0)} candidate ballot appearances verified; ${nonpartisanPrimaryCounts} nonpartisan primary timeline counts checked.`);
}finally{await server.close()}
