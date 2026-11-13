import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({configFile:false,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {rankByTitle,matchesQuery,queryTokens}=await server.ssrLoadModule('/src/lib/search.ts');
 const {contestTitle}=await server.ssrLoadModule('/src/lib/result-people.ts');
 const data=JSON.parse(await readFile('public/data/2026-results.json','utf8'));
 const counties=new Map(data.counties.map(c=>[c.id,c.name]));
 const options=data.contests.map(c=>({value:c.id,label:`${c.county?`${counties.get(c.county)} · `:''}${contestTitle(c)}`,metadata:`${c.name} ${c.options.map(o=>`${o.name} ${o.party}`).join(' ')} ${c.counties.map(row=>counties.get(row.id)).join(' ')}`}));
 for(const query of ['Davis','Utah','Salt Lake']){
  const tokens=queryTokens(query),matches=options.filter(o=>matchesQuery(`${o.label} ${o.metadata}`,tokens));
  const original=[...matches];const ranked=rankByTitle(matches,tokens,o=>o.label);
  const titles=matches.filter(o=>matchesQuery(o.label,tokens));
  assert(titles.length);
  assert.deepEqual(new Set(ranked.slice(0,titles.length)),new Set(titles),`${query}: race titles before jurisdiction/candidate-only matches`);
  assert.deepEqual(new Set(ranked),new Set(matches),'Every metadata match remains available');
  assert.deepEqual(matches,original,'Ballot order is not mutated');
  if(query==='Davis'){
   assert(ranked[0].label.startsWith('Davis County'),'County-local races lead');
   const houses=ranked.filter(o=>/^U\.S\. House District/.test(o.label));
   assert(houses.length,'A House race matches Davis in jurisdiction metadata');
   for(const house of houses)assert(ranked.indexOf(house)>=titles.length,'House races follow every Davis title match');
  }
  console.log(`${query}: ${titles.length} title matches ahead of ${ranked.length-titles.length} metadata matches`);
 }
 assert.deepEqual(rankByTitle(options,[],o=>o.label),options,'Empty search retains ballot order');
}finally{await server.close()}
