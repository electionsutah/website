import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { matchesQuery, queryTokens, rankByTitle, searchText } = await server.ssrLoadModule('/src/lib/search.ts');
  const entities = await server.ssrLoadModule('/src/lib/entities.ts');
  const tokens = queryTokens('  DAVIS  ');
  for (const category of ['people', 'offices', 'parties', 'places', 'elections']) {
    const title = (item) => category === 'elections' ? String(item.year) : item.name;
    const matches = entities[category].filter((item) => matchesQuery(searchText[category](item), tokens));
    const original = [...matches];
    const ranked = rankByTitle(matches, tokens, title);
    assert.deepEqual(matches, original, 'Ranking must not mutate directory order');
    assert.equal(ranked.length, matches.length, 'Ranking must preserve every match');
    const titleMatches = matches.filter((item) => matchesQuery(title(item), tokens));
    assert.deepEqual(new Set(ranked.slice(0, titleMatches.length)), new Set(titleMatches), `${category}: title matches must precede related-record matches`);
    if (category === 'people') {
      assert(ranked.slice(0, 6).some((item) => item.name === 'Adam Davis'), 'Adam Davis must appear in the People preview');
    }
    if (category === 'places') assert.equal(ranked[0].name, 'Davis County');
    console.log(`${category}: ${titleMatches.length} title matches ahead of ${matches.length - titleMatches.length} related-record matches`);
  }

  const titles = ['Aaron Perry', 'Davis School Board', 'County Davis', 'Davis County', 'Davis County Sheriff'];
  assert.deepEqual(rankByTitle(titles, queryTokens(' davis   COUNTY '), (title) => title), [
    'Davis County', 'County Davis', 'Davis County Sheriff', 'Davis School Board', 'Aaron Perry'
  ], 'Exact title, all words in any order, partial title, then related matches; ties retain order');
  assert.deepEqual(rankByTitle(titles, [], (title) => title), titles, 'Blank searches preserve default order');
  assert(matchesQuery('Adam Davis U.S. House', queryTokens('house davis')), 'Words may still match across title and related text');
  assert(!matchesQuery('Adam Davis U.S. House', queryTokens('davis senate')), 'Every query word is still required');
} finally {
  await server.close();
}
