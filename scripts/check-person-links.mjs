import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const data = JSON.parse(await readFile(new URL('../src/data/person-link-enrichment.json', import.meta.url), 'utf8'));
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { peopleById } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { resolveEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  for (const [id, entry] of Object.entries(data)) {
    const person = peopleById.get(id);
    assert(person, `Unknown person ${id}`);
    assert(entry.identityEvidence.length, `Identity evidence required for ${id}`);
    assert.equal(resolveEntityLinks(person.links).length, entry.links.length, `Invalid or duplicate links for ${id}`);
    for (const link of person.links) {
      assert(entry.sources.includes(link.source), `Link source missing for ${id}`);
      assert.equal(link.verifiedOn, entry.verifiedOn);
      assert(!/ballotpedia\.org|actblue\.com|sanjuanutahdems\.com/.test(link.url), 'Supporting directories, encyclopedias, and donation forms are not person websites');
      assert(!/\/intent\/|\/sharer|\/share\/|youtube\.com\/watch|youtu\.be\//.test(link.url), 'Accounts must not be share endpoints or individual videos');
      assert(!/^https?:\/\/(?:www\.)?(?:facebook\.com\/utahsenate|twitter\.com\/utahsenate|facebook\.com\/UtahPublicEducation)/i.test(link.url), 'Institutional accounts must not become personal links');
    }
  }
  const michael = data['michael-r-stoddard'];
  assert(michael.links.some(link => link.url === 'https://2amike4congress.org/'));
  assert(!data['michael-stoddard']?.links.some(link => /2amike4congress/.test(link.url)), 'Current campaign belongs to the 2026 identity, not a separate historical record');
  assert(peopleById.get('michael-r-stoddard').filings.some(f => f.year === 2026 && f.officeName === 'U.S. House District 3'));
  assert(data['ben-mcadams'].links.some(link => link.url.includes('bsky.app/profile/benmcadams.')));
  assert.equal(resolveEntityLinks(data['riley-owen'].links).filter(link => link.platform === 'youtube').length, 1);
  console.log(`Verified ${Object.keys(data).length} person records and ${Object.values(data).reduce((n, entry) => n + entry.links.length, 0)} sourced links.`);
} finally { await server.close(); }
