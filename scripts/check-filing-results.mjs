import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { people } = await server.ssrLoadModule('/src/lib/entities.ts');
  const { resultForFiling, resultsForFiling, loadFilingResults } = await server.ssrLoadModule('/src/lib/filing-results.ts');
  const { tidySnapshot } = await server.ssrLoadModule('/src/lib/result-names.ts');
  const data = tidySnapshot(JSON.parse(await readFile('public/data/2026-results.json', 'utf8')));
  const person = people.find(row => row.name === 'Avery Lee Olsen');
  assert.ok(person, 'Reference candidate exists');
  const filing = person.filings.find(row => row.year === 2026);
  const result = resultForFiling(filing, data);
  assert.ok(result, 'San Juan sheriff filing matches its results');
  assert.equal(result.county, 'san-juan-county-ut');
  assert.equal(result.options[0].votes, 1705);
  assert.equal(resultForFiling({ ...filing, electionType: 'primary' }, data), undefined);
  assert.equal(resultForFiling({ ...filing, year: 2024 }, data), undefined);
  assert.equal(resultForFiling({ ...filing, county: 'Salt Lake' }, data), undefined);
  assert.equal(resultForFiling({ ...filing, officeName: 'County Attorney' }, data), undefined);
  assert.equal(resultForFiling(filing, { ...data, contests: [...data.contests, result] }), undefined, 'Ambiguous results are withheld');
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(`public${url}`, 'utf8')) });
  try {
    const historical = people.find(row => row.name === 'Cabot W. Nelson');
    for (const [year,votes] of [[2018,1458],[2020,607]]) {
      const filing = historical.filings.find(row => row.year === year && row.officeName === 'State House District 25');
      assert.ok(filing);
      const result = await resultsForFiling(filing);
      assert.ok(result, `${year} archived filing finds exact ballot results`);
      assert.equal(result.contest.options.find(option => option.name === 'Cabot W. Nelson').votes,votes);
      assert.equal(result.contest.official,true);
      assert.equal(result.contest.electionType,'general');
    }
    const index=JSON.parse(await readFile('src/data/result-index.json','utf8'));
    for (const dataset of index) {
      const snapshot=await loadFilingResults(dataset.year,dataset.electionType);
      assert.equal(snapshot.contests.length,dataset.contests);
      for (const contest of snapshot.contests) {
        assert.equal(new Set(contest.options.map(option=>option.id)).size,contest.options.length);
        if (contest.votesPublished && contest.optionTotalsReconcile !== false) assert.ok(Math.abs(contest.options.reduce((sum,o)=>sum+o.votes,0)-contest.total)<0.000001);
      }
    }
    const missing=await loadFilingResults(2023,'primary');
    assert.ok(missing.contests.some(contest => contest.votesPublished === false && contest.options.some(option => option.votesPublished === false)), 'Unpublished vote placeholders stay distinct from true zeroes');
    const writeins=await loadFilingResults(2016);
    const president=writeins.contests.filter(contest=>contest.name==='U.S. President & Vice President');
    assert.equal(president.length,1);
    assert.equal(president[0].options.length,25,'Separate named-write-in panels join the full contest');
    console.log(`Historical filing results and all ${index.length} dataset loads passed.`);
  } finally { globalThis.fetch = fetchBefore; }
  console.log('Filing results: exact office/person/county match, wrong cycle, primary, wrong office/county, and ambiguity passed.');
} finally { await server.close(); }
