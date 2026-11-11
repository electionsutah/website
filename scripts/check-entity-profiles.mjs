import assert from 'node:assert/strict';
import {createServer} from 'vite';
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const {offices,officesById,parties,placesById,places,filings,importedFilings}=await server.ssrLoadModule('/src/lib/entities.ts');
 const {officeProfile,partyProfile}=await server.ssrLoadModule('/src/lib/entity-profiles.ts');
 const get=id=>officeProfile(officesById.get(id),placesById);
 // Keep the historical source geography while presenting one canonical municipality.
 const northSaltLake=places.filter(p=>p.name==='North Salt Lake');
 assert.deepEqual(northSaltLake.map(p=>p.id),['davis/north-salt-lake']);
 const corrected=importedFilings.filter(f=>f.city==='North Salt Lake'&&f.county==='Salt Lake');
 assert(corrected.length>0);
 for(const original of corrected){
  const filing=filings.find(f=>f.recordId===original.recordId);
  assert.equal(filing.county,'Davis');
  assert.deepEqual(filing.placeIds,['davis','davis/north-salt-lake']);
  assert(northSaltLake[0].filings.includes(filing));
  assert(!placesById.get('salt-lake').filings.includes(filing));
 }
 const {descriptionLinks}=await server.ssrLoadModule('/src/lib/description-links.ts');
 assert.deepEqual(descriptionLinks('North Salt Lake'),[{text:'North Salt Lake',href:'/places/davis/north-salt-lake/'}]);

 for(const office of offices){const p=officeProfile(office,placesById);assert(p.description&&p.scope&&p.note,office.id);for(const c of p.communities) if(c.placeId)assert(placesById.has(c.placeId));}
 for(const party of parties)assert(partyProfile(party).description.length>40,party.id);
 const house=get('state-house-district-18');
 assert(house.communities.some(c=>/Centerville/i.test(c.name)));
 assert(house.boundaryPeriod.includes('2022'));
 assert(get('u-s-house-district-1').boundaryPeriod.includes('2026'));
 assert.equal(officeProfile({id:'state-senate-district-30',name:'State Senate District 30',sections:['State Senate']},placesById).communities.length,0);
 assert.equal(officeProfile({id:'state-school-board-district-16',name:'State School Board District 16',sections:['State School Board']},placesById).communities.length,0);
 assert(get('state-senate-district-8-2-year-term').communities.length>0);
 assert(get('state-school-board-district-7-2-year-term').communities.length>0);
 assert.equal(get('state-auditor').communities.length,29);
 assert.equal(get('u-s-president-vice-president').scope,'United States');
 assert.equal(get('salt-lake-city-council-district-1').communities[0].partial,true);
 assert.equal(get('salt-lake-county-council-district-1').communities.length,0);
 assert(get('salt-lake-county-district-attorney').communities.length>1);
 assert.equal(get('alpine-school-board-district-3').communities.length,0);
 assert(get('alpine-school-board-district-3').note.includes('not yet been verified'));
 // Filing addresses must never affect jurisdiction output.
 assert.deepEqual(officeProfile({...officesById.get('state-house-district-18'),placeIds:['washington/st-george']},placesById),house);
 const profiles=offices.map(o=>[o,officeProfile(o,placesById)]);
 console.log(`${offices.length} office descriptions; ${parties.length} affiliation descriptions; ${profiles.filter(([,p])=>p.communities.length).length} offices with community lists.`);
 console.log('Unmatched municipal titles:',profiles.filter(([o,p])=>o.sections.includes('Municipal office')&&!p.communities.length).map(([o])=>o.name).join('; '));
 console.log('House District 18:',house.communities);
}finally{await server.close()}
