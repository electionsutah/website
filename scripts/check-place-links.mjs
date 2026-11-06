import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createServer } from 'vite';
const data = JSON.parse(await readFile(new URL('../src/data/place-link-enrichment.json', import.meta.url), 'utf8'));
const profiles = JSON.parse(await readFile(new URL('../src/data/place-enrichment.json', import.meta.url), 'utf8'));
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { placesById } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { resolveEntityLinks, placeEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  for (const [id, entry] of Object.entries(data)) {
    const place = placesById.get(id);
    assert(place, `Unknown place ${id}`);
    const actual = resolveEntityLinks(place.links);
    for (const link of entry.links) {
      assert(entry.sources.includes(link.source), `Source missing for ${id}`);
      assert.equal(link.verifiedOn, entry.verifiedOn);
      assert(actual.some(item => item.url === new URL(link.url).href), `Enriched link missing from ${id}`);
      assert(!/\/sharer|\/intent\/|\/submit\?|\/reel\/|youtube\.com\/watch|youtube\.com\/live\//.test(link.url), 'Do not add share links or individual posts/videos');
    }
    const websites = actual.filter(link => link.label === 'Official website');
    assert.equal(websites.length, 1, `Exactly one official website for ${id}`);
    if (entry.links.length) assert.equal(websites[0].url, new URL(entry.canonicalWebsite).href, 'Use the verified government redirect destination');
    else assert.equal(websites[0].url, new URL(profiles[id].officialWebsite).href, 'Preserve existing website after a retrieval failure');
    assert(actual.some(link => link.platform === 'wikipedia'), `Preserve Wikipedia reference for ${id}`);
    assert(actual.some(link => link.platform === 'wikidata'), `Preserve Wikidata reference for ${id}`);
    for (const link of actual) if (!['website', 'wikipedia'].includes(link.platform)) await access(new URL(`../public/icons/external/${link.platform}.svg`, import.meta.url));
  }
  assert(data.cache.links.some(link => link.url === 'https://www.facebook.com/CacheCounty/'));
  assert(data.cache.links.every(link => !/CacheSheriff|trailscache/.test(link.url)), 'County accounts do not inherit department accounts');
  assert(data.beaver.links.every(link => !link.url.includes('ramblersutah')), 'Tourism account is not a county account');
  assert(data.davis.links.every(link => !/DiscoverDavis|Health|Sheriff|Library/i.test(link.url)), 'Select county-wide destinations from department directories');
  assert(data['salt-lake/south-jordan'].links.every(link => !link.url.includes('CacheCounty')), 'No cross-place inheritance');
  const trial = resolveEntityLinks(placeEntityLinks({officialWebsite:'https://old.example/', wikipediaUrl:'https://en.wikipedia.org/wiki/Example', wikidataUrl:'https://www.wikidata.org/wiki/Q1'}, [{url:'https://new.example/', label:'Official website'}]));
  assert(!trial.some(link => link.url.includes('old.example')), 'Verified replacement does not duplicate a stale official website');
  console.log(`Verified ${Object.keys(data).length} place reviews, ${Object.values(data).filter(entry => entry.links.length).length} refreshed websites, and ${Object.values(data).reduce((n, entry) => n + Math.max(0, entry.links.length - 1), 0)} social links.`);
} finally { await server.close(); }
