import { cleanOfficeName, identityKey, type Filing } from './entities';
import { resultPerson, retainedJudgeName } from './result-people';
import { tidySnapshot } from './result-names';
import type { Contest, Snapshot } from './results';
import index from '../data/result-index.json';
import { reviewedResultFor } from './reviewed-candidacies';
import { formatOfficeName } from './office-names';

const snapshots = new Map<string, Promise<Snapshot>>();
const stageFor = (filing: Filing) => filing.status === 'filed' ? 'general' : filing.electionType;
export const hasFilingResults = (filing: Filing) => index.some(row => row.year === filing.year && (row.electionType === stageFor(filing) || row.electionType === filing.electionType));

export function loadFilingResults(year: number, electionType = 'general'): Promise<Snapshot> {
  const dataset = index.find(row => row.year === year && row.electionType === electionType);
  if (!dataset) return Promise.reject(new Error('No imported results for this election'));
  const key = dataset.url;
  if (!snapshots.has(key)) {
    snapshots.set(key, fetch(key).then(response => {
      if (!response.ok) throw new Error('Results unavailable');
      return response.json();
    }).then(data => tidySnapshot({ ...data, contests: data.contests.map((contest: Contest & { total: number | null; options: { votes: number | null }[] }) => ({
      ...contest, total: contest.total ?? 0,
      options: contest.options.map(option => ({ ...option, votesPublished: option.votes !== null, votes: option.votes ?? 0 }))
    })) })).catch(error => {
      snapshots.delete(key);
      throw error;
    }));
  }
  return snapshots.get(key)!;
}

export async function resultsForFiling(filing: Filing): Promise<{ snapshot: Snapshot; contest: Contest } | undefined> {
  const stages = [...new Set([stageFor(filing), filing.electionType])];
  for (const stage of stages) {
    if (!index.some(row => row.year === filing.year && row.electionType === stage)) continue;
    const snapshot = await loadFilingResults(filing.year, stage);
    const contest = resultForFiling(filing, snapshot);
    if (contest) return { snapshot, contest };
  }
}

/** Match a ballot appearance by year, stage, exact office, geography and identity. */
export function resultForFiling(filing: Filing, snapshot: Snapshot): Contest | undefined {
  if (filing.year !== Number(snapshot.electionDate.slice(0, 4))) return;
  const review = reviewedResultFor(filing);
  if (review) {
    const reviewed = snapshot.contests.filter(contest => contest.id === review.resultContestId &&
      contest.source === review.resultSource && (contest.county ?? null) === review.county && (contest.city ?? '') === review.city &&
      (contest.electionType ?? 'general') === filing.electionType &&
      contest.options.some(option => identityKey(option.name) === identityKey(filing.name)));
    return reviewed.length === 1 ? reviewed[0] : undefined;
  }
  const primary = filing.electionType.includes('primary');
  const officeKey = (name: string) => identityKey(formatOfficeName(cleanOfficeName(primary ? name.replace(/^(?:REP|DEM)\s+/i, '') : name)));
  const matches = snapshot.contests.filter(contest => {
    const stage = contest.electionType ?? 'general';
    if (stage !== filing.electionType && !(filing.status === 'filed' && stage === 'general')) return false;
    const partyCode = primary && /^(REP|DEM)\s+/i.exec(contest.name)?.[1].toUpperCase();
    if (partyCode && filing.partyId !== (partyCode === 'REP' ? 'utah-republican-party' : 'utah-democratic-party')) return false;
    const county = snapshot.counties.find(row => row.id === contest.county);
    const countyName = county?.name ?? '';
    const names = [contest.name, countyName ? `${countyName} ${contest.name.replace(/^County\s+/i, '')}` : '', contest.city ? `${contest.city} ${contest.name}` : ''];
    const exactOffice = names.some(name => officeKey(name) === officeKey(filing.officeName));
    // A source-specific ballot item sometimes omits the filing roster's term annotation.
    // Only bridge that omission when the exact ballot URL, stage, geography and candidate agree.
    const term = /\s*\(\d+[ -]year term\)$/i;
    const sameBallotSource = filing.source === contest.source && /^https:\/\/electionresults\.utah\.gov\/.*\/ballot-items\//.test(contest.source);
    const omittedTerm = sameBallotSource && !(term.test(filing.officeName) && term.test(contest.name)) &&
      names.some(name => officeKey(name.replace(term, '')) === officeKey(filing.officeName.replace(term, '')));
    if (!exactOffice && !omittedTerm) return false;
    if (contest.county && identityKey(filing.county.replace(/ County$/i, '')) !== identityKey(countyName.replace(/ County$/i, ''))) return false;
    if (contest.city && identityKey(contest.city) !== identityKey(filing.city)) return false;
    const judge = contest.judgeName ?? retainedJudgeName(contest);
    if (judge) return identityKey(judge) === identityKey(filing.name) || resultPerson(judge, contest)?.id === filing.personId;
    if (contest.kind === 'measure') return false;
    return contest.options.some(option => {
      const ticketName = ['U.S. President & Vice President', 'Governor & Lieutenant Governor'].includes(filing.officeName) ? option.name.split(/,\s+| & /)[0] : option.name;
      return identityKey(ticketName) === identityKey(filing.name) || resultPerson(ticketName, contest)?.id === filing.personId;
    });
  });
  return matches.length === 1 ? matches[0] : undefined;
}
