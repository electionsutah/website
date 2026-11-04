import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const server = await createServer({ configFile: false, cacheDir: new URL('../.firecrawl/check-shifts-vite', import.meta.url).pathname, logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { compareVotes, raceComparison, congressCountyComparisons, districtKey, shiftLabel, partyTotals } = await server.ssrLoadModule('/src/lib/shifts.ts');
  const fixture = (d, r, other = 0) => ({ total: d + r + other, options: [{ id: 'd', name: 'D candidate', party: 'Democratic', votes: d, winner: null }, { id: 'r', name: 'R candidate', party: 'Republican', votes: r, winner: null }, { id: 'o', name: 'Other candidate', party: 'Unaffiliated', votes: other, winner: null }] });
  assert.equal(compareVotes(fixture(61, 37, 2), fixture(42, 56, 2), 2024, 'source').shift, 38, 'Use change in all-vote margin, not one-party share or two-party share');
  assert.equal(compareVotes(fixture(30, 60, 10), fixture(60, 30, 10), 2024, 'source').shift, -60);
  assert.equal(compareVotes(fixture(45, 50, 5), fixture(45, 50, 5), 2024, 'source').shift, 0);
  assert.equal(compareVotes(fixture(60, 30, 10), fixture(0, 100), 2024, 'source').shift, null, 'No artificial swing from uncontested baseline');
  assert.equal(compareVotes(fixture(0, 0), fixture(40, 60), 2024, 'source').shift, null, 'No zero-denominator shifts');
  assert.equal(partyTotals({ ...fixture(40, 60), total: 120 }), null, 'Reject source vote inconsistencies');
  assert.equal(shiftLabel(38), 'D+38.0'); assert.equal(shiftLabel(-10), 'R+10.0'); assert.equal(shiftLabel(0.01), 'No change');
  assert.equal(districtKey('State House 3 (Multi-County) '), districtKey('State House District 3'));
  const race = { ...fixture(60, 40), name: 'State Senate District 5', id: 'senate-5', category: 'State Senate', county: null, counties: [], reporting: null, source: 'current' };
  const earlier = { ...race, ...fixture(40, 60) };
  const newer = { ...race, ...fixture(0, 100) };
  const snapshot = (year, contests) => ({ electionDate: `${year}-11-03`, source: `source-${year}`, official: true, contests });
  assert.equal(raceComparison(race, [snapshot(2022, [earlier])]).shift, 40);
  assert.equal(raceComparison(race, [snapshot(2022, [earlier]), snapshot(2024, [newer])]).shift, null, 'Never cherry-pick older contested baseline');
  assert.equal(raceComparison({ ...race, category: 'U.S. House' }, [snapshot(2024, [earlier])]).shift, null, 'Do not match redrawn congressional districts');
  assert.equal(raceComparison({ ...race, county: 'local-county', category: 'Local & measures' }, [snapshot(2024, [earlier])]).shift, null);
  const countyRace = { ...race, counties: [{ id: 'test-county-ut', ...fixture(20, 80), reporting: null }] };
  const countyPrior = { ...earlier, counties: [{ id: 'test-county-ut', ...fixture(10, 90), reporting: null }] };
  assert.equal(raceComparison(countyRace, [snapshot(2024, [countyPrior])], 'test-county-ut').shift, 20, 'County shifts use county votes, not full district totals');
  assert.equal(raceComparison(countyRace, [snapshot(2024, [{ ...countyPrior, countyTotalsReconcile: false }])], 'test-county-ut').shift, null, 'Exclude source county discrepancies');
  assert.equal(raceComparison(countyRace, [snapshot(2024, [countyPrior])], 'missing-county-ut').current, null, 'Missing county results must not display full-district shares');
  assert.equal(raceComparison(race, [snapshot(2024, [earlier, { ...earlier, id: 'duplicate' }])]).shift, null, 'Ambiguous baselines stay unavailable');
  const current = JSON.parse(await readFile(new URL('../public/data/2026-results.json', import.meta.url)));
  const histories = await Promise.all(['2024-results.json', '2022-shift-baseline.json'].map(async file => JSON.parse(await readFile(new URL(`../public/data/${file}`, import.meta.url)))));
  const eligible = [];
  for (const contest of current.contests) {
    const comparison = raceComparison(contest, histories);
    if (comparison.shift !== null) {
      assert(comparison.current.contested && comparison.previous.contested);
      assert(Math.abs(comparison.shift) <= 200);
      assert.notEqual(contest.category, 'U.S. House');
      eligible.push({ name: contest.name, year: comparison.year, shift: comparison.shift });
    }
  }
  const counties = congressCountyComparisons(current, histories[0]);
  assert.equal(counties.length, 29);
  assert.equal(new Set(counties.map(row => row.id)).size, 29);
  const sumD = counties.reduce((sum, row) => sum + (row.comparison.current?.democratic ?? 0), 0);
  const houseD = current.contests.filter(row => row.category === 'U.S. House').reduce((sum, row) => sum + partyTotals(row).democratic, 0);
  assert.equal(sumD, houseD, 'County congressional aggregation must count every Democratic vote exactly once');
  const sumR = counties.reduce((sum, row) => sum + (row.comparison.previous?.republican ?? 0), 0);
  const oldHouseR = histories[0].contests.filter(row => row.category === 'U.S. House').reduce((sum, row) => sum + partyTotals(row).republican, 0);
  assert.equal(sumR, oldHouseR, 'Historical county aggregation must count every Republican vote exactly once');
  for (const history of histories) {
    for (const contest of history.contests) {
      assert(partyTotals(contest), contest.name);
      if (contest.countyTotalsReconcile !== false) assert.equal(contest.counties.reduce((sum, row) => sum + row.total, 0), contest.total, contest.name);
    }
  }
  console.log(JSON.stringify({ comparableRaces: eligible.length, byCategory: Object.fromEntries(['State House', 'State Senate', 'School board'].map(category => [category, current.contests.filter(c => c.category === category && raceComparison(c, histories).shift !== null).length])), comparableCongressCounties: counties.filter(row => row.comparison.shift !== null).length, largestRaceShifts: eligible.sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift)).slice(0, 4), saltLakeCongress: counties.find(row => row.id === 'salt-lake-county-ut').comparison }, null, 2));
} finally { await server.close(); }
