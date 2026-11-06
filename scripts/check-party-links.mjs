import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const data = JSON.parse(await readFile(new URL('../src/data/party-enrichment.json', import.meta.url), 'utf8'));
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { parties, partiesById } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { resolveEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  assert.deepEqual(Object.keys(data).sort(), parties.map(p => p.id).sort(), 'Every party and affiliation has a review disposition');
  for (const [id, entry] of Object.entries(data)) {
    const party = partiesById.get(id);
    assert.equal(party.website, entry.officialWebsite);
    assert.equal(resolveEntityLinks(party.links).length, entry.links.length, `No invalid or duplicate destinations for ${id}`);
    for (const link of party.links) {
      assert(entry.sources.includes(link.source));
      assert.equal(link.verifiedOn, entry.verifiedOn);
    }
  }
  assert.equal(partiesById.get('peoples-freedom-party').website, '', 'An Instagram account is not a separate website');
  assert.equal(resolveEntityLinks(partiesById.get('peoples-freedom-party').links)[0].platform, 'instagram');
  for (const id of ['pinecone', 'sagebrush', 'nonpartisan', 'not-reported', 'unaffiliated', 'united-utah-party']) assert.equal(partiesById.get(id).links.length, 0, 'Do not invent organization accounts or relabel parent/successor websites');
  assert(partiesById.get('utah-libertarian-party').links.every(link => !link.url.includes('CottamForCongress') && !link.url.includes('watch?')), 'Candidate and speech links stay out');
  assert.equal(resolveEntityLinks(partiesById.get('forward-party-of-utah').links).filter(link => link.platform === 'youtube').length, 1, 'Keep one endorsed YouTube account');
  console.log(`Verified all ${parties.length} party records and ${Object.values(data).reduce((n, entry) => n + entry.links.length, 0)} sourced links.`);
} finally { await server.close(); }
