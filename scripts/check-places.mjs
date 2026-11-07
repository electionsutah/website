import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const server = await createServer({ configFile: false, plugins: [svelte()], logLevel: 'error',
  cacheDir: '.firecrawl/check-places-vite', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { places } = await server.ssrLoadModule('/src/lib/entities.ts');
  const newHarmony = places.find(place => place.id === 'washington/new-harmony');
  assert(newHarmony, 'Municipalities without imported filings must remain discoverable');
  assert.equal(newHarmony.parentId, 'washington');
  assert(places.find(place => place.id === 'washington').children.includes(newHarmony), 'New Harmony belongs in Washington County');
  assert(newHarmony.links.some(link => link.url === 'https://newharmony.utah.gov/'), 'New Harmony has its verified government website');
  const directory = JSON.parse(await readFile(new URL('../src/data/place-directory.json', import.meta.url), 'utf8'));
  for (const entry of directory) {
    const place = places.find(place => place.name === entry.name && place.county === entry.county);
    assert(place, `Directory place must have a page: ${entry.name}`);
    assert(places.find(parent => parent.id === place.parentId)?.children.includes(place), `Missing county listing: ${entry.name}`);
  }
  const { default: View } = await server.ssrLoadModule('/src/EntityViews.svelte');
  const { render } = await server.ssrLoadModule('svelte/server');
  const { default: profiles } = await server.ssrLoadModule('/src/data/place-enrichment.json');
  const read = async (name) => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url)));
  const [images, registration, participation] = await Promise.all(['place-images', 'voter-registration', 'voter-participation'].map(read));
  const { placeImageFor } = await server.ssrLoadModule('/src/lib/place-images.ts');
  assert.equal(placeImageFor(undefined), undefined);
  assert.equal(placeImageFor({ id: 'missing', parentId: 'missing' }), undefined);
  assert.equal(Object.keys(registration.counties).length, 29);
  assert.equal(Object.keys(participation.counties).length, 29);
  assert.equal(Object.values(registration.counties).reduce((n, row) => n + row.active, 0), registration.state.active);
  for (const field of ['activeRegistered', 'ballotsCast']) {
    assert.equal(Object.values(participation.counties).reduce((n, row) => n + row[field], 0), participation.state[field]);
  }
  const researched = await read('researched-candidates');
  let verifiedCandidateLinks = 0;
  const report = [];
  for (const place of places) {
    const profile = profiles[place.id];
    assert(profile?.summary, `Missing profile: ${place.id}`);
    const imageKey = images[place.id] ? place.id : place.parentId;
    const image = images[imageKey];
    assert.equal(placeImageFor(place)?.src, image?.src, `Index and detail photos must agree: ${place.id}`);
    assert(image?.src && image?.artist && image?.license && image?.sourceUrl, `Missing credited hero: ${place.id}`);
    await access(new URL(`../public${image.src}`, import.meta.url));
    const county = place.type === 'County' ? place.id : place.parentId;
    assert(registration.counties[county], `Missing registration: ${place.id}`);
    assert(participation.counties[county], `Missing participation: ${place.id}`);
    const { body } = render(View, { props: { section: 'places', id: place.id, navigate() {} } });
    for (const candidate of researched.filter(row => row.city === place.name && row.county === place.county && row.section === 'Municipal Offices')) {
      const filing = place.filings.find(row => row.year === candidate.year && row.name === candidate.name && row.officeName === candidate.office);
      assert(filing, `Researched filing missing from place: ${place.id} / ${candidate.name}`);
      assert(body.includes(candidate.name), `Candidate missing from rendered place: ${place.id} / ${candidate.name}`);
      assert(body.includes(`href="/people/${filing.personId}/"`), `Candidate profile link missing: ${place.id} / ${candidate.name}`);
      verifiedCandidateLinks++;
    }
    if (!place.filings.length) {
      assert(body.includes('No candidate records imported yet.'), `Empty archive context: ${place.id}`);
      assert(body.includes('Municipal election coverage review'), `Missing sourced coverage review: ${place.id}`);
    }
    if (place.id === 'washington/new-harmony') {
      assert(body.includes('2025 municipal election cancelled'));
      assert(body.includes('2024 council vacancy filled'));
      assert(body.includes('not a public election'));
    }
    assert(body.includes('place-profile-title'), `Missing facts panel: ${place.id}`);
    assert(body.includes('has-photo'), `Missing hero photo: ${place.id}`);
    assert(body.includes('2024 general election turnout'), `Missing turnout: ${place.id}`);
    assert(body.includes('Registration by party'), `Missing party breakdown: ${place.id}`);
    if (place.type !== 'County') {
      assert(body.includes('Countywide context, not city turnout.'), `Unlabeled county turnout: ${place.id}`);
      assert(body.toLowerCase().includes('city registration counts are not published'), `Unlabeled county registration: ${place.id}`);
    }
    report.push({ place: place.id, profile: true, population: profile.population ?? null,
      website: profile.officialWebsite || null, photo: imageKey === place.id ? 'local' : 'county fallback',
      photoSource: image.sourceUrl, registrationAsOf: registration.asOf, participationElection: participation.electionDate });
  }
  // The reported blank-panel failure must stay fixed even if a future import adds a place without enrichment.
  const key = 'wayne/hanksville', profile = profiles[key];
  try {
    delete profiles[key];
    const { body } = render(View, { props: { section: 'places', id: key, navigate() {} } });
    assert(body.includes('place-profile-title') && body.includes('Registration by party') && body.includes('2024 general election turnout'));
  } finally { profiles[key] = profile; }
  await mkdir(new URL('../tmp/place-audit/', import.meta.url), { recursive: true });
  await writeFile(new URL('../tmp/place-audit/coverage.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(`Verified ${verifiedCandidateLinks} researched candidate names and profile links on ${report.length} rendered place pages: facts, attributed hero photos, registration, and certified participation. ${report.filter(row => row.photo === 'county fallback').length} county photo fallbacks.`);
} finally { await server.close(); }
