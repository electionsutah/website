import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const data = JSON.parse(await readFile(new URL('../src/data/party-enrichment.json', import.meta.url), 'utf8'));
const references = JSON.parse(await readFile(new URL('../src/data/party-reference-links.json', import.meta.url), 'utf8'));
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { parties, partiesById } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { resolveEntityLinks } = await server.ssrLoadModule('/src/lib/entity-links.ts');
  assert.deepEqual(Object.keys(data).sort(), parties.map(p => p.id).sort(), 'Every party and affiliation has a review disposition');
  assert.deepEqual(Object.keys(references).sort(), parties.map(p => p.id).sort(), 'Every party and affiliation has a Wikimedia review disposition');
  for (const [id, entry] of Object.entries(data)) {
    const party = partiesById.get(id);
    assert.equal(party.website, entry.officialWebsite);
    const reference = references[id];
    assert.equal(resolveEntityLinks(party.links).length, entry.links.length + reference.links.length, `No invalid or duplicate destinations for ${id}`);
    for (const link of entry.links) {
      assert(entry.sources.includes(link.source));
      assert.equal(link.verifiedOn, entry.verifiedOn);
    }
    for (const link of reference.links) {
      assert(reference.sources.includes(link.source), `Reference provenance for ${id}`);
      assert.equal(link.verifiedOn, reference.reviewedOn);
      const resolved = resolveEntityLinks([link])[0];
      assert(['wikipedia', 'wikidata'].includes(resolved.platform), 'Reference review must not add organization accounts');
      assert.equal(resolved.platform, new URL(link.url).hostname === 'www.wikidata.org' ? 'wikidata' : 'wikipedia');
    }
    for (const platform of ['wikipedia', 'wikidata']) {
      const expected = ['verified', 'historical'].includes(reference[`${platform}Status`]) ? 1 : 0;
      assert.equal(reference.links.filter(link => link.platform === platform).length, expected, `Disposition agrees with ${platform} coverage for ${id}`);
    }
  }
  assert.equal(partiesById.get('peoples-freedom-party').website, '', 'An Instagram account is not a separate website');
  assert.equal(resolveEntityLinks(partiesById.get('peoples-freedom-party').links)[0].platform, 'instagram');
  for (const id of ['pinecone', 'sagebrush', 'nonpartisan', 'not-reported', 'unaffiliated', 'united-utah-party']) assert.equal(resolveEntityLinks(partiesById.get(id).links).filter(link => !['wikipedia', 'wikidata'].includes(link.platform)).length, 0, 'Do not invent organization accounts or relabel parent/successor websites');
  const justice = partiesById.get('justice');
  const { partyProfile } = await server.ssrLoadModule('/src/lib/entity-profiles.ts');
  const { descriptionLinks } = await server.ssrLoadModule('/src/lib/description-links.ts');
  const justiceDescriptionLinks = descriptionLinks(partyProfile(justice).description, '/parties/justice/');
  assert(justiceDescriptionLinks.some(link => link.href === '/people/ross-c-rocky-anderson/'), 'Link the founder to the matching Rocky Anderson record');
  assert(!justiceDescriptionLinks.some(link => link.href === '/people/anderson/'), 'Do not autolink the founder to a surname-only namesake');
  assert.equal(justice.name, 'Justice Party');
  assert.equal(justice.historical, true);
  assert.equal(justice.website, '', 'An archived website is not a verified current website');
  assert(justice.links.some(link => link.url === 'https://web.archive.org/web/20220815033923/https://www.justiceparty.us/' && link.label.includes('archived August 15, 2022')), 'Keep the dated official archive as a labeled historical reference');
  assert.equal(justice.filings.length, 3);
  for (const filing of justice.filings) {
    assert.equal(filing.rawParty, 'Justice');
    assert.equal(filing.partyName, 'Justice Party');
    assert.equal(filing.partyId, 'justice');
    assert(filing.recordId.endsWith('-justice'), 'Preserve established filing IDs');
  }
  await access(new URL(`../public${justice.logo}`, import.meta.url));
  assert(references['independent-american-party'].links.some(link => link.url.endsWith('/Q131538243')), 'Use the Utah party, not its distinct national namesake');
  assert(!references['green-party-of-utah'].links.some(link => link.platform === 'wikidata'), 'A directory QID is not a Utah party identifier');
  assert(references['utah-constitution-party'].links.every(link => link.label.includes('national party')), 'Label national context explicitly');
  assert(references['united-utah-party'].links.every(link => link.label.includes('historical party')), 'Label the merged-party history explicitly');
  assert.equal(references['peoples-freedom-party'].links.length, 0, 'Do not attach overseas namesakes');
  assert(partiesById.get('utah-libertarian-party').links.every(link => !link.url.includes('CottamForCongress') && !link.url.includes('watch?')), 'Candidate and speech links stay out');
  assert.equal(resolveEntityLinks(partiesById.get('forward-party-of-utah').links).filter(link => link.platform === 'youtube').length, 1, 'Keep one endorsed YouTube account');
  console.log(`Verified all ${parties.length} party records, ${Object.values(data).reduce((n, entry) => n + entry.links.length, 0)} organization links, and ${Object.values(references).reduce((n, entry) => n + entry.links.length, 0)} sourced reference links.`);
} finally { await server.close(); }
