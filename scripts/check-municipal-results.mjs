import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
const server = await createServer({ configFile: false, plugins: [svelte()], logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { municipalResults } = await server.ssrLoadModule('/src/lib/municipal-results.ts');
  const { default: View } = await server.ssrLoadModule('/src/EntityViews.svelte');
  const { render } = await server.ssrLoadModule('svelte/server');
  assert.equal(municipalResults.length, 8);
  assert.equal(municipalResults.reduce((n,c) => n+c.options.length,0),17);
  assert.equal(new Set(municipalResults.map(c => c.id)).size,8);
  for(const placeId of new Set(municipalResults.map(c => c.placeId))) {
    const { body } = render(View,{props:{section:'places',id:placeId,navigate(){}}});
    assert(body.includes('Municipal election results'),placeId);
    for(const c of municipalResults.filter(c=>c.placeId===placeId)) {
      assert.equal(c.totalCandidateVotes,c.options.reduce((n,o)=>n+o.votes,0));
      assert(body.includes(c.source));
      for(const o of c.options) {
        assert(o.personId,`${c.id}: ${o.name}`);
        assert(body.includes(`href="/people/${o.personId}/"`));
        assert(body.includes(o.name));
        assert(Number.isInteger(o.votes)&&o.votes>=0);
        assert.equal(o.winner,null,'Do not infer winners from ranking or ties');
      }
    }
  }
  const council=municipalResults.find(c=>c.placeId==='emery/elmo'&&c.office==='Town Council');
  assert.equal(council.seats,null);
  assert.equal(council.options.filter(o=>o.votes===23).length,2);
  assert.equal(municipalResults.find(c=>c.options.some(o=>o.name==='Gary Price')).options.find(o=>o.name==='Gary Price').votes,44);
  console.log('Verified 8 rendered municipal result tables, 17 linked candidates, vote reconciliation, write-ins and unresolved winner/seat metadata.');
} finally { await server.close(); }
