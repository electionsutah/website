// Exercise the shared matcher against identity edge cases and the bundled results.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { people } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { createResultPersonResolver, resultPerson, retainedJudgeName, personHref } = await server.ssrLoadModule('/src/lib/result-people.ts');
  const snapshot = JSON.parse(await readFile(new URL('../public/data/2026-results.json', import.meta.url), 'utf8'));
  const race = { name: 'U.S. House District 2', county: null };
  assert.equal(resultPerson('BLAKE D. MOORE', race)?.id, 'blake-d-moore');
  assert.equal(resultPerson('BEN MCADAMS', race)?.id, 'ben-mcadams');
  assert.equal(resultPerson('BLAKE MOORE', race), undefined, 'Do not guess missing middle names');
  for (const response of ['YES', 'NO', 'FOR', 'AGAINST', 'Adjudicated Write-Ins']) assert.equal(resultPerson(response, race), undefined);

  const template = people.find(person => person.id === 'blake-d-moore');
  const first = { ...template, id: 'first', name: 'Alex O’Neil', filings: [{ ...template.filings[0], personId: 'first', name: 'Alex O’Neil', year: 2026, officeName: 'U.S. House District 2' }] };
  const second = { ...first, id: 'second', filings: [{ ...first.filings[0], personId: 'second', officeName: 'State House District 2' }] };
  const resolve = createResultPersonResolver([first, second]);
  assert.equal(resolve('ALEX O\'NEIL', race)?.id, 'first', 'Normalize punctuation and disambiguate by filing');
  assert.equal(resolve('Alex O’Neil', { ...race, name: 'County Sheriff' }), undefined, 'Ambiguous names stay unlinked');
  assert.equal(resolve('Alex O’Neal', race), undefined, 'Similar names stay unlinked');
  const alias = { ...first, name: 'Alex J. O’Neil' };
  assert.equal(createResultPersonResolver([alias])('ALEX O\'NEIL', race)?.id, 'first', 'Recognize names recorded in filings');

  const knownIds = new Set(people.map(person => person.id));
  const matched = new Set();
  const unmatched = new Set();
  let candidateMatches = 0;
  let judgeMatches = 0;
  const responses = new Set(['YES', 'NO', 'FOR', 'AGAINST', 'WRITE-IN', 'WRITE-INS', 'ADJUDICATED WRITE-INS']);
  for (const contest of snapshot.contests) {
    for (const option of contest.options) {
      const person = resultPerson(option.name, contest);
      if (responses.has(option.name.trim().toUpperCase())) { assert.equal(person, undefined); continue; }
      if (person) { candidateMatches++; matched.add(person.id); assert(knownIds.has(person.id)); assert.equal(personHref(person), `/people/${person.id}/`); }
      else unmatched.add(option.name.trim());
    }
    const name = retainedJudgeName(contest);
    if (name) {
      const judge = resultPerson(name, contest);
      if (judge) { judgeMatches++; matched.add(judge.id); }
      else unmatched.add(name);
    }
    for (const county of contest.counties) {
      for (const option of county.options) {
        assert.equal(resultPerson(option.name, contest)?.id, resultPerson(option.name, { ...contest, counties: [] })?.id, 'County views use the same identity rules');
      }
    }
  }
  console.log(JSON.stringify({ candidateMatches, judgeMatches, linkedPeople: matched.size, unmatchedNames: unmatched.size, unmatchedStateCandidates: snapshot.contests.filter(c => !c.county).flatMap(c => c.options.filter(o => !responses.has(o.name.trim().toUpperCase()) && !resultPerson(o.name, c)).map(o => ({name:o.name.trim(),contest:c.name}))) }, null, 2));
} finally { await server.close(); }
