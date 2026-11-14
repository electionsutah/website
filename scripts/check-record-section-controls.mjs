import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {render} from 'svelte/server';
const server=await createServer({configFile:false,plugins:[svelte({compilerOptions:{dev:false}})],logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {peopleById,officesById}=await server.ssrLoadModule('/src/lib/entities.ts');
 const {candidacyHistory}=await server.ssrLoadModule('/src/lib/candidacy-history.ts');
 const {matchingFilings,buildFacets}=await server.ssrLoadModule('/src/lib/facets.ts');
 const {default:HistoryList}=await server.ssrLoadModule('/src/CandidacyHistoryList.svelte');
 const becky=peopleById.get('becky-edwards'),before=JSON.stringify(becky.filings);
 const histories=candidacyHistory(becky.filings);
 const selected=histories.filter(h=>matchingFilings(h.records,{year:['2023']}).length);
 assert.equal(selected.length,1);
 assert(selected[0].records.length>1,'Filtering a consolidated card preserves its full source timeline');
 assert.equal(JSON.stringify(becky.filings),before,'Filtering does not mutate source records');
 const {body}=render(HistoryList,{props:{filings:becky.filings,personId:becky.id,navigate:()=>{}}});
 for(const label of ['Search candidacies','Filters','Tile view','List view',`${histories.length} of ${histories.length} candidacies`])assert(body.includes(label),`${label}: actual toolbar rendered`);
 const office=officesById.get('state-senate-district-2');
 const scoped=[...peopleById.values()].map(p=>({filings:p.filings.filter(f=>office.filings.includes(f))})).filter(p=>p.filings.length);
 const facets=buildFacets(scoped,{},['year','party','status']);
 assert(facets.some(f=>f.key==='year'&&f.values.length>1),'Office records expose year filters');
 assert(facets.some(f=>f.key==='party'&&f.values.length>1),'Office records expose affiliation filters');
 console.log('Record-section controls: real toolbar rendering, scoped office facets, year filtering, complete consolidated timelines, and source non-mutation passed.');
}finally{await server.close()}
