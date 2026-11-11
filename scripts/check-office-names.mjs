import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {formatOfficeName}=await server.ssrLoadModule('/src/lib/office-names.ts');
 const {offices,officesById,filings,importedFilings}=await server.ssrLoadModule('/src/lib/entities.ts');
 const {tidySnapshot}=await server.ssrLoadModule('/src/lib/result-names.ts');
 for(const [source,expected] of [
  ['STATE SENATE DISTRICT 13 (DEM)','State Senate District 13 (DEM)'],
  ['state senate district 13 (dem)','State Senate District 13 (DEM)'],
  ['REP State Senate District 7','REP State Senate District 7'],
  ['U.S. HOUSE OF REPRESENTATIVES<br/>DISTRICT 2','U.S. House of Representatives District 2'],
  ['CITY COUNCIL','City Council'],['ASPEN PEAKS SCHOOL BOARD 4 (5 YEAR TERM)','Aspen Peaks School Board 4 (5 Year Term)'],
  ['Governor & LIEUTENANT GOVERNOR','Governor & Lieutenant Governor'],
  ['COUNTY COMMISSION SEAT A','County Commission Seat A'],
  ['county council district a','County Council District A'],
  ['McAdams SSD Board of Trustees','McAdams SSD Board of Trustees'],
  ['MCCORNICK EMS BOARD','McCornick EMS Board'],['ÉCOLE BOARD OF TRUSTEES','École Board of Trustees']
 ])assert.equal(formatOfficeName(source),expected);
 assert.equal(officesById.get('state-senate-district-13-dem').name,'State Senate District 13 (DEM)');
 assert(filings.filter(f=>f.officeId==='state-senate-district-13-dem').every(f=>f.officeName==='State Senate District 13 (DEM)'));
 assert(importedFilings.some(f=>f.rawOfficeName==='STATE SENATE DISTRICT 13 (DEM)'),'Original source labels remain available');
 for(const office of offices){assert.equal(office.name,formatOfficeName(office.name),'Directory names are normalized and idempotent');assert(!/\b(?:STATE|SENATE|HOUSE|DISTRICT|COUNCIL|BOARD|MAYOR)\b/.test(office.name),office.name)}
 for(const filing of filings)assert.equal(filing.officeName,formatOfficeName(filing.officeName));
 const raw=JSON.parse(await readFile('public/data/results/2026-primary.json','utf8'));
 const tidy=tidySnapshot(raw);
 for(let i=0;i<raw.contests.length;i++){
  const before=raw.contests[i],after=tidy.contests[i];assert.equal(before.id,after.id);assert.equal(before.source,after.source);
  assert.deepEqual(before.options.map(o=>[o.id,o.votes]),after.options.map(o=>[o.id,o.votes]));
  if(before.kind==='candidate')assert.equal(after.name,formatOfficeName(after.name));
 }
 console.log(`Office names: ${offices.length} offices and ${filings.length} filings use standard display capitalization; acronyms, source labels, identifiers and results retained.`);
}finally{await server.close()}
