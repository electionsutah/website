import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { researchFiles, createResearchSync } from './research-sync.mjs';
const directory = await mkdtemp(join(tmpdir(), 'elut-research-sync-'));
const local = join(directory, 'editor'), source = join(directory, 'research');
const candidates = JSON.stringify([{ id: 'first' }]), notes = JSON.stringify({ town: ['Original'] });
const read = file => readFile(join(local, file), 'utf8');
try {
  for (const root of [local, source]) {
    await mkdir(join(root, 'src/data'), { recursive: true });
    for (const file of researchFiles) {
      await mkdir(join(root, file, '..'), { recursive: true });
      const initial = file.endsWith('place-election-notes.json') ? notes : file.endsWith('place-enrichment.json') ? '{}' : candidates;
      await writeFile(join(root, file), initial);
    }
  }
  await writeFile(join(local, 'src/data/editor-overrides.json'), 'manual edits stay here');
  const sync = await createResearchSync(local, source, join(local, '.workspace/baseline.json'));
  assert.deepEqual(await sync(), []);
  const added = JSON.stringify([{ id: 'first' }, { id: 'new' }]);
  await writeFile(join(source, researchFiles[0]), added);
  assert.deepEqual(await sync(), [researchFiles[0]]); assert.equal(await read(researchFiles[0]), added);
  const localNote = JSON.stringify({ town: ['Independent local edit'] });
  await writeFile(join(local, researchFiles[1]), localNote);
  await writeFile(join(source, researchFiles[1]), JSON.stringify({ town: ['New research'] }));
  await writeFile(join(source, researchFiles[0]), JSON.stringify([{ id: 'third' }]));
  await assert.rejects(sync(), /local edits/);
  assert.equal(await read(researchFiles[0]), added, 'Check all files before changing any');
  assert.equal(await read(researchFiles[1]), localNote);
  assert.equal(await readFile(join(local, 'src/data/editor-overrides.json'), 'utf8'), 'manual edits stay here');
  await writeFile(join(local, researchFiles[1]), notes);
  assert.equal((await sync()).length, 2);
  const restarted = await createResearchSync(local, source, join(local, '.workspace/baseline.json'));
  assert.deepEqual(await restarted(), []);
  await writeFile(join(source, 'src/data/municipal-results.json'), JSON.stringify([{ id: 'incomplete-import' }]));
  await assert.rejects(restarted(), /public mirror differ/);
  await writeFile(join(source, 'src/data/municipal-results.json'), candidates);
  await writeFile(join(source, researchFiles[0]), '{invalid');
  await assert.rejects(restarted(), SyntaxError);
  console.log('PASS: research additions, guarded research synchronization, override preservation, restart baseline, and incomplete-write rejection');
} finally { await rm(directory, { recursive: true, force: true }); }
