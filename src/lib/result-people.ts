import { cleanOfficeName, identityKey, people, type Person } from './entities';
import type { Contest } from './results';

// Keep ballot responses and write-in aggregates out of person reconciliation.
const ballotResponses = new Set(['yes', 'no', 'for', 'against', 'writein', 'writeins', 'adjudicatedwriteins']);
type Race = Pick<Contest, 'name' | 'county'>;

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
    const key = identityKey(name);
    if (!key || ballotResponses.has(key)) return undefined;
    const matches = [...(byName.get(key)?.values() ?? [])];
    if (matches.length === 1) return matches[0];
    // Only disambiguate identical names with a filing in this election and race.
    const contextual = matches.filter(person => person.filings.some(filing =>
      filing.year === 2026 && identityKey(cleanOfficeName(filing.officeName)) === identityKey(cleanOfficeName(race.name)) &&
      (!race.county || `${filing.county.toLowerCase().replaceAll(' ', '-')}-county-ut` === race.county)
    ));
    return contextual.length === 1 ? contextual[0] : undefined;
  };
}

export const resultPerson = createResultPersonResolver(people);
export const retainedJudgeName = (contest: Race) => /^Shall\s+(.+?)\s+be retained\b/i.exec(contest.name)?.[1];
export const personHref = (person: Person) => `/people/${person.id}/`;
