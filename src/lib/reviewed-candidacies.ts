import reviews from '../data/reviewed-candidacy-groups.json';
import type { Filing } from './entities';

/** Reviewed exceptions are exact source records, never name-based merge rules. */
export function reviewedCandidacies(records: Filing[]) {
  return reviews.flatMap(review => {
    const rows = review.recordIds.map(id => records.filter(row => row.recordId === id));
    if (rows.some(matches => matches.length !== 1)) return [];
    const matched = rows.map(matches => matches[0]);
    const unchanged = matched.every(row => {
      const evidence = review.sources.find(source => source.recordId === row.recordId);
      return evidence && row.personId === review.personId && row.year === review.year && row.electionType === evidence.electionType &&
        row.source === evidence.url && row.officeId === evidence.officeId && row.partyId === evidence.partyId &&
        row.county === evidence.county && row.city === evidence.city && row.status === evidence.status;
    });
    const canonical = matched.find(row => row.recordId === review.canonicalRecordId);
    // Within an explicitly reviewed candidacy, prefer a reported affiliation to a missing value.
    // Conflicting named affiliations remain a review decision; source records are never rewritten.
    const reported = matched.filter(row => row.partyId !== 'not-reported');
    const affiliation = canonical?.partyId === 'not-reported' && new Set(reported.map(row => row.partyId)).size === 1 ? reported[0] : canonical;
    const stageRows = matched.filter(row => row.electionType === review.electionType && row.status !== 'filed');
    const latest = stageRows.find(row => ['defeated', 'disqualified', 'withdrew', 'deceased'].includes(row.status) || /deceased/i.test(row.sourceStatus)) ?? stageRows[0];
    return unchanged && canonical && latest ? [{ review, filing: { ...canonical, partyId: affiliation!.partyId, partyName: affiliation!.partyName, electionType: latest.electionType, status: latest.status, sourceStatus: latest.sourceStatus }, records: matched }] : [];
  });
}

export function reviewedResultFor(filing: Filing) {
  for (const review of reviews) {
    if (review.personId !== filing.personId || review.year !== filing.year) continue;
    const evidence = review.sources.find(source => source.recordId === filing.recordId && source.url === filing.source &&
      source.officeId === filing.officeId && source.partyId === filing.partyId && source.county === filing.county && source.city === filing.city);
    const result = review.resultLinks.find(result => result.electionType === filing.electionType);
    if (evidence && result) return { resultContestId: result.contestId, resultSource: result.source, county: result.county ?? null, city: result.city ?? '' };
  }
}
