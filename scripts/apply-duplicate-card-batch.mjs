/** Apply only the explicitly approved, fingerprinted proposal; each supported batch was explicitly approved. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const number=process.argv[2];
const approvedHashes={'01':'298aa580386c6a5c4ae720262dc1a4b3564b0adfe0cbb2bdd36fa44ca4ec249f','02':'7f7d4509f5df6a06070a97b6b596ddfeda1ab7aaa0997a4384997c75355ac636','03':'bf197eeb64106652faf972e24b0ce1f13b6c2ca87f06621ac755dcc0f5ac22f5'};
assert(approvedHashes[number],'Specify an explicitly approved batch: 01, 02 or 03');
const batch=await json(`reports/duplicate-card-approvals/batch-${number}.json`);
const {contentHash,...payload}=batch;
assert.equal(contentHash,approvedHashes[number]);
assert.equal(hash(payload),contentHash);
const ledger=await json('reports/duplicate-card-review-status.json');
assert.equal(ledger.batches[batch.batchId].contentHash,contentHash);
assert.notEqual(ledger.batches[batch.batchId].status,'applied','Batch already applied');
const groups=await json('src/data/reviewed-candidacy-groups.json');
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {filings}=await server.ssrLoadModule('/src/lib/entities.ts');
 for(const proposal of batch.cases){
  const {contentHash,...p}=proposal;assert.equal(hash(p),contentHash);
  for(const snapshot of proposal.sourceSnapshots){
   const rows=filings.filter(f=>f.recordId===snapshot.recordId);assert.equal(rows.length,1);
   for(const [key,value] of Object.entries(snapshot))assert.deepEqual(rows[0][key],value,`${snapshot.recordId}: ${key}`);
   assert(!groups.some(g=>g.recordIds.includes(snapshot.recordId)),'Overlapping review');
  }
 }
}finally{await server.close()}
const now=new Date().toISOString();
for(const proposal of batch.cases){
 groups.push({...proposal.proposedGroup,reviewedOn:now.slice(0,10),reason:proposal.proposedGroup.reason+` Approved batch ${batch.batchId}. Prefer the source-imported named affiliation over Not reported; retain all raw source values.`});
 ledger.cases[proposal.caseId].status='applied';ledger.cases[proposal.caseId].appliedOn=now;
}
ledger.updatedOn=now.slice(0,10);ledger.batches[batch.batchId].status='applied';
ledger.affiliationPolicy='Prefer a matching source-imported named party/affiliation over not-reported; preserve raw values and review conflicting named affiliations.';
const audit={batchId:batch.batchId,contentHash,approvedBy:'User',approval:`Batch ${number} is approved`,appliedOn:now,people:batch.cases.length,sourceRecordsRetained:batch.cases.reduce((n,c)=>n+c.recordCount,0),cardsBefore:batch.cases.reduce((n,c)=>n+c.beforeCards,0),cardsAfter:batch.cases.reduce((n,c)=>n+c.afterCards,0),affiliationPolicy:ledger.affiliationPolicy,cases:batch.cases.map(c=>({caseId:c.caseId,personId:c.personId,groupId:c.proposedGroup.id,recordIds:c.proposedGroup.recordIds}))};
ledger.events.push({type:'batch_approved',on:now,batchId:batch.batchId,contentHash,approval:audit.approval},{type:'batch_applied',on:now,batchId:batch.batchId,contentHash,audit:`duplicate-card-approvals/batch-${number}-application.json`});
await writeFile('src/data/reviewed-candidacy-groups.json',JSON.stringify(groups,null,2).replace(/’/g,'\\u2019')+'\n');
await writeFile('reports/duplicate-card-review-status.json',JSON.stringify(ledger,null,2)+'\n');
await writeFile(`reports/duplicate-card-approvals/batch-${number}-application.json`,JSON.stringify(audit,null,2)+'\n');
console.log(`Applied approved ${batch.batchId}: ${audit.people} candidacies; ${audit.sourceRecordsRetained} source records retained.`);
