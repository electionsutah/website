import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const read = async name => JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const rows = await read('researched-candidates');
const notes = await read('place-election-notes');
const newHarmonyRows = rows.filter(row => row.city === 'New Harmony' || row.office.startsWith('New Harmony Valley Fire'));
assert.equal(newHarmonyRows.length, 13);
assert.equal(new Set(rows.map(row => `${row.year}|${row.id}|${row.office}`)).size, rows.length);
assert(rows.every(row => row.source.startsWith('https://') && row.county));
assert(newHarmonyRows.every(row => row.year !== 2024 && row.year !== 2025), 'Do not infer unnamed New Harmony filings from cancellation or appointment notices');
const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { filings, placesById, officesById } = await server.ssrLoadModule('/src/lib/entities.ts');
  const town = placesById.get('washington/new-harmony');
  assert.equal(town.filings.filter(row => row.year >= 2013).length, 6);
  assert.deepEqual([...town.years].filter(year => year >= 2013).sort(), [2017, 2019]);
  assert(town.filings.every(row => row.section === 'Municipal Offices'));
  const district = officesById.get('new-harmony-valley-fire-ssd-board-member');
  assert.equal(district.filings.length, 7);
  assert(district.filings.every(row => row.city === '' && row.section === 'Special District Offices'));
  assert.equal(district.filings.filter(row => row.electionType === 'general').length, 6);
  assert.equal(district.filings.filter(row => row.electionType === 'primary').length, 1);
  for (const row of rows) assert.equal(filings.filter(f => f.year === row.year && f.id === row.id && f.officeName === row.office).length, 1);
  assert.equal(notes[town.id].find(note => note.kind === 'vacancy_appointment').date, '2024-04-03');
  assert.equal(notes[town.id].find(note => note.kind === 'election_cancelled').date, '2025-09-03');
  const investigation = JSON.parse(await readFile(new URL('../reports/municipal-gap-investigation.json', import.meta.url), 'utf8'));
  for (const entry of investigation.municipalities) {
    assert.equal(entry.importedRecords, (entry.candidates ?? []).length);
    for (const candidate of entry.candidates ?? []) {
      assert(entry.sources.includes(candidate.source));
      assert(filings.some(row => row.city === entry.name && row.county === entry.county && row.name === candidate.name && row.officeName === candidate.office && row.year === candidate.year && row.status === candidate.status), `${entry.name}: ${candidate.name}`);
    }
  }
  console.log(`Verified ${rows.length} sourced candidates, municipal/district separation, election status, and source-reviewed gap imports.`);
} finally { await server.close(); }
