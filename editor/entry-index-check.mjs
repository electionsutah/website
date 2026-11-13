import assert from 'node:assert/strict';
import { collectionIndex, invalidateCollectionIndex } from './entry-index.mjs';

const state = { catalog: new Map([
  ['content/people/person.json', { kind: 'people', id: 'person', title: 'A Person', source: { biography: 'large snapshot'.repeat(10000) } }],
  ['content/filings/filing.json', { kind: 'filings', id: 'filing', title: '2026 · Declaration of candidacy' }]
]) };
const params = { folder: 'content/people', extension: 'json', depth: 1 };
const first = collectionIndex(state, params);
const [entry] = JSON.parse(first);
assert.deepEqual(JSON.parse(entry.data), { id: 'person', title: 'A Person' });
assert.equal(entry.file.path, 'content/people/person.json');
assert(first.length < 500, 'List entries exclude full snapshots and form data');
state.catalog.get(entry.file.path).title = 'Renamed person';
assert.equal(collectionIndex(state, params), first);
invalidateCollectionIndex(state, 'people');
const [renamed] = JSON.parse(collectionIndex(state, params));
assert.equal(JSON.parse(renamed.data).title, 'Renamed person');
assert.notEqual(renamed.file.id, entry.file.id);
for (const folder of ['../people', 'content/people/../../', 'content/unknown']) {
  assert.throws(() => collectionIndex(state, { ...params, folder }));
}
assert.throws(() => collectionIndex(state, { ...params, extension: 'js' }));
console.log('PASS: compact collection indexes, collection isolation, invalidation, and path validation');
