import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
const server = await createServer({ configFile: false, plugins: [svelte()], logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { municipalResults } = await server.ssrLoadModule('/src/lib/municipal-results.ts');
  const { default: View } = await server.ssrLoadModule('/src/EntityViews.svelte');
  const { render } = await server.ssrLoadModule('svelte/server');
  assert.equal(municipalResults.length, 1611);
  assert.equal(municipalResults.reduce((n,c) => n+c.options.length,0),5062);
  assert.equal(new Set(municipalResults.map(c => c.id)).size,1611);
  for(const placeId of new Set(municipalResults.map(c => c.placeId))) {
    const { body } = render(View,{props:{section:'places',id:placeId,navigate(){}}});
    assert(body.includes('Municipal election results'),placeId);
    for(const c of municipalResults.filter(c=>c.placeId===placeId)) {
      assert.equal(c.totalCandidateVotes,c.options.reduce((n,o)=>n+o.votes,0));
      assert(body.includes(c.source));
      for(const o of c.options) {
        if(c.kind === 'candidate') assert(o.personId,`${c.id}: ${o.name}`);
        if(c.kind === 'candidate') assert(body.includes(`href="/people/${o.personId}/"`));
        assert(body.includes(o.name.replaceAll('&','&amp;')));
        assert(o.votes === null || Number.isInteger(o.votes)&&o.votes>=0);
        assert.equal(o.winner,null,'Do not infer winners from ranking or ties');
      }
    }
  }
  const council=municipalResults.find(c=>c.year===2017&&c.placeId==='emery/elmo'&&c.office==='Town Council');
  assert.equal(council.seats,null);
  assert.equal(council.options.filter(o=>o.votes===23).length,2);
  assert.equal(municipalResults.find(c=>c.options.some(o=>o.name==='Gary Price')).options.find(o=>o.name==='Gary Price').votes,44);
  const alton = municipalResults.filter(c => c.placeId === 'kane/alton');
  assert.equal(alton.length,6);
  assert(alton.every(c=>!c.official));
  assert.equal(alton.reduce((n,c)=>n+c.totalCandidateVotes,0),300);
  assert.equal(alton.flatMap(c=>c.options).filter(o=>o.writeIn).length,4);
  assert.deepEqual(alton.find(c=>c.year===1993&&c.office==='Mayor').options.map(o=>o.votes),[17,17]);
  const { elections } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { default: ElectionIndex } = await server.ssrLoadModule('/src/ElectionViews.svelte');
  // Directory state reads the URL; exercise both layouts with an unfiltered location.
  const previousWindow = globalThis.window;
  const indexBodies = [];
  try {
    for(const view of ['grid','list']) {
      globalThis.window = { location: { pathname:'/elections/', search:`?view=${view}`, hash:'' } };
      indexBodies.push(render(ElectionIndex,{props:{id:'',navigate(){}}}).body);
    }
  } finally { if(previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
  for(const year of [1989,1991,1993,1995]) {
    assert(elections.find(c=>c.year===year)?.filings.length, `Missing cycle ${year}`);
    assert(indexBodies.every(body => body.includes(`href="/elections/${year}/"`)), `Historical year missing from elections index: ${year}`);
  }
  assert.equal(municipalResults.filter(c=>!c.official&&c.kind==='measure').length,63);
  assert.equal(municipalResults.filter(c=>!c.official&&c.kind==='candidate').length,1540);
  const unknown=municipalResults.flatMap(c=>c.options).filter(o=>o.votes===null);
  assert.equal(unknown.length,16,'Illegible or absent tallies must remain unknown');
  const ogden = municipalResults.filter(c=>c.year===1991&&c.municipality==='Ogden');
  for(const ward of [1,2,3,4]) assert(ogden.some(c=>c.office===`Council Ward ${ward}`),'Keep ward contests distinct');
  const logan = municipalResults.filter(c=>c.year===1995&&c.municipality==='Logan');
  assert.equal(logan.length,4,'Municipal Council is a candidate contest');
  assert(logan.every(c=>c.kind==='candidate'));
  const helper=municipalResults.find(c=>c.year===1995&&c.municipality==='Helper');
  assert(helper.options.some(o=>o.name==='Patricia Johnston'&&o.votes===208));
  assert(helper.options.some(o=>o.name==='James Beason'&&o.votes===181&&o.writeIn));
  assert.equal(new Set(municipalResults.filter(c=>!c.official).map(c=>c.placeId)).size,242);
  console.log('Verified all 1611 result tables and their candidate links, vote reconciliation, write-ins and unresolved winner/seat metadata.');
} finally { await server.close(); }
