import type { ElectionCycle, Office, Party, Person, Place } from './entities';

/**
 * Searchable text for each directory, shared by the site-wide search modal and
 * the directory index pages so "View all" lands on exactly the same matches.
 */
export const searchText = {
  elections: (election: ElectionCycle) => `${election.year} ${election.title} ${election.description}`,
  people: (person: Person) => `${person.name} ${person.filings.map((filing) => `${filing.officeName} ${filing.partyName}`).join(' ')}`,
  offices: (office: Office) => `${office.name} ${office.sections.join(' ')} ${office.filings.map((filing) => `${filing.name} ${filing.year}`).join(' ')}`,
  parties: (party: Party) => `${party.name} ${party.shortName} ${party.filings.map((filing) => `${filing.name} ${filing.year}`).join(' ')}`,
  places: (place: Place) => `${place.name} ${place.type} ${place.county} ${place.offices.map((office) => office.name).join(' ')} ${place.filings.map((filing) => filing.name).join(' ')}`
};

export function queryTokens(query: string) {
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

/** Every word of the query must appear somewhere in the text, in any order. */
export function matchesQuery(text: string, tokens: string[]) {
  const haystack = text.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/** Directory index URL that opens with the given search applied. */
export function browseUrl(path: string, query: string) {
  const trimmed = query.trim();
  return trimmed ? `${path}?${new URLSearchParams({ search: trimmed })}` : path;
}
