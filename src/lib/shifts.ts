import type { Contest, CountyResult, Snapshot } from './results';

export type HistoricalSnapshot = Pick<Snapshot, 'source' | 'electionDate' | 'official' | 'contests'>;
export type VoteResult = Pick<Contest, 'options' | 'total'>;
export interface PartyTotals { democratic: number; republican: number; total: number; democraticShare: number; republicanShare: number; margin: number; contested: boolean }
export interface ShiftComparison { current: PartyTotals | null; previous: PartyTotals | null; shift: number | null; reason: string; year: number | null; previousSource: string | null }
export const boundarySource = 'https://gis.utah.gov/products/sgid/political/';
export const congressBoundarySource = 'https://gis.utah.gov/products/sgid/political/us-congressional-districts/';

/** The published district number and office, not candidate identity or display spelling. */
export function districtKey(name: string) {
  const match = /^(U\.S\. House|State House|State Senate|State School Board)\s+(?:District\s+)?(\d+)\b/i.exec(name.trim());
  return match ? `${match[1].toLowerCase()}:${Number(match[2])}` : null;
}

export function partyTotals(row: VoteResult): PartyTotals | null {
  if (!Number.isFinite(row.total) || row.total <= 0 || row.options.some(option => !Number.isFinite(option.votes) || option.votes < 0) || row.options.reduce((sum, option) => sum + option.votes, 0) !== row.total) return null;
  const democratic = row.options.filter(option => option.party === 'Democratic').reduce((sum, option) => sum + option.votes, 0);
  const republican = row.options.filter(option => option.party === 'Republican').reduce((sum, option) => sum + option.votes, 0);
  return { democratic, republican, total: row.total, democraticShare: democratic / row.total * 100,
    republicanShare: republican / row.total * 100, margin: (democratic - republican) / row.total * 100,
    contested: democratic > 0 && republican > 0 };
}

export function compareVotes(currentRow: VoteResult, previousRow: VoteResult, year: number, previousSource: string): ShiftComparison {
  const current = partyTotals(currentRow), previous = partyTotals(previousRow);
  const base = { current, previous, year, previousSource };
  if (!current || !previous) return { ...base, shift: null, reason: 'Vote totals are missing or do not reconcile.' };
  if (!current.contested || !previous.contested) return { ...base, shift: null, reason: `Both a Democrat and a Republican must receive votes in each election. A missing party is not treated as a zero-percent baseline.` };
  return { ...base, shift: current.margin - previous.margin, reason: '' };
}

export function raceComparison(contest: Contest, history: HistoricalSnapshot[], county = ''): ShiftComparison {
  const currentResult = county ? contest.counties.find(row => row.id === county) : contest;
  const unavailable = (reason: string): ShiftComparison => ({ current: currentResult ? partyTotals(currentResult) : null, previous: null, shift: null, reason, year: null, previousSource: null });
  if (contest.category === 'U.S. House') return unavailable('Congressional boundaries changed for 2026. Use the countywide U.S. House comparison; district numbers do not identify the same electorate across these elections.');
  if (!['State House', 'State Senate', 'School board'].includes(contest.category) || contest.county) return unavailable(contest.category === 'Judicial retention' || !contest.options.some(option => option.party) ? 'This contest does not have a Democratic–Republican party margin.' : 'Local office matching and boundary continuity have not been verified.');
  const key = districtKey(contest.name);
  if (!key) return unavailable('The district could not be identified reliably.');
  // The state GIS catalog documents the same 2022–2032 boundary vintage for
  // these three offices. Never extrapolate this allowlist to local districts.
  const baselines = history.filter(snapshot => snapshot.official && ['2024', '2022'].includes(snapshot.electionDate.slice(0, 4))).sort((a, b) => b.electionDate.localeCompare(a.electionDate));
  for (const snapshot of baselines) {
    const matches = snapshot.contests.filter(row => !row.county && districtKey(row.name) === key);
    if (matches.length > 1) return unavailable('More than one historical contest matches this district.');
    if (matches.length !== 1) continue;
    const previousContest = matches[0];
    const year = Number(snapshot.electionDate.slice(0, 4));
    let current: VoteResult = contest, previous: VoteResult = previousContest;
    if (county) {
      if (previousContest.countyTotalsReconcile === false) return { ...unavailable('The historical county breakdown does not reconcile with its published district total.'), year, previousSource: previousContest.source };
      const currentCounty = contest.counties.find(row => row.id === county);
      const previousCounty = previousContest.counties.find(row => row.id === county);
      if (!currentCounty || !previousCounty) return { ...unavailable('This county has no matched contest results in both elections.'), year, previousSource: previousContest.source };
      current = currentCounty; previous = previousCounty;
    }
    // Do not skip an uncontested recent election in favor of a larger older shift.
    return compareVotes(current, previous, year, previousContest.source);
  }
  return unavailable('No verified prior result is imported for this district. The 2022 state canvass covers multi-county races only.');
}

function aggregateCounty(contests: Contest[], county: string): CountyResult | null {
  const house = contests.filter(row => !row.county && row.category === 'U.S. House');
  if (house.length !== 4 || new Set(house.map(row => districtKey(row.name))).size !== 4 || house.some(row => row.countyTotalsReconcile === false)) return null;
  const rows = house.flatMap(row => row.counties.filter(result => result.id === county));
  if (!rows.length || rows.some(row => !partyTotals(row)?.contested)) return null;
  return { id: county, total: rows.reduce((sum, row) => sum + row.total, 0), reporting: null,
    options: rows.flatMap(row => row.options) };
}

export function congressCountyComparisons(current: Snapshot, previous?: HistoricalSnapshot) {
  return current.counties.map(county => {
    const currentRow = aggregateCounty(current.contests, county.id);
    const previousRow = previous ? aggregateCounty(previous.contests, county.id) : null;
    const comparison: ShiftComparison = currentRow && previousRow && previous ? compareVotes(currentRow, previousRow, Number(previous.electionDate.slice(0, 4)), previous.source)
      : { current: currentRow ? partyTotals(currentRow) : null, previous: null, shift: null, year: previous ? Number(previous.electionDate.slice(0, 4)) : null, previousSource: previous?.source ?? null,
        reason: 'A complete, contested countywide U.S. House baseline is not available.' };
    return { id: county.id, name: county.name, comparison };
  });
}

export function shiftLabel(value: number) {
  if (Math.abs(value) < 0.05) return 'No change';
  return `${value > 0 ? 'D' : 'R'}+${Math.abs(value).toFixed(1)}`;
}
