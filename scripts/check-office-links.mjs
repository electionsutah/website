import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const data = JSON.parse(await readFile(new URL('../src/data/office-enrichment.json', import.meta.url), 'utf8'));
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { officesById } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { resolveEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  for (const [id, entry] of Object.entries(data)) {
    const office = officesById.get(id);
    assert(office, `Unknown office ${id}`);
    assert.equal(resolveEntityLinks(office.links).length, entry.links.length, `Invalid or duplicate links for ${id}`);
    for (const link of office.links) {
      assert(entry.sources.includes(link.source), `Missing source for ${id}`);
      assert.equal(link.verifiedOn, entry.verifiedOn);
      assert(!/\.pdf(?:$|\?)|\/xcode\//i.test(link.url), 'Documents and statutes remain resource links');
    }
    if (/^state-(house|senate|school-board)-district-/.test(id)) {
      assert.equal(office.links.length, 1, 'Do not copy institutional socials onto district offices');
      assert.equal(office.links[0].label, 'Official officeholder profile');
    }
  }
  assert.equal(officesById.get('state-house-district-16').links.length, 0, 'Do not guess an absent roster entry');
  assert.equal(officesById.get('state-school-board-district-2').links.length, 0, 'Do not assign a former member to a vacant seat');
  assert(data['state-auditor'].links.every(link => !/x\.com|twitter\.com/.test(link.url)), 'Withhold conflicting auditor handles');
  console.log(`Verified ${Object.keys(data).length} office records and ${Object.values(data).reduce((n, entry) => n + entry.links.length, 0)} sourced links.`);
} finally { await server.close(); }
