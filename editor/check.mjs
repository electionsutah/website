// Exercise real repository records through Decap's official local filesystem backend.
// All writes are confined to a temporary workspace; repository content is never edited.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { prepare, syncRecord, validateRecord, atomicJson, readJson, root, overridesPath } from './workspace.mjs';

const require = createRequire(import.meta.url);
const { runDevServer } = require('@decap/cli/dev');
const directory = await mkdtemp(join(tmpdir(), 'elections-editor-'));
const baseline = await readFile(overridesPath, 'utf8');
const server = await createServer({ root, configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
let proxy;
try {
  const saved = { version: 1, people: {}, filings: {} };
  const destination = join(directory, 'overrides.json');
  await atomicJson(destination, saved);
  const state = await prepare(server, directory, saved);
  const editorial = await server.ssrLoadModule('/src/lib/editorial.ts');
  const { contactAddresses, addressMapUrl, isMailingAddress } = await server.ssrLoadModule('/src/lib/contact-addresses.ts');
  const addressList = [{ label: 'Office', value: '825 N 300 W, Salt Lake City, UT' }, { label: 'Mailing', value: 'P.O. Box 522340, Salt Lake City, UT 84152' }];
  editorial.validateChanges('people', { 'contact.address': addressList });
  assert.deepEqual(contactAddresses('123 Main St'), [{ label: 'Address', value: '123 Main St' }]);
  assert.deepEqual(contactAddresses('Campaign office: 123 Main St\nMailing: PO Box 1'), [{ label: 'Campaign office', value: '123 Main St' }, { label: 'Mailing', value: 'PO Box 1' }]);
  assert.deepEqual(contactAddresses([]), []);
  assert.equal(new URL(addressMapUrl(addressList[1])).searchParams.get('query'), addressList[1].value);
  assert.notEqual(addressMapUrl(addressList[0]), addressMapUrl(addressList[1]));
  assert.equal(isMailingAddress(addressList[0]), false);
  assert.equal(isMailingAddress(addressList[1]), true);
  assert.equal(isMailingAddress({ label: 'Address', value: 'P.O. Box 123, Salt Lake City' }), true);
  assert.equal(isMailingAddress({ label: 'Mailing address', value: '123 Main St' }), true);
  assert.throws(() => editorial.validateChanges('people', { 'contact.address': [{ label: 'Office', value: '' }] }));
  proxy = await runDevServer({ port: 0, host: '127.0.0.1', mode: 'fs', dir: directory, logLevel: 'error' });
  const endpoint = `http://127.0.0.1:${proxy.address().port}/api/v1`;
  const request = async (action, params) => {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, params }) });
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  assert.equal((await request('info')).type, 'local_fs');
  const [relative, entry] = [...state.catalog].find(([, row]) => row.kind === 'people' && row.id === 'ben-mcadams');
  const record = await readJson(join(directory, relative));
  const persist = async () => request('persistEntry', {
    branch: 'editor', entry: { path: relative, slug: entry.filename.slice(0, -5), raw: JSON.stringify(record) }, assets: [],
    options: { collectionName: 'people', commitMessage: 'Local editor check', useWorkflow: false, status: 'draft' }
  });
  record.record.overrides = { biography: 'Local editor round-trip check.', 'contact.address': addressList, 'contact.website': 'https://example.org/campaign', priorities: [], resources: [{ label: 'Platform', description: 'Published positions', url: 'https://example.org/platform' }] };
  validateRecord(record, entry, state.validateChanges);
  await persist();
  await syncRecord(relative, state, destination);
  let compiled = await readJson(destination);
  assert.deepEqual(compiled.people['ben-mcadams'], record.record.overrides);
  let profile = editorial.applyChanges(entry.source, compiled.people['ben-mcadams']);
  assert.equal(profile.biography, 'Local editor round-trip check.');
  assert.equal(profile.contact.website, 'https://example.org/campaign');
  assert.deepEqual(profile.contact.address, addressList, 'Multiple addresses survive a Decap save');
  assert.equal(profile.contact.email, 'press@benmcadams.com', 'Editing the website preserves the standard email field');
  assert.deepEqual(profile.priorities, [], 'An explicit empty list clears imported priorities');

  // Regenerating all Decap documents uses the tracked overrides rather than replacing them.
  await prepare(server, directory, compiled);
  assert.deepEqual((await readJson(join(directory, relative))).record.overrides, compiled.people['ben-mcadams']);
  profile = editorial.applyChanges({ ...entry.source, biography: 'A newer imported biography' }, compiled.people['ben-mcadams']);
  assert.equal(profile.biography, 'Local editor round-trip check.', 'Manual changes survive source refreshes');
  delete record.record.overrides.biography;
  await persist(); await syncRecord(relative, state, destination);
  compiled = await readJson(destination);
  profile = editorial.applyChanges({ ...entry.source, biography: 'A newer imported biography' }, compiled.people['ben-mcadams']);
  assert.equal(profile.biography, 'A newer imported biography', 'Removing an override restores inheritance');
  record.record.overrides = {};
  await persist(); await syncRecord(relative, state, destination);
  assert.equal((await readJson(destination)).people['ben-mcadams'], undefined, 'Resetting all fields removes the stored override');

  const [filingRelative, filingEntry] = [...state.catalog].find(([, row]) => row.kind === 'filings' && row.source.county && row.source.city);
  const filing = await readJson(join(directory, filingRelative));
  filing.record.overrides = { city: 'New City', county: 'Salt Lake', 'contact.email': '' };
  await atomicJson(join(directory, filingRelative), filing);
  await syncRecord(filingRelative, state, destination);
  const corrected = editorial.applyFilingChanges(filingEntry.source, (await readJson(destination)).filings[filingEntry.id]);
  assert.deepEqual(corrected.placeIds, ['salt-lake', 'salt-lake/new-city']);
  assert.equal(corrected.contact.email, '');
  assert.equal(corrected.personId, filingEntry.source.personId, 'Filing identity is preserved');
  assert.throws(() => state.validateChanges('people', { 'contact.website': 'javascript:alert(1)' }));
  assert.throws(() => state.validateChanges('people', { lastVerified: '2026-02-30' }));
  assert.throws(() => state.validateChanges('filings', { personId: 'different-person' }));
  assert.throws(() => state.validateChanges('filings', { status: 'made-up-status' }));
  assert.throws(() => validateRecord({ ...record, id: 'different-id' }, entry, state.validateChanges));
  assert.equal(await readFile(overridesPath, 'utf8'), baseline, 'Checks never change repository overrides');
  console.log(`Editor checks passed: ${state.counts.people} people, ${state.counts.filings} filings; Decap save, persistence, regeneration, inheritance, clearing, geography, and validation.`);
} finally {
  if (proxy) await new Promise(resolve => proxy.close(resolve));
  await server.close();
  await rm(directory, { recursive: true, force: true });
}
