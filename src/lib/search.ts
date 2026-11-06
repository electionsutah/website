import type { ElectionCycle, Office, Party, Person, Place } from './entities';

/** Other names people search for a place by, keyed by its official name. */
const placeAliases: Record<string, string[]> = {
  'Mount Pleasant': ['Mt Pleasant', 'Mt. Pleasant']
};
const withAliases = (name: string) => [name, ...(placeAliases[name] ?? [])].join(' ');

/**
 * Searchable text for each directory, shared by the site-wide search modal and
 * the directory index pages so "View all" lands on exactly the same matches.
 */
export const searchText = {
  elections: (election: ElectionCycle) => `${election.year} ${election.title} ${election.description}`,
  people: (person: Person) => `${person.name} ${person.filings.map((filing) => `${filing.year} ${filing.officeName} ${filing.partyName} ${filing.sourceStatus} ${withAliases(filing.city)} ${filing.county}`).join(' ')}`,
  offices: (office: Office) => `${office.name} ${office.sections.join(' ')} ${office.filings.map((filing) => `${filing.name} ${filing.year}`).join(' ')}`,
  parties: (party: Party) => `${party.name} ${party.shortName} ${party.filings.map((filing) => `${filing.name} ${filing.year}`).join(' ')}`,
  places: (place: Place) => `${withAliases(place.name)} ${place.type} ${place.county} ${place.offices.map((office) => office.name).join(' ')} ${place.filings.map((filing) => filing.name).join(' ')}`
};

export function queryTokens(query: string) {
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

/** Every word of the query must appear somewhere in the text, in any order. */
export function matchesQuery(text: string, tokens: string[]) {
  const haystack = text.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

/** Prefer an entity's own title over related records; keep existing order within each tier. */
export function rankByTitle<T>(items: T[], tokens: string[], title: (item: T) => string): T[] {
  if (!tokens.length) return items;
  const phrase = tokens.join(' ');
  return items.map((item) => {
    const normalized = title(item).toLowerCase().trim().replace(/\s+/g, ' ');
    const matchedWords = tokens.filter((token) => normalized.includes(token)).length;
    const rank = normalized === phrase ? 3 : matchedWords === tokens.length ? 2 : matchedWords ? 1 : 0;
    return { item, rank };
  }).sort((a, b) => b.rank - a.rank).map(({ item }) => item);
}

/** Directory index URL that opens with the given search applied. */
export function browseUrl(path: string, query: string) {
  const trimmed = query.trim();
  return trimmed ? `${path}?${new URLSearchParams({ search: trimmed })}` : path;
}
