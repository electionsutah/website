import { identityKey, type Filing } from './entities';
import { resultPerson } from './result-people';
import { count, percent, type Contest, type Snapshot } from './results';
import { reviewedCandidacies } from './reviewed-candidacies';

export type CandidacyHistory = { filing: Filing; records: Filing[]; reviewId?: string };
export type FilingResult = { contest: Contest; snapshot: Snapshot };
export type CandidacyEvent = { title: string; electionType?: string; date?: string; placeIds: string[]; source: string; sourceLabel: string; summary?: string; terminal?: boolean };

/** Exact identity only: retain each source and stage within the same candidacy. */
export function candidacyHistory(records: Filing[]): CandidacyHistory[] {
  const consolidated = new Map<Filing, CandidacyHistory>();
  for (const group of reviewedCandidacies(records)) {
    const history = { filing: group.filing, records: group.records, reviewId: group.review.id };
    for (const row of group.records) consolidated.set(row, history);
  }
  const byIdentity = new Map<string, Filing[]>();
  for (const row of records) {
    if (consolidated.has(row)) continue;
    const key = JSON.stringify([row.personId, row.year, row.officeId, row.partyId]);
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), row]);
  }
  for (const rows of byIdentity.values()) {
    if (rows.length < 2) continue;
    // Conflicting places or duplicate stage records need review, not an automatic merge.
    if (!(['county', 'city'] as const).every(key => new Set(rows.map(row => identityKey(row[key])).filter(Boolean)).size <= 1)) continue;
    // A primary-ending status conflicts with a later general appearance: leave it for review.
    if (rows.some(row => terminalStatus(row) && /primary|convention/i.test(row.sourceStatus)) && rows.some(row => row.electionType === 'general' && !terminalStatus(row) && row.status !== 'filed')) continue;
    const keys = rows.map(row => terminalStatus(row) || (row.status === 'filed' ? 'filed' : row.electionType));
    if (new Set(keys).size !== keys.length) continue;
    const ordered = [...rows].sort((a, b) => stageOrder(a) - stageOrder(b));
    const latest = ordered.at(-1)!;
    const filing = { ...latest, county: rows.find(row => row.county)?.county ?? '', city: rows.find(row => row.city)?.city ?? '',
      placeIds: [...new Set(rows.flatMap(row => row.placeIds))] };
    const history = { filing, records: ordered };
    for (const row of rows) consolidated.set(row, history);
  }
  const emitted = new Set<CandidacyHistory>();
  return records.flatMap(row => {
    const history = consolidated.get(row);
    if (!history) return [{ filing: row, records: [row] }];
    if (emitted.has(history)) return [];
    emitted.add(history);
    return [history];
  });
}

export function terminalStatus(row: Filing): string | undefined {
  if (/deceased/i.test(row.sourceStatus) || row.status === 'deceased') return 'Deceased';
  return ({ defeated: 'Defeated', disqualified: 'Disqualified', withdrew: 'Withdrew' } as Record<string, string>)[row.status];
}
function stageOrder(row: Filing) {
  return terminalStatus(row) ? 3 : row.status === 'filed' ? 0 : row.electionType.includes('primary') ? 1 : 2;
}

/** Event dates come only from explicit event metadata, never lastUpdated. */
export function candidacyEvents(history: CandidacyHistory, result?: FilingResult, otherResults: FilingResult[] = []): CandidacyEvent[] {
  const initial = history.records.find(row => row.status === 'filed') ?? history.records[0];
  const events: CandidacyEvent[] = [{ title: 'Filed', date: initial.filingDate, placeIds: history.filing.placeIds,
    source: initial.source, sourceLabel: initial.status === 'filed' ? 'Declaration of candidacy' : 'Candidacy source record' }];
  const results = [...otherResults, ...(result ? [result] : [])];
  const stages = ['presidential-primary', 'primary', 'general'];
  for (const stage of stages) {
    // Participation comes from an explicit ballot record or matched result, including nonpartisan primaries.
    const matchingResult = results.find(item => (item.contest.electionType ?? 'general') === stage);
    const ballot = history.records.find(row => row.electionType === stage &&
      (['primary_election', 'general_election', 'elected'].includes(row.status) ||
        (row.status === 'defeated' && (stage === 'primary' ? /primary/i.test(row.sourceStatus) : /general/i.test(row.sourceStatus)))));
    if (!ballot && !matchingResult) continue;
    const row = ballot ?? history.filing;
    const option = matchingResult?.contest.options.find(option => resultPerson(option.name, matchingResult.contest)?.id === row.personId || identityKey(option.name) === identityKey(row.name));
    const published = matchingResult?.contest.votesPublished !== false && option?.votesPublished !== false;
    const validShares = published && !!matchingResult?.contest.total && matchingResult?.contest.optionTotalsReconcile !== false && matchingResult?.contest.totalBasis !== 'listed named-candidate votes';
    const reportCounty = matchingResult?.snapshot.counties.find(county => county.id === matchingResult.contest.county)?.name;
    const summary = option && published ? `${count(option.votes)} votes${validShares && matchingResult ? ` · ${percent(option.votes, matchingResult.contest.total)}` : ''}${reportCounty ? ` · ${reportCounty} report` : ''}` : undefined;
    events.push({ title: stage === 'primary' ? 'Primary' : stage === 'presidential-primary' ? 'Presidential primary' : 'General Election',
      electionType: stage,
      date: matchingResult?.contest.electionDate || matchingResult?.snapshot.electionDate || row.electionDate,
      placeIds: [], source: matchingResult?.contest.source || row.source,
      sourceLabel: matchingResult ? ((matchingResult.contest.official ?? matchingResult.snapshot.official) ? 'Official results' : 'Unofficial results') : 'Ballot source record', summary });
  }
  const terminal = [...history.records].reverse().find(row => terminalStatus(row));
  if (terminal) events.push({ title: terminalStatus(terminal)!, date: terminal.statusDate, placeIds: [], source: terminal.source,
    sourceLabel: 'Status source record', summary: terminal.sourceStatus !== terminalStatus(terminal) ? terminal.sourceStatus : undefined, terminal: true });
  return events;
}
