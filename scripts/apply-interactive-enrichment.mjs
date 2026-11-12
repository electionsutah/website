// Plans are read-only. Application requires the exact plan fingerprint from the CLI.
import {readFile,writeFile,open,rename,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {createServer} from 'vite';
const hash=value=>createHash('sha256').update(value).digest('hex');
const encode=value=>JSON.stringify(value,null,2)+'\n';
const [mode,reviewFile,planFile,token]=process.argv.slice(2);
if(!['plan','apply'].includes(mode)||!reviewFile||!planFile)throw Error('Use plan|apply REVIEW.json PLAN.json [fingerprint]');
let dataFile=resolve('src/data/person-link-enrichment.json');
const auditFile=resolve(planFile.replace(/\.json$/,'-application.json'));
if([resolve(reviewFile),resolve(planFile),auditFile].includes(dataFile)||resolve(reviewFile)===resolve(planFile))throw Error('Review, plan and data paths must differ');
const rawReview=await readFile(reviewFile,'utf8'),review=JSON.parse(rawReview);
const rawRun=await readFile(review.runSource,'utf8');
if(hash(rawRun)!==review.runHash)throw Error('Discovery run changed since review');
const run=JSON.parse(rawRun);
const selected=review.people.filter(p=>p.decisions.some(d=>d.decision==='approve'));
const overrideMode=selected.some(p=>run.people.find(o=>o.id===p.id)?.manualOverride);
if(overrideMode&&selected.some(p=>!run.people.find(o=>o.id===p.id)?.manualOverride))throw Error('Review editorial overrides separately from people without overrides');
if(overrideMode)dataFile=resolve('src/data/editor-overrides.json');
if([resolve(reviewFile),resolve(planFile),auditFile].includes(dataFile))throw Error('Review paths cannot overwrite production data');
const before=await readFile(dataFile,'utf8'),data=JSON.parse(before);
const date=new Date().toISOString().slice(0,10),changes=[];
const seen=new Set();
const accountCache=new Map();
function canonicalAccount(url){
 if(accountCache.has(url))return accountCache.get(url);
 const validation=spawnSync('python3',['-c','import sys,json;sys.path.insert(0,"scripts");from enrichment_pipeline import account;print(json.dumps(account(sys.argv[1])))',url],{encoding:'utf8'});
 if(validation.status!==0)throw Error('Account validation failed');
 const value=JSON.parse(validation.stdout);accountCache.set(url,value);return value;
}
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const {peopleById}=await server.ssrLoadModule('/src/lib/entities.ts');
 const {resolveEntityLinks}=await server.ssrLoadModule('/src/lib/entity-links.ts');
 const {editorialData}=await server.ssrLoadModule('/src/lib/editorial.ts');
 for(const person of review.people){
  const approvals=person.decisions.filter(d=>d.decision==='approve');
  if(!approvals.length)continue;
  if(seen.has(person.id))throw Error('Duplicate person in review');seen.add(person.id);
  const original=run.people.find(p=>p.id===person.id);
  const current=peopleById.get(person.id);
  if(!original||!current||original.kind&&original.kind!=='people')throw Error('Unknown or unsupported entity');
  const override=editorialData.people[person.id];
  if(override){
   if(!overrideMode||person.overrideAction!=='append')throw Error('Explicit append review of editorial override is required: '+person.id);
   if(JSON.stringify(override)!==JSON.stringify(original.editorialOverride))throw Error('Editorial override changed since discovery');
  }else if(overrideMode)throw Error('Editorial override was removed since discovery');
  if(JSON.stringify(resolveEntityLinks(current.links??[]))!==JSON.stringify(resolveEntityLinks(original.existingLinks??[])))throw Error('Entity links changed since discovery: '+person.id);
  const entry=overrideMode?{...data.people[person.id],links:structuredClone(data.people[person.id].links??original.existingLinks??[])}:data[person.id]??{verifiedOn:date,identityEvidence:[],sources:[],notes:[],links:structuredClone(original.existingLinks??[])};
  for(const link of overrideMode?[]:entry.links){if(!link.source)throw Error('Existing unsourced links require separate review');if(!entry.sources.includes(link.source))entry.sources.push(link.source);}
  for(const decision of approvals){
   const candidate=decision.candidate;
   if(!original.candidates.some(c=>JSON.stringify(c)===JSON.stringify(candidate))||candidate.entityId!==person.id)throw Error('Candidate differs from discovery evidence');
   if(!decision.ownershipEvidence?.trim())throw Error('Explicit ownership evidence is required');
   // Use the same canonical account filters as discovery, including historical wrappers.
   const account=canonicalAccount(candidate.url);
   if(!account||account.url!==candidate.url||account.platform!==candidate.platform)throw Error('Invalid canonical account');
   const archived=/^https?:\/\/web\.archive\.org\/web\//.test(candidate.sourceUrl)||candidate.archivedAccountUrl;
   if((original.historical||archived)&&decision.historical!==true)throw Error('Historical approval is required');
   if(decision.historical!==true&&decision.historical!==false)throw Error('Evidence classification is required');
   if(decision.snapshotDate&&!/^\d{4}-\d{2}-\d{2}$/.test(decision.snapshotDate))throw Error('Invalid evidence date');
   const url=new URL(candidate.url).href;
   if(entry.links.some(l=>canonicalAccount(l.url)?.url===candidate.url||new URL(l.url).href===url))throw Error('Account already exists: '+url);
   const snapshot=/\/web\/(\d{4})(\d{2})(\d{2})\d*(?:[a-z]+_)?\//.exec(candidate.sourceUrl);
   const snapshotDate=snapshot?`${snapshot[1]}-${snapshot[2]}-${snapshot[3]}`:decision.snapshotDate;
   const link={url:candidate.url,platform:candidate.platform,label:decision.historical?`${candidate.platform} (historical)` : candidate.platform,
    source:candidate.sourceUrl,verifiedOn:entry.verifiedOn??date,reviewedOn:date,evidenceFetchedAt:candidate.fetchedAt,
    disposition:decision.historical?'historical':'verified',ownershipEvidence:decision.ownershipEvidence,
    ...(snapshotDate?{snapshotDate}:{}),...(candidate.archivedAccountUrl?{archivedAccountUrl:candidate.archivedAccountUrl}:{}),
    reviewId:hash(JSON.stringify([review.runHash,person.id,candidate.url,candidate.sourceUrl])).slice(0,16)};
   entry.links.push(link);
   if(!overrideMode){
   if(!entry.sources.includes(link.source))entry.sources.push(link.source);
   entry.identityEvidence.push({publishedName:current.name,match:decision.ownershipEvidence,source:link.source});
   entry.notes.push(`Explicit CLI ownership review on ${date}: ${link.url}. ${decision.historical?'Historical source endorsement only; current ownership and activity not checked.':'Source endorsement reviewed; current activity not checked.'}`);
   }
   changes.push({personId:person.id,entityUrl:original.entityUrl,destination:dataFile,link});
  }
  if(overrideMode)data.people[person.id]=entry;else data[person.id]=entry;
 }
}finally{await server.close();}
if(!changes.length)throw Error('No approved changes');
const payload={version:1,dataFile,reviewHash:hash(rawReview),runHash:review.runHash,beforeHash:hash(before),afterHash:hash(encode(data)),changes};
const fingerprint=hash(JSON.stringify(payload));
if(mode==='plan'){
 await writeFile(planFile,encode({...payload,fingerprint}),{flag:'wx'});
 console.log(JSON.stringify({...payload,fingerprint}));
}else{
 const saved=JSON.parse(await readFile(planFile,'utf8'));
 if(token!==fingerprint||JSON.stringify(saved)!==JSON.stringify({...payload,fingerprint}))throw Error('Review, plan, or production data changed; regenerate and approve a new plan');
 const lockPath=dataFile+'.review-lock';
 const lock=await open(lockPath,'wx');
 let applied=false,auditCreated=false;
 const audit={dataFile,fingerprint,reviewFile,planFile,approvedAt:new Date().toISOString(),approval:'Explicit interactive CLI confirmation of exact plan fingerprint',beforeHash:hash(before),afterHash:hash(encode(data)),changes,excluded:review.people.flatMap(p=>p.decisions.filter(d=>d.decision!=='approve').map(d=>({personId:p.id,url:d.candidate.url,decision:d.decision}))),status:'pending'};
 try{
  if(hash(await readFile(dataFile,'utf8'))!==payload.beforeHash)throw Error('Production data changed during preflight');
  await writeFile(auditFile,encode(audit),{flag:'wx'});auditCreated=true;
  const temporary=dataFile+'.review-tmp';
  await writeFile(temporary,encode(data),{flag:'wx'});await rename(temporary,dataFile);applied=true;
  const checks=spawnSync('npm',['run','check:links'],{encoding:'utf8',timeout:180000});
  audit.validation={command:'npm run check:links',exitCode:checks.status,stdout:checks.stdout,stderr:checks.stderr};
  if(checks.status!==0)throw Error('Link checks failed; see application audit');
  audit.status='applied';await writeFile(auditFile,encode(audit));
  console.log(JSON.stringify({status:'applied',accounts:changes.length,auditFile,validation:'passed'}));
 }catch(error){
  if(applied&&hash(await readFile(dataFile,'utf8'))===payload.afterHash){await writeFile(dataFile,before);audit.status='rolled_back';}
  else audit.status=applied?'failed_requires_review':'not_applied';
  audit.error=error.message;if(auditCreated)await writeFile(auditFile,encode(audit));throw error;
 }finally{await lock.close();await unlink(lockPath);}
}
