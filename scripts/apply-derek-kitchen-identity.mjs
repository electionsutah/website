/** Apply the user's explicit identity confirmation; keep all imported records intact. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const path='reports/duplicate-card-approvals/derek-kitchen-identity-application.json';
const audit=await read(path);assert(audit.confirmedBy==='User');assert(!audit.appliedOn,'Already applied');
const reviews=await read('src/data/reviewed-candidacy-groups.json');
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {peopleById,identityKey}=await server.ssrLoadModule('/src/lib/entities.ts');
 const {resultForFiling}=await server.ssrLoadModule('/src/lib/filing-results.ts');
 const {tidySnapshot}=await server.ssrLoadModule('/src/lib/result-names.ts');
 const person=peopleById.get('derek-kitchen');assert(person);assert.equal(person.name,'Derek Kitchen');
 for(const id of audit.aliases)assert(!peopleById.has(id),'Duplicate person removed from directory');
 const before=audit.before.flatMap(p=>p.records),ids=before.map(r=>r.recordId).sort();
 assert.deepEqual(person.filings.map(r=>r.recordId).sort(),ids);
 for(const original of before){const row=person.filings.find(r=>r.recordId===original.recordId);for(const [key,value] of Object.entries(original))if(key!=='personId')assert.deepEqual(row[key],value,`${original.recordId}: ${key} preserved`);}
 assert.deepEqual(peopleById.get('derek-l-draper').filings.map(f=>f.recordId),audit.unrelatedDraperRecordIds);
 const records=person.filings.filter(r=>r.year===2018&&r.officeId==='state-senate-district-2');assert.equal(records.length,3);
 assert(!reviews.some(g=>g.recordIds.some(id=>records.some(r=>r.recordId===id))));
 const canonical=records.find(r=>r.status==='filed');assert(canonical);
 const links=[];audit.results=[];
 for(const row of records.filter(r=>r.status!=='filed')){
  const snapshot=tidySnapshot(await read(`public/data/results/2018-${row.electionType}.json`));
  const result=resultForFiling(row,snapshot);assert(result?.official);
  const option=result.options.find(o=>identityKey(o.name)===identityKey(person.name));assert(option&&option.votes>=0);
  links.push({electionType:row.electionType,contestId:result.id,source:result.source,county:result.county??null,city:result.city??''});audit.results.push({stage:row.electionType,votes:option.votes,total:result.total,date:result.electionDate??snapshot.electionDate,source:result.source});
 }
 assert.deepEqual(new Set(links.map(l=>l.electionType)),new Set(['primary','general']));
 const general=links.find(l=>l.electionType==='general');
 const group={id:'derek-kitchen-2018-user-confirmed-identity',reviewedOn:new Date().toISOString().slice(0,10),personId:person.id,year:2018,electionType:'general',canonicalRecordId:canonical.recordId,recordIds:records.map(r=>r.recordId),resultContestId:general.contestId,resultSource:general.source,resultLinks:links,reason:'User explicitly confirmed Derek Kitchen, Derek L. Kitchen, and Derek Lloyd Kitchen are the same individual based on prior in-depth research. Consolidate the exact 2018 Senate District 2 declaration and primary/general canvasses; retain every source spelling, source record, and stage result. Preserve 2015 municipal and 2026 congressional candidacies separately.',sources:records.map(r=>({recordId:r.recordId,url:r.source,officeId:r.officeId,partyId:r.partyId,county:r.county,city:r.city,status:r.status,personId:r.personId,year:r.year,electionType:r.electionType}))};
 reviews.push(group);audit.groupId=group.id;audit.appliedOn=new Date().toISOString();
 audit.approvedScope={confirmation:audit.confirmation,canonicalPersonId:person.id,aliases:audit.aliases,recordIds:ids,merged2018RecordIds:group.recordIds};
 audit.contentHash=createHash('sha256').update(JSON.stringify(audit.approvedScope)).digest('hex');
 await writeFile('src/data/reviewed-candidacy-groups.json',JSON.stringify(reviews,null,2)+'\n');
 await writeFile(path,JSON.stringify(audit,null,2)+'\n');
 const ledger=await read('reports/duplicate-card-review-status.json');
 const cases=Object.values(ledger.cases).filter(c=>c.personIds.includes('derek-kitchen')&&c.personIds.includes('derek-lloyd-kitchen'));
 assert.equal(cases.length,2);
 const batchId='derek-kitchen-identity';
 for(const c of cases){c.status='applied';c.batchId=batchId;c.appliedOn=audit.appliedOn;c.reason=group.reason;c.recommendation='Applied: one person, one 2018 Senate candidacy, with all six imported records retained across three election years.';}
 ledger.batches[batchId]={id:batchId,title:'User-confirmed Derek Kitchen identity and 2018 candidacy',status:'applied',contentHash:audit.contentHash,manifest:'duplicate-card-approvals/derek-kitchen-identity-application.json',report:'duplicate-card-approvals/derek-kitchen-identity.html',cases:cases.map(c=>c.id)};
 ledger.events.push({type:'identity_confirmed_and_applied',on:audit.appliedOn,batchId,confirmation:audit.confirmation,contentHash:audit.contentHash,canonicalPersonId:person.id,aliases:audit.aliases});ledger.updatedOn=audit.appliedOn.slice(0,10);
 await writeFile('reports/duplicate-card-review-status.json',JSON.stringify(ledger,null,2)+'\n');
 console.log(JSON.stringify({person:person.id,recordsRetained:ids.length,merged2018Records:records.length,results:audit.results}));
}finally{await server.close()}
