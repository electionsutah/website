import { cleanOfficeName, displayName, identityKey, people, type Person } from './entities';
import type { Contest } from './results';

// Keep ballot responses and write-in aggregates out of person reconciliation.
const ballotResponses = new Set(['yes', 'no', 'for', 'against', 'writein', 'writeins', 'adjudicatedwriteins']);
type Race = Pick<Contest, 'name' | 'county' | 'year'>;

/** Use the directory's actual IDs and identity rules, never a guessed URL slug. */
export function createResultPersonResolver(directory: Person[]) {
  const byName = new Map<string, Map<string, Person>>();
  for (const person of directory) {
    const names = [person.name, ...person.filings.map(filing => filing.personId === person.id ? filing.name : filing.runningMate)];
    for (const name of names.filter(Boolean)) {
      const key = identityKey(name);
      const matches = byName.get(key) ?? new Map<string, Person>();
      matches.set(person.id, person);
      byName.set(key, matches);
    }
  }
  return (name: string, race: Race): Person | undefined => {
    const candidateName = ['U.S. President & Vice President', 'Governor & Lieutenant Governor'].includes(cleanOfficeName(race.name)) ? name.split(/,\s+| & /)[0] : name;
    const key = identityKey(candidateName);
    if (!key || ballotResponses.has(key)) return undefined;
    const matches = [...(byName.get(key)?.values() ?? [])];
    if (matches.length === 1) return matches[0];
    // Only disambiguate identical names with a filing in this election and race.
    // 2026 filings carry no county, so county-level races stay unlinked rather than risk a wrong match.
    const contextual = matches.filter(person => person.filings.some(filing =>
      filing.year === (race.year ?? 2026) && identityKey(cleanOfficeName(filing.officeName)) === identityKey(cleanOfficeName(race.name)) &&
      (!race.county || `${filing.county.toLowerCase().replaceAll(' ', '-')}-county-ut` === race.county)
    ));
    return contextual.length === 1 ? contextual[0] : undefined;
  };
}

export const resultPerson = createResultPersonResolver(people);
// State feeds: "Shall X be retained…"; county feeds: "X Judicial Retention".
export const retainedJudgeName = (contest: Race) => (/^Shall\s+(.+?)\s+be retained\b/i.exec(contest.name) ?? /^(.+?)\s+Judicial Retention$/i.exec(contest.name.trim()))?.[1];
/**
 * Display title for a contest. Retention questions read "{Name}, {Office}", e.g.
 * "Shall JANE DOE be retained in the office of Justice of the Supreme Court of Utah?"
 * becomes "Jane Doe, Justice of the Supreme Court of Utah". County feeds name only the
 * judge ("JANE DOE Judicial Retention"), so those read "Jane Doe, Judge".
 */
export function contestTitle(contest: Race) {
  const name = contest.name.replace(' (Multi-County)', '').trim();
  const state = /^Shall\s+(.+?)\s+be retained in the office of\s+(.+?)\?/i.exec(name);
  const county = state ? null : /^(.+?)\s+Judicial Retention$/i.exec(name);
  const judge = state?.[1] ?? county?.[1];
  if (!judge) return name;
  // Prefer the directory's spelling; otherwise recase the all-caps ballot name (MCIFF → McIff).
  const judgeName = resultPerson(judge, contest)?.name ?? displayName(judge).replace(/\bMc(\p{Ll})/gu, (_, letter) => `Mc${letter.toUpperCase()}`);
  return `${judgeName}, ${state ? state[2] : 'Judge'}`;
}
export const personHref = (person: Person) => `/people/${person.id}/`;
